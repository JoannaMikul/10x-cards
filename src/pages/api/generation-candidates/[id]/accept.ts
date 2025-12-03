import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { DEFAULT_USER_ID, supabaseClient } from "../../../../db/supabase.client.ts";
import {
  CANDIDATE_ACCEPT_ERROR_CODES,
  buildErrorResponse,
  mapAcceptCandidateDbError,
  type CandidateAcceptErrorCode,
} from "../../../../lib/errors.ts";
import {
  acceptCandidateForOwner,
  getCandidateForOwner,
  hasFingerprintConflict,
} from "../../../../lib/services/generation-candidates.service.ts";
import {
  acceptGenerationCandidateSchema,
  getCandidateParamsSchema,
} from "../../../../lib/validation/generation-candidates.schema.ts";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const EVENT_SCOPE = "api/generation-candidates/:id/accept";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ACCEPT_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordAcceptEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const paramsValidation = getCandidateParamsSchema.safeParse(params);
  if (!paramsValidation.success) {
    const descriptor = buildErrorResponse(
      400,
      CANDIDATE_ACCEPT_ERROR_CODES.INVALID_BODY,
      paramsValidation.error.issues[0]?.message ?? "Candidate id is invalid."
    );
    recordAcceptEvent({
      severity: "info",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "invalid_params", params },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  let rawPayload: unknown;
  try {
    rawPayload = await parseJsonBody(request);
  } catch {
    return invalidBodyResponse("Request body must be valid JSON.", { reason: "invalid_json" });
  }

  const bodyValidation = acceptGenerationCandidateSchema.safeParse(rawPayload ?? {});
  if (!bodyValidation.success) {
    const message = bodyValidation.error.issues.map((issue) => issue.message).join("; ") || "Request body is invalid.";
    return invalidBodyResponse(message, {
      reason: "schema_validation_failed",
      issues: bodyValidation.error.issues,
    });
  }

  const userId = DEFAULT_USER_ID;
  const candidateId = paramsValidation.data.id;
  const overrides = bodyValidation.data;

  try {
    const candidate = await getCandidateForOwner(supabase, userId, candidateId);

    if (!candidate) {
      const descriptor = buildErrorResponse(
        404,
        CANDIDATE_ACCEPT_ERROR_CODES.NOT_FOUND,
        "Generation candidate could not be found."
      );
      recordAcceptEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        details: { reason: "candidate_not_found", candidateId, userId },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (candidate.accepted_card_id) {
      const descriptor = buildErrorResponse(
        409,
        CANDIDATE_ACCEPT_ERROR_CODES.ALREADY_ACCEPTED,
        "The generation candidate has already been accepted."
      );
      recordAcceptEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        details: { reason: "candidate_already_accepted", candidateId, accepted_card_id: candidate.accepted_card_id },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const fingerprint = candidate.front_back_fingerprint;
    if (!fingerprint) {
      const descriptor = buildErrorResponse(
        500,
        CANDIDATE_ACCEPT_ERROR_CODES.UNEXPECTED_ERROR,
        "Candidate fingerprint is missing."
      );
      recordAcceptEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        details: { reason: "missing_fingerprint", candidateId },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const conflict = await hasFingerprintConflict(supabase, userId, fingerprint);
    if (conflict) {
      const descriptor = buildErrorResponse(
        422,
        CANDIDATE_ACCEPT_ERROR_CODES.FINGERPRINT_CONFLICT,
        "A flashcard with the same content already exists."
      );
      recordAcceptEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        details: { reason: "fingerprint_conflict", candidateId, fingerprint },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const flashcard = await acceptCandidateForOwner(supabase, userId, candidate, overrides);

    recordAcceptEvent({
      severity: "info",
      status: 201,
      code: "accepted" as CandidateAcceptErrorCode,
      details: { candidateId, flashcardId: flashcard.id },
    });

    return jsonResponse(201, flashcard);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = mapAcceptCandidateDbError(error);
      recordAcceptEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
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
      CANDIDATE_ACCEPT_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while accepting the generation candidate."
    );
    recordAcceptEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: {
        reason: "unexpected_accept_error",
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

function invalidBodyResponse(message: string, details?: Record<string, unknown>): Response {
  const descriptor = buildErrorResponse(400, CANDIDATE_ACCEPT_ERROR_CODES.INVALID_BODY, message);
  recordAcceptEvent({
    severity: "info",
    status: descriptor.status,
    code: descriptor.body.error.code,
    details: { ...(details ?? {}), message },
  });
  return jsonResponse(descriptor.status, descriptor.body);
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(
    error && typeof error === "object" && "code" in error && typeof (error as Record<string, unknown>).code === "string"
  );
}

interface AcceptEventPayload {
  severity: "info" | "error";
  status: number;
  code: CandidateAcceptErrorCode | "accepted";
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
function recordAcceptEvent(payload: AcceptEventPayload): void {
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
