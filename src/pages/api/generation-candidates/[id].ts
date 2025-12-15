import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { DEFAULT_USER_ID, supabaseClient } from "../../../db/supabase.client.ts";
import {
  CANDIDATE_ERROR_CODES,
  buildErrorResponse,
  mapCandidateDbError,
  type CandidateErrorCode,
} from "../../../lib/errors.ts";
import { updateCandidateForOwner } from "../../../lib/services/generation-candidates.service.ts";
import {
  getCandidateParamsSchema,
  updateGenerationCandidateSchema,
  type UpdateGenerationCandidateSchema,
} from "../../../lib/validation/generation-candidates.schema.ts";
import type { UpdateGenerationCandidateCommand } from "../../../types";
import type { ZodIssue } from "zod";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const EVENT_SCOPE = "api/generation-candidates/:id";

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordUpdateEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR, "User not authenticated.");
    recordUpdateEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const paramsValidation = getCandidateParamsSchema.safeParse(params);
  if (!paramsValidation.success) {
    return invalidParamsResponse(paramsValidation.error.issues[0]?.message ?? "Candidate id is invalid.", params);
  }

  let rawPayload: unknown;
  try {
    rawPayload = await parseJsonBody(request);
  } catch {
    return invalidBodyResponse("Request body must be valid JSON.", { reason: "invalid_json" });
  }

  const bodyValidation = updateGenerationCandidateSchema.safeParse(rawPayload ?? {});
  if (!bodyValidation.success) {
    const issues = bodyValidation.error.issues.map((issue: ZodIssue) => ({
      message: issue.message,
      path: issue.path,
    }));
    const message = issues.map((issue) => issue.message).join("; ") || "Request body is invalid.";
    return invalidBodyResponse(message, {
      reason: "schema_validation_failed",
      issues,
    });
  }

  const command = buildUpdateCommand(bodyValidation.data);
  const candidateId = paramsValidation.data.id;
  const userId = locals.user.id;

  try {
    const candidate = await updateCandidateForOwner(supabase, userId, candidateId, {
      ...command,
      updated_at: new Date().toISOString(),
    });

    if (!candidate) {
      const descriptor = buildErrorResponse(
        404,
        CANDIDATE_ERROR_CODES.NOT_FOUND,
        "Generation candidate could not be found or cannot be updated."
      );
      recordUpdateEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        details: { reason: "candidate_not_updatable", candidateId, userId },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    recordUpdateEvent({
      severity: "info",
      status: 200,
      code: "updated",
      details: { candidateId },
    });

    return jsonResponse(200, { candidate });
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = mapCandidateDbError(error);
      recordUpdateEvent({
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
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while updating the generation candidate."
    );
    recordUpdateEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: {
        reason: "unexpected_update_error",
        candidateId,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

function buildUpdateCommand(payload: UpdateGenerationCandidateSchema): UpdateGenerationCandidateCommand {
  const command: UpdateGenerationCandidateCommand = {};

  if (payload.front !== undefined) {
    command.front = payload.front;
  }

  if (payload.back !== undefined) {
    command.back = payload.back;
  }

  if (payload.status !== undefined) {
    command.status = payload.status;
  } else if (payload.front !== undefined || payload.back !== undefined) {
    command.status = "edited";
  }

  return command;
}

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

function invalidParamsResponse(message: string, params: Record<string, unknown>): Response {
  const descriptor = buildErrorResponse(400, CANDIDATE_ERROR_CODES.INVALID_PARAMS, message);
  recordUpdateEvent({
    severity: "info",
    status: descriptor.status,
    code: descriptor.body.error.code,
    details: { reason: "invalid_params", params },
  });
  return jsonResponse(descriptor.status, descriptor.body);
}

function invalidBodyResponse(message: string, details?: Record<string, unknown>): Response {
  const descriptor = buildErrorResponse(400, CANDIDATE_ERROR_CODES.INVALID_BODY, message);
  recordUpdateEvent({
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

interface CandidateUpdateEventPayload {
  severity: "info" | "error";
  status: number;
  code: CandidateErrorCode | "updated";
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
function recordUpdateEvent(payload: CandidateUpdateEventPayload): void {
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
