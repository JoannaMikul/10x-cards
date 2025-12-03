import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { DEFAULT_USER_ID, supabaseClient } from "../../db/supabase.client.ts";
import {
  CANDIDATE_ERROR_CODES,
  buildErrorResponse,
  mapCandidateDbError,
  type CandidateErrorCode,
} from "../../lib/errors.ts";
import { listGenerationCandidates } from "../../lib/services/generation-candidates.service.ts";
import { getGenerationById } from "../../lib/services/generations.service.ts";
import {
  InvalidCandidateCursorError,
  buildGenerationCandidatesQuery,
  generationCandidatesQuerySchema,
  type GenerationCandidatesQuery,
  type GenerationCandidatesQuerySchema,
} from "../../lib/validation/generation-candidates.schema.ts";
import { encodeBase64 } from "../../lib/utils/base64.ts";
import type { GenerationCandidateListResponse } from "../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const EVENT_SCOPE = "api/generation-candidates";

interface RawGenerationCandidatesQueryParams {
  generation_id?: string;
  limit?: string;
  cursor?: string;
  "status[]": string[] | undefined;
}

export const GET: APIRoute = async ({ locals, url }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordCandidatesEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const rawQuery = buildRawQuery(url);
  const validationResult = generationCandidatesQuerySchema.safeParse(rawQuery);

  if (!validationResult.success) {
    const message =
      validationResult.error.issues.map((issue) => issue.message).join("; ") || "Query parameters are invalid.";
    return invalidQueryResponse(message, rawQuery, {
      reason: "schema_validation_failed",
      issues: validationResult.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
    });
  }

  let query: GenerationCandidatesQuery;
  try {
    query = buildGenerationCandidatesQuery(validationResult.data);
  } catch (error) {
    if (error instanceof InvalidCandidateCursorError) {
      return invalidQueryResponse(error.message, rawQuery, { reason: "invalid_cursor" });
    }

    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while parsing the query cursor."
    );
    recordCandidatesEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "cursor_decoding_failure", query: rawQuery },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const userId = DEFAULT_USER_ID;

  try {
    const generation = await getGenerationById(supabase, userId, query.generationId);

    if (!generation) {
      const descriptor = buildErrorResponse(404, CANDIDATE_ERROR_CODES.NOT_FOUND, "Generation could not be found.");
      recordCandidatesEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        details: { reason: "generation_not_found", generationId: query.generationId, userId },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const result = await listGenerationCandidates(supabase, userId, query);
    const payload: GenerationCandidateListResponse = {
      data: result.items,
      page: {
        has_more: result.hasMore,
        next_cursor: encodeCandidateCursor(result.nextCursorId),
      },
    };

    return jsonResponse(200, payload);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = mapCandidateDbError(error);
      recordCandidatesEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        details: {
          reason: "postgrest_error",
          db_code: error.code,
          query: serializeStructuredQuery(validationResult.data),
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while fetching generation candidates."
    );
    recordCandidatesEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: {
        reason: "unexpected_fetch_error",
        query: serializeStructuredQuery(validationResult.data),
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

function buildRawQuery(url: URL): RawGenerationCandidatesQueryParams {
  const statusFilters = url.searchParams.getAll("status[]");

  return {
    generation_id: optionalParam(url.searchParams.get("generation_id")),
    limit: optionalParam(url.searchParams.get("limit")),
    cursor: optionalParam(url.searchParams.get("cursor")),
    "status[]": statusFilters.length > 0 ? statusFilters : undefined,
  };
}

function optionalParam(value: string | null): string | undefined {
  return value ?? undefined;
}

function encodeCandidateCursor(id: string | null): string | null {
  if (!id) {
    return null;
  }

  try {
    return encodeBase64(id);
  } catch {
    return null;
  }
}

function invalidQueryResponse(
  message: string,
  rawQuery: RawGenerationCandidatesQueryParams,
  details?: Record<string, unknown>
): Response {
  const descriptor = buildErrorResponse(400, CANDIDATE_ERROR_CODES.INVALID_QUERY, message);
  recordCandidatesEvent({
    severity: "info",
    status: descriptor.status,
    code: descriptor.body.error.code,
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

function serializeStructuredQuery(query: GenerationCandidatesQuerySchema): Record<string, unknown> {
  return {
    generation_id: query.generation_id,
    limit: query.limit,
    cursor: query.cursor,
    statuses: query["status[]"],
  };
}

interface CandidateEventPayload {
  severity: "info" | "error";
  status: number;
  code: CandidateErrorCode;
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
function recordCandidatesEvent(payload: CandidateEventPayload): void {
  const entry = {
    scope: EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: DEFAULT_USER_ID,
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
