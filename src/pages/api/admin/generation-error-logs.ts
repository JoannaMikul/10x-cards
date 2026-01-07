import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseClient } from "../../../db/supabase.client";
import { GENERATION_ERROR_LOGS_ERROR_CODES, buildErrorResponse } from "../../../lib/errors";
import { getGenerationErrorLogs } from "../../../lib/services/error-logs.service";
import type { GenerationErrorLogListResponse } from "../../../types";
import {
  buildGenerationErrorLogsQuery,
  generationErrorLogsQuerySchema,
} from "../../../lib/validation/generation-error-logs.schema";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const GENERATION_ERROR_LOGS_EVENT_SCOPE = "api/admin/generation-error-logs";

/**
 * Checks if the current user has admin privileges.
 * @param supabase Supabase client instance
 * @returns Promise resolving to true if user is admin, throws error otherwise
 * @throws Error if the admin check fails due to database issues
 */
async function checkAdminStatus(supabase: NonNullable<typeof supabaseClient>): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");

  if (error) {
    throw new Error(`Failed to verify admin privileges: ${error.message}`);
  }

  return data === true;
}

/**
 * GET /api/admin/generation-error-logs
 *
 * Retrieves paginated generation error logs with optional filtering.
 * Requires admin privileges for access.
 *
 * Query parameters:
 * - user_id: Filter by specific user UUID
 * - model: Filter by AI model name
 * - from/to: Filter by date range (ISO date strings)
 * - limit: Number of results per page (1-100, default 20)
 * - cursor: Cursor for pagination
 *
 * Performance notes:
 * - Uses cursor-based pagination for efficient large dataset navigation
 * - Leverages database indexes on created_at and user_id for optimal filtering
 * - Considers rate limiting for admin endpoints in production deployment
 *
 * @param locals - Astro locals containing user and supabase client
 * @param url - Request URL with query parameters
 * @returns Response with paginated error logs or error response
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      GENERATION_ERROR_LOGS_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordGenerationErrorLogsEvent({
      severity: "error",
      status: descriptor.status,
      code: GENERATION_ERROR_LOGS_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(
      401,
      GENERATION_ERROR_LOGS_ERROR_CODES.UNAUTHORIZED,
      "User not authenticated."
    );
    recordGenerationErrorLogsEvent({
      severity: "error",
      status: descriptor.status,
      code: GENERATION_ERROR_LOGS_ERROR_CODES.UNAUTHORIZED,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    const isAdmin = await checkAdminStatus(supabase);
    if (!isAdmin) {
      const descriptor = buildErrorResponse(
        403,
        GENERATION_ERROR_LOGS_ERROR_CODES.FORBIDDEN,
        "Admin privileges required."
      );
      recordGenerationErrorLogsEvent({
        severity: "error",
        status: descriptor.status,
        code: GENERATION_ERROR_LOGS_ERROR_CODES.FORBIDDEN,
        details: { reason: "user_not_admin", userId: locals.user.id },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }
  } catch (error) {
    const descriptor = buildErrorResponse(
      500,
      GENERATION_ERROR_LOGS_ERROR_CODES.DB_ERROR,
      "Failed to verify admin privileges."
    );
    recordGenerationErrorLogsEvent({
      severity: "error",
      status: descriptor.status,
      code: GENERATION_ERROR_LOGS_ERROR_CODES.DB_ERROR,
      details: {
        reason: "admin_check_failed",
        userId: locals.user.id,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const rawQuery = {
    user_id: url.searchParams.get("user_id") ?? undefined,
    model: url.searchParams.get("model") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  };

  const validationResult = generationErrorLogsQuerySchema.safeParse(rawQuery);
  if (!validationResult.success) {
    const issues = validationResult.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
    }));
    const descriptor = buildErrorResponse(
      400,
      GENERATION_ERROR_LOGS_ERROR_CODES.INVALID_QUERY,
      "Invalid query parameters.",
      { issues }
    );
    recordGenerationErrorLogsEvent({
      severity: "info",
      status: descriptor.status,
      code: GENERATION_ERROR_LOGS_ERROR_CODES.INVALID_QUERY,
      details: {
        reason: "schema_validation_failed",
        userId: locals.user.id,
        query: rawQuery,
        issues,
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const query = buildGenerationErrorLogsQuery(validationResult.data);

  try {
    const result = await getGenerationErrorLogs(supabase, query);
    const payload: GenerationErrorLogListResponse = {
      data: result.items,
      page: {
        has_more: result.hasMore,
        next_cursor: result.nextCursorId,
      },
    };

    recordGenerationErrorLogsEvent({
      severity: "info",
      status: 200,
      code: "generation_error_logs_retrieved",
      details: {
        reason: "generation_error_logs_retrieved_successfully",
        userId: locals.user.id,
        itemCount: result.items.length,
        hasMore: result.hasMore,
        query: serializeQuery(query),
      },
    });

    return jsonResponse(200, payload);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = buildErrorResponse(
        500,
        GENERATION_ERROR_LOGS_ERROR_CODES.DB_ERROR,
        "Failed to retrieve generation error logs from the database.",
        { code: error.code, message: error.message }
      );
      recordGenerationErrorLogsEvent({
        severity: "error",
        status: descriptor.status,
        code: GENERATION_ERROR_LOGS_ERROR_CODES.DB_ERROR,
        details: {
          reason: "postgrest_error",
          userId: locals.user.id,
          query: serializeQuery(query),
          db_code: error.code,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      GENERATION_ERROR_LOGS_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while retrieving generation error logs."
    );
    recordGenerationErrorLogsEvent({
      severity: "error",
      status: descriptor.status,
      code: GENERATION_ERROR_LOGS_ERROR_CODES.UNEXPECTED_ERROR,
      details: {
        reason: "unexpected_fetch_error",
        userId: locals.user.id,
        query: serializeQuery(query),
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

/**
 * Creates a JSON response with proper headers.
 * @param status HTTP status code
 * @param body Response body to be JSON serialized
 * @returns Response object with JSON content
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

/**
 * Type guard to check if an error is a PostgREST error.
 * @param error The error to check
 * @returns True if the error is a PostgREST error with a code property
 */
function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(
    error && typeof error === "object" && "code" in error && typeof (error as Record<string, unknown>).code === "string"
  );
}

/**
 * Serializes query parameters for logging purposes.
 * @param query The validated query object
 * @returns Plain object representation of query parameters
 */
function serializeQuery(query: ReturnType<typeof buildGenerationErrorLogsQuery>): Record<string, unknown> {
  return {
    user_id: query.user_id,
    model: query.model,
    from: query.from,
    to: query.to,
    limit: query.limit,
    cursor: query.cursor,
  };
}

interface GenerationErrorLogsEventPayload {
  severity: "info" | "error";
  status: number;
  code: string;
  userId?: string;
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
/**
 * Records an event for audit and monitoring purposes.
 * Logs to console with structured JSON format.
 * @param payload Event details including severity, status, and metadata
 */
function recordGenerationErrorLogsEvent(payload: GenerationErrorLogsEventPayload): void {
  const entry = {
    scope: GENERATION_ERROR_LOGS_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: payload.userId ?? "unknown",
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${GENERATION_ERROR_LOGS_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
