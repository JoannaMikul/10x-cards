import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseClient } from "../../db/supabase.client.ts";
import { REVIEW_ERROR_CODES, buildErrorResponse, mapReviewDbError } from "../../lib/errors.ts";
import { getReviewStats } from "../../lib/services/review-sessions.service.ts";
import { reviewStatsQuerySchema } from "../../lib/validation/review-sessions.schema.ts";
import type { ReviewStatsListResponse } from "../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const REVIEW_STATS_EVENT_SCOPE = "api/review-stats";

export const GET: APIRoute = async ({ locals, url }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      REVIEW_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordReviewStatsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, REVIEW_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordReviewStatsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  // Parse query parameters
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const validationResult = reviewStatsQuerySchema.safeParse(queryParams);

  if (!validationResult.success) {
    const descriptor = buildErrorResponse(
      400,
      REVIEW_ERROR_CODES.INVALID_QUERY,
      validationResult.error.issues.map((issue) => issue.message).join("; ") || "Query parameters are invalid."
    );
    recordReviewStatsEvent({
      severity: "info",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "query_validation_failed" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const query = validationResult.data;
  const userId = locals.user.id;

  try {
    const result: ReviewStatsListResponse = await getReviewStats(supabase, userId, query);

    recordReviewStatsEvent({
      severity: "info",
      status: 200,
      code: "success",
      userId,
      details: { count: result.data.length, has_more: result.page.has_more },
    });

    return jsonResponse(200, result);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = mapReviewDbError();
      recordReviewStatsEvent({
        severity: descriptor.status >= 500 ? "error" : "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        details: { db_code: error.code },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      REVIEW_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while fetching review stats."
    );
    recordReviewStatsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      details: { reason: "unexpected_non_pg_error", message: error instanceof Error ? error.message : String(error) },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

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

interface ReviewStatsEventPayload {
  severity: "info" | "error";
  status: number;
  code: string;
  userId?: string;
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
function recordReviewStatsEvent(payload: ReviewStatsEventPayload): void {
  const entry = {
    scope: REVIEW_STATS_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: payload.userId ?? "anonymous",
    ...payload,
  };

  console.log(JSON.stringify(entry));
}
