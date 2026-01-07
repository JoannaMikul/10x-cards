import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseClient } from "../../../db/supabase.client";
import { ANALYTICS_ERROR_CODES, buildErrorResponse } from "../../../lib/errors";
import { createAnalyticsService } from "../../../lib/services/analytics.service";
import type { AnalyticsKpiResponse } from "../../../types";
import { adminKpiQuerySchema, customRangeValidationSchema } from "../../../lib/validation/admin-kpi.schema";
import type { AdminKpiQuery } from "../../../lib/validation/admin-kpi.schema";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const ANALYTICS_KPI_EVENT_SCOPE = "api/admin/kpi";

/**
 * Checks if the current user has admin privileges.
 * @param supabase Supabase client instance
 * @returns Promise resolving to true if user is admin, throws error otherwise
 */
async function checkAdminStatus(supabase: NonNullable<typeof supabaseClient>): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");

  if (error) {
    throw new Error(`Failed to verify admin privileges: ${error.message}`);
  }

  return data === true;
}

/**
 * GET /api/admin/kpi
 *
 * Retrieves key performance indicators (KPIs) for flashcard generation and usage.
 * Requires admin privileges for access.
 *
 * Query parameters:
 * - range: Time range filter ('7d', '30d', 'custom') - default '7d'
 * - group_by: Grouping criteria ('day', 'category', 'origin') - default 'day'
 * - from: Start date for custom range (ISO string, required when range='custom')
 * - to: End date for custom range (ISO string, required when range='custom')
 *
 * Response includes:
 * - ai_acceptance_rate: Rate of AI-generated cards being accepted
 * - ai_share: Proportion of AI-generated vs manual cards
 * - totals: Total counts of AI and manual cards
 * - trend: Time-series data points
 *
 * Performance considerations:
 * - Date range limited to maximum 90 days to prevent performance issues
 * - Uses efficient database queries with proper indexing
 * - Caches are not used as KPI data requires real-time accuracy
 *
 * @param locals - Astro locals containing user and supabase client
 * @param url - Request URL with query parameters
 * @returns Response with KPI data or error response
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      ANALYTICS_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordAnalyticsKpiEvent({
      severity: "error",
      status: descriptor.status,
      code: ANALYTICS_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, ANALYTICS_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordAnalyticsKpiEvent({
      severity: "error",
      status: descriptor.status,
      code: ANALYTICS_ERROR_CODES.UNAUTHORIZED,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    const isAdmin = await checkAdminStatus(supabase);
    if (!isAdmin) {
      const descriptor = buildErrorResponse(403, ANALYTICS_ERROR_CODES.FORBIDDEN, "Admin privileges required.");
      recordAnalyticsKpiEvent({
        severity: "error",
        status: descriptor.status,
        code: ANALYTICS_ERROR_CODES.FORBIDDEN,
        details: { reason: "user_not_admin", userId: locals.user.id },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }
  } catch (error) {
    const descriptor = buildErrorResponse(500, ANALYTICS_ERROR_CODES.DB_ERROR, "Failed to verify admin privileges.");
    recordAnalyticsKpiEvent({
      severity: "error",
      status: descriptor.status,
      code: ANALYTICS_ERROR_CODES.DB_ERROR,
      details: {
        reason: "admin_check_failed",
        userId: locals.user.id,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  // Parse and validate query parameters
  const rawQuery = {
    range: url.searchParams.get("range") ?? undefined,
    group_by: url.searchParams.get("group_by") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };

  const queryValidationResult = adminKpiQuerySchema.safeParse(rawQuery);
  if (!queryValidationResult.success) {
    const issues = queryValidationResult.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
    }));
    const descriptor = buildErrorResponse(400, ANALYTICS_ERROR_CODES.INVALID_QUERY, "Invalid query parameters.", {
      issues,
    });
    recordAnalyticsKpiEvent({
      severity: "info",
      status: descriptor.status,
      code: ANALYTICS_ERROR_CODES.INVALID_QUERY,
      details: {
        reason: "query_validation_failed",
        userId: locals.user.id,
        query: rawQuery,
        issues,
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const query = queryValidationResult.data;

  // Additional validation for custom date range
  if (query.range === "custom") {
    const customRangeResult = customRangeValidationSchema.safeParse({
      range: query.range,
      from: query.from,
      to: query.to,
    });

    if (!customRangeResult.success) {
      const descriptor = buildErrorResponse(
        400,
        ANALYTICS_ERROR_CODES.INVALID_QUERY,
        "Invalid custom date range parameters."
      );
      recordAnalyticsKpiEvent({
        severity: "info",
        status: descriptor.status,
        code: ANALYTICS_ERROR_CODES.INVALID_QUERY,
        details: {
          reason: "custom_range_validation_failed",
          userId: locals.user.id,
          query,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }
  }

  try {
    const analyticsService = createAnalyticsService(supabase);
    const result: AnalyticsKpiResponse = await analyticsService.getKpiMetrics(query);

    recordAnalyticsKpiEvent({
      severity: "info",
      status: 200,
      code: "kpi_metrics_retrieved",
      details: {
        reason: "kpi_metrics_retrieved_successfully",
        userId: locals.user.id,
        range: query.range,
        groupBy: query.group_by,
        totalPoints: result.trend.length,
      },
    });

    return jsonResponse(200, result);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = buildErrorResponse(
        500,
        ANALYTICS_ERROR_CODES.DB_ERROR,
        "Failed to retrieve KPI metrics from the database.",
        { code: error.code, message: error.message }
      );
      recordAnalyticsKpiEvent({
        severity: "error",
        status: descriptor.status,
        code: ANALYTICS_ERROR_CODES.DB_ERROR,
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
      ANALYTICS_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while retrieving KPI metrics."
    );
    recordAnalyticsKpiEvent({
      severity: "error",
      status: descriptor.status,
      code: ANALYTICS_ERROR_CODES.UNEXPECTED_ERROR,
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
function serializeQuery(query: AdminKpiQuery): Record<string, unknown> {
  return {
    range: query.range,
    group_by: query.group_by,
    from: query.from,
    to: query.to,
  };
}

interface AnalyticsKpiEventPayload {
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
function recordAnalyticsKpiEvent(payload: AnalyticsKpiEventPayload): void {
  const entry = {
    scope: ANALYTICS_KPI_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: payload.userId ?? "unknown",
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${ANALYTICS_KPI_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
