import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { DEFAULT_USER_ID, supabaseClient } from "../../db/supabase.client.ts";
import { SOURCE_ERROR_CODES, buildErrorResponse, type SourceErrorCode } from "../../lib/errors.ts";
import { listSources } from "../../lib/services/sources.service.ts";
import type { SourcesQuery } from "../../lib/validation/sources.schema.ts";
import {
  InvalidSourceCursorError,
  buildSourcesQuery,
  sourcesQuerySchema,
} from "../../lib/validation/sources.schema.ts";
import { encodeBase64 } from "../../lib/utils/base64.ts";
import type { SourceListResponse } from "../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const SOURCE_EVENT_SCOPE = "api/sources";

interface RawSourceQueryParams {
  kind?: string;
  search?: string;
  limit?: string;
  cursor?: string;
  sort?: string;
}

export const GET: APIRoute = async ({ locals, url }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      SOURCE_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordSourcesEvent({
      severity: "error",
      status: descriptor.status,
      code: SOURCE_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const rawQuery: RawSourceQueryParams = {
    kind: optionalParam(url.searchParams.get("kind")),
    search: optionalParam(url.searchParams.get("search")),
    limit: optionalParam(url.searchParams.get("limit")),
    cursor: optionalParam(url.searchParams.get("cursor")),
    sort: optionalParam(url.searchParams.get("sort")),
  };

  const validationResult = sourcesQuerySchema.safeParse(rawQuery);
  if (!validationResult.success) {
    const issues = validationResult.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
    }));
    return invalidQueryResponse(
      validationResult.error.issues.map((issue) => issue.message).join("; ") || "Query parameters are invalid.",
      rawQuery,
      { reason: "schema_validation_failed", issues }
    );
  }

  let query: SourcesQuery;
  try {
    query = buildSourcesQuery(validationResult.data);
  } catch (error) {
    if (error instanceof InvalidSourceCursorError) {
      return invalidQueryResponse(error.message, rawQuery, { reason: "invalid_cursor" });
    }

    const descriptor = buildErrorResponse(
      500,
      SOURCE_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while parsing the query cursor."
    );
    recordSourcesEvent({
      severity: "error",
      status: descriptor.status,
      code: SOURCE_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "cursor_decoding_failure", query: rawQuery },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    const result = await listSources(supabase, query);
    const payload: SourceListResponse = {
      data: result.items,
      page: {
        has_more: result.hasMore,
        next_cursor: encodeCursor(result.nextCursorId),
      },
    };

    return jsonResponse(200, payload);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = buildErrorResponse(
        500,
        SOURCE_ERROR_CODES.DB_ERROR,
        "Failed to query sources from the database.",
        {
          code: error.code,
          message: error.message,
        }
      );
      recordSourcesEvent({
        severity: "error",
        status: descriptor.status,
        code: SOURCE_ERROR_CODES.DB_ERROR,
        details: { reason: "postgrest_error", db_code: error.code, query: serializeStructuredQuery(query) },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      SOURCE_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while fetching sources."
    );
    recordSourcesEvent({
      severity: "error",
      status: descriptor.status,
      code: SOURCE_ERROR_CODES.UNEXPECTED_ERROR,
      details: {
        reason: "unexpected_fetch_error",
        query: serializeStructuredQuery(query),
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

function optionalParam(value: string | null): string | undefined {
  return value ?? undefined;
}

function encodeCursor(id: number | null): string | null {
  if (id == null) {
    return null;
  }

  try {
    return encodeBase64(String(id));
  } catch {
    return null;
  }
}

function invalidQueryResponse(
  message: string,
  rawQuery: RawSourceQueryParams,
  details?: Record<string, unknown>
): Response {
  const descriptor = buildErrorResponse(400, SOURCE_ERROR_CODES.INVALID_QUERY, message);
  recordSourcesEvent({
    severity: "info",
    status: descriptor.status,
    code: SOURCE_ERROR_CODES.INVALID_QUERY,
    details: { ...(details ?? {}), query: rawQuery },
  });
  return jsonResponse(descriptor.status, descriptor.body);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(
    error && typeof error === "object" && "code" in error && typeof (error as Record<string, unknown>).code === "string"
  );
}

function serializeStructuredQuery(query: SourcesQuery): Record<string, string | number | undefined> {
  return {
    kind: query.kind,
    search: query.search,
    limit: query.limit,
    cursor: query.cursor,
    sort: query.sort,
  };
}

interface SourceEventPayload {
  severity: "info" | "error";
  status: number;
  code: SourceErrorCode;
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
function recordSourcesEvent(payload: SourceEventPayload): void {
  const entry = {
    scope: SOURCE_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: DEFAULT_USER_ID,
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${SOURCE_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
