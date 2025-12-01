import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { DEFAULT_USER_ID, supabaseClient } from "../../db/supabase.client.ts";
import { CATEGORY_ERROR_CODES, buildErrorResponse, type CategoryErrorCode } from "../../lib/errors.ts";
import { listCategories } from "../../lib/services/categories.service.ts";
import type { CategoriesQuery } from "../../lib/validation/categories.schema.ts";
import {
  InvalidCategoryCursorError,
  buildCategoriesQuery,
  categoriesQuerySchema,
} from "../../lib/validation/categories.schema.ts";
import { encodeBase64 } from "../../lib/utils/base64.ts";
import type { CategoryListResponse } from "../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const CATEGORY_EVENT_SCOPE = "api/categories";

interface RawCategoryQueryParams {
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
      CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const rawQuery: RawCategoryQueryParams = {
    search: optionalParam(url.searchParams.get("search")),
    limit: optionalParam(url.searchParams.get("limit")),
    cursor: optionalParam(url.searchParams.get("cursor")),
    sort: optionalParam(url.searchParams.get("sort")),
  };

  const validationResult = categoriesQuerySchema.safeParse(rawQuery);
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

  let query: CategoriesQuery;
  try {
    query = buildCategoriesQuery(validationResult.data);
  } catch (error) {
    if (error instanceof InvalidCategoryCursorError) {
      return invalidQueryResponse(error.message, rawQuery, { reason: "invalid_cursor" });
    }

    const descriptor = buildErrorResponse(
      500,
      CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while parsing the query cursor."
    );
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "cursor_decoding_failure", query: rawQuery },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    const result = await listCategories(supabase, query);
    const payload: CategoryListResponse = {
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
        CATEGORY_ERROR_CODES.DB_ERROR,
        "Failed to query categories from the database.",
        { code: error.code, message: error.message }
      );
      recordCategoriesEvent({
        severity: "error",
        status: descriptor.status,
        code: CATEGORY_ERROR_CODES.DB_ERROR,
        details: { reason: "postgrest_error", db_code: error.code, query: serializeStructuredQuery(query) },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while fetching categories."
    );
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
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
  rawQuery: RawCategoryQueryParams,
  details?: Record<string, unknown>
): Response {
  const descriptor = buildErrorResponse(400, CATEGORY_ERROR_CODES.INVALID_QUERY, message);
  recordCategoriesEvent({
    severity: "info",
    status: descriptor.status,
    code: CATEGORY_ERROR_CODES.INVALID_QUERY,
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

function serializeStructuredQuery(query: CategoriesQuery): Record<string, string | number | undefined> {
  return {
    search: query.search,
    limit: query.limit,
    cursor: query.cursor,
    sort: query.sort,
  };
}

interface CategoryEventPayload {
  severity: "info" | "error";
  status: number;
  code: CategoryErrorCode;
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
function recordCategoriesEvent(payload: CategoryEventPayload): void {
  const entry = {
    scope: CATEGORY_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: DEFAULT_USER_ID,
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${CATEGORY_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
