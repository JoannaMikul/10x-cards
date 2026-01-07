import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseClient } from "../../../../db/supabase.client";
import {
  CANDIDATE_ERROR_CODES,
  buildErrorResponse,
  mapCandidateDbError,
  type CandidateErrorCode,
} from "../../../../lib/errors";
import { getCandidateForOwner, rejectCandidateForOwner } from "../../../../lib/services/generation-candidates.service";
import {
  getCandidateParamsSchema,
  rejectGenerationCandidateSchema,
} from "../../../../lib/validation/generation-candidates.schema";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const EVENT_SCOPE = "api/generation-candidates/:id/reject";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordRejectEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId: locals.user?.id || "",
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR, "User not authenticated.");
    recordRejectEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId: "",
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const paramsValidation = getCandidateParamsSchema.safeParse(params);
  if (!paramsValidation.success) {
    return invalidParamsResponse(
      paramsValidation.error.issues[0]?.message ?? "Candidate id is invalid.",
      params,
      locals.user.id
    );
  }

  let rawPayload: unknown = {};
  try {
    rawPayload = await parseJsonBody(request);
  } catch {
    return invalidBodyResponse("Request body must be valid JSON.", { reason: "invalid_json" }, locals.user.id);
  }

  const bodyValidation = rejectGenerationCandidateSchema.safeParse(rawPayload ?? {});
  if (!bodyValidation.success) {
    const message = bodyValidation.error.issues[0]?.message ?? "Request body must be empty.";
    return invalidBodyResponse(
      message,
      {
        reason: "schema_validation_failed",
        issues: bodyValidation.error.issues,
      },
      locals.user.id
    );
  }

  const userId = locals.user.id;
  const candidateId = paramsValidation.data.id;

  try {
    const candidate = await rejectCandidateForOwner(supabase, userId, candidateId);

    if (candidate) {
      recordRejectEvent({
        severity: "info",
        status: 200,
        code: "rejected",
        userId,
        details: { candidateId, outcome: "rejected" },
      });
      return jsonResponse(200, { candidate });
    }

    const existingCandidate = await getCandidateForOwner(supabase, userId, candidateId);

    if (!existingCandidate) {
      const descriptor = buildErrorResponse(
        404,
        CANDIDATE_ERROR_CODES.NOT_FOUND,
        "Generation candidate could not be found."
      );
      recordRejectEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        details: { reason: "candidate_not_found", candidateId },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (existingCandidate.status === "accepted" || existingCandidate.accepted_card_id) {
      const descriptor = buildErrorResponse(
        409,
        CANDIDATE_ERROR_CODES.INVALID_TRANSITION,
        "Accepted generation candidates cannot be rejected."
      );
      recordRejectEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        details: { reason: "invalid_transition", candidateId, currentStatus: existingCandidate.status },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (existingCandidate.status === "rejected") {
      recordRejectEvent({
        severity: "info",
        status: 200,
        code: "rejected",
        userId,
        details: { candidateId, outcome: "already_rejected" },
      });
      return jsonResponse(200, { candidate: existingCandidate });
    }

    const descriptor = buildErrorResponse(
      404,
      CANDIDATE_ERROR_CODES.NOT_FOUND,
      "Generation candidate could not be rejected."
    );
    recordRejectEvent({
      severity: "info",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      details: { reason: "candidate_not_rejectable", candidateId, status: existingCandidate.status },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = mapCandidateDbError(error);
      recordRejectEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        details: {
          reason: "postgrest_error",
          db_code: error.code,
          candidateId,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while rejecting the generation candidate."
    );
    recordRejectEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      details: {
        reason: "unexpected_reject_error",
        candidateId,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

async function parseJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function invalidParamsResponse(message: string, params: Record<string, unknown>, userId: string): Response {
  const descriptor = buildErrorResponse(400, CANDIDATE_ERROR_CODES.INVALID_PARAMS, message);
  recordRejectEvent({
    severity: "info",
    status: descriptor.status,
    code: descriptor.body.error.code,
    userId,
    details: { reason: "invalid_params", params },
  });
  return jsonResponse(descriptor.status, descriptor.body);
}

function invalidBodyResponse(message: string, details?: Record<string, unknown>, userId?: string): Response {
  const descriptor = buildErrorResponse(400, CANDIDATE_ERROR_CODES.INVALID_BODY, message);
  recordRejectEvent({
    severity: "info",
    status: descriptor.status,
    code: descriptor.body.error.code,
    userId: userId || "",
    details: { ...(details ?? {}), message },
  });
  return jsonResponse(descriptor.status, descriptor.body);
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(
    error && typeof error === "object" && "code" in error && typeof (error as Record<string, unknown>).code === "string"
  );
}

interface CandidateRejectEventPayload {
  severity: "info" | "error";
  status: number;
  code: CandidateErrorCode | "rejected";
  userId: string;
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
function recordRejectEvent(payload: CandidateRejectEventPayload): void {
  const entry = {
    scope: EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
