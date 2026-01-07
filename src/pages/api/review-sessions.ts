import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../../db/database.types";
import { DEFAULT_USER_ID, supabaseClient } from "../../db/supabase.client";
import {
  REVIEW_ERROR_CODES,
  buildErrorResponse,
  mapReviewDbError,
  type ReviewErrorCode,
  type HttpErrorDescriptor,
} from "../../lib/errors";
import { createReviewSession, ReviewCardNotFoundError } from "../../lib/services/review-sessions.service";
import { createReviewSessionSchema } from "../../lib/validation/review-sessions.schema";
import type { CreateReviewSessionCommand } from "../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const REVIEW_SESSION_EVENT_SCOPE = "api/review-sessions";

export const POST: APIRoute = async ({ locals, request }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      REVIEW_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordReviewSessionEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, REVIEW_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordReviewSessionEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.success) {
    recordReviewSessionEvent({
      severity: "info",
      status: bodyResult.error.status,
      code: bodyResult.error.body.error.code,
      details: { reason: "invalid_json_body" },
    });
    return jsonResponse(bodyResult.error.status, bodyResult.error.body);
  }

  const validationResult = createReviewSessionSchema.safeParse(bodyResult.data);
  if (!validationResult.success) {
    const descriptor = buildErrorResponse(
      400,
      REVIEW_ERROR_CODES.INVALID_BODY,
      validationResult.error.issues.map((issue) => issue.message).join("; ") || "Request body is invalid."
    );
    recordReviewSessionEvent({
      severity: "info",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "schema_validation_failed" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const command: CreateReviewSessionCommand = validationResult.data;
  const userId = locals.user.id;

  try {
    const result = await createReviewSession(supabase, userId, command);

    recordReviewSessionEvent({
      severity: "info",
      status: 201,
      code: "success",
      userId,
      details: { logged: result.logged },
    });

    return jsonResponse(201, result);
  } catch (error) {
    if (error instanceof ReviewCardNotFoundError) {
      const descriptor = buildErrorResponse(404, error.code, error.message);
      recordReviewSessionEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        details: { reason: "card_not_found" },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (isPostgrestError(error)) {
      const descriptor = mapReviewDbError();
      recordReviewSessionEvent({
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
      "Unexpected error while processing review session."
    );
    recordReviewSessionEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      details: { reason: "unexpected_non_pg_error", message: error instanceof Error ? error.message : String(error) },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

async function readJsonBody(
  request: Request
): Promise<{ success: true; data: unknown } | { success: false; error: HttpErrorDescriptor<ReviewErrorCode> }> {
  try {
    const data = await request.json();
    return { success: true, data };
  } catch {
    return {
      success: false,
      error: buildErrorResponse(400, REVIEW_ERROR_CODES.INVALID_BODY, "Request body must be valid JSON."),
    };
  }
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

interface ReviewSessionEventPayload {
  severity: "info" | "error";
  status: number;
  code: string;
  userId?: string;
  details?: Json;
}

/* eslint-disable no-console */
function recordReviewSessionEvent(payload: ReviewSessionEventPayload): void {
  const entry = {
    scope: REVIEW_SESSION_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: payload.userId ?? DEFAULT_USER_ID,
    ...payload,
  };

  console.log(JSON.stringify(entry));
}
