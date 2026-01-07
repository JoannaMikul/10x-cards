import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseClient } from "../../../db/supabase.client";
import type { SupabaseClient } from "../../../db/supabase.client";
import {
  GENERATION_ERROR_CODES,
  buildErrorResponse,
  type GenerationErrorCode,
  type HttpErrorDescriptor,
} from "../../../lib/errors";
import { logGenerationError } from "../../../lib/services/error-logs.service";
import {
  cancelGenerationIfActive,
  getCandidatesStatuses,
  getGenerationById,
  type GenerationCandidatesSummary,
  type GenerationRecord,
} from "../../../lib/services/generations.service";
import { projectGeneration, type GenerationResponseShape } from "../../../lib/services/generation-projection.service";
import { getGenerationParamsSchema, updateGenerationSchema } from "../../../lib/validation/generations.schema";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const EVENT_SCOPE = "api/generations/:id";

interface GetGenerationResponse {
  generation: GenerationResponseShape;
  candidates_summary: GenerationCandidatesSummary;
}

interface UpdateGenerationResponse {
  generation: Pick<GenerationRecord, "id" | "status" | "completed_at" | "updated_at">;
}

export const GET: APIRoute = async ({ locals, params }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      GENERATION_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordGenerationDetailEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, GENERATION_ERROR_CODES.UNEXPECTED_ERROR, "User not authenticated.");
    recordGenerationDetailEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const validationResult = getGenerationParamsSchema.safeParse({ id: params?.id });
  if (!validationResult.success) {
    const descriptor = buildErrorResponse(
      400,
      GENERATION_ERROR_CODES.INVALID_PARAMS,
      validationResult.error.issues.map((issue) => issue.message).join("; ") || "Invalid generation id."
    );
    recordGenerationDetailEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      userId: locals.user.id,
      details: { reason: "invalid_params" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const { id } = validationResult.data;
  const userId = locals.user.id;

  let generation: GenerationRecord | null = null;

  try {
    generation = await getGenerationById(supabase, userId, id);

    if (!generation) {
      const descriptor = buildErrorResponse(404, GENERATION_ERROR_CODES.NOT_FOUND, "Generation could not be found.");
      recordGenerationDetailEvent({
        outcome: descriptor.body.error.code,
        status: descriptor.status,
        userId,
        generationId: id,
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const candidatesSummary = await getCandidatesStatuses(supabase, userId, id);
    const response: GetGenerationResponse = {
      generation: projectGeneration(generation),
      candidates_summary: candidatesSummary,
    };

    recordGenerationDetailEvent({
      outcome: "retrieved",
      status: 200,
      userId,
      generationId: id,
      model: generation.model,
      sourceHash: generation.sanitized_input_sha256 ?? undefined,
      sourceLength: generation.sanitized_input_length ?? undefined,
    });

    return jsonResponse(200, response);
  } catch (error) {
    return handleGenerationFailure(supabase, {
      error,
      userId,
      generationId: id,
      generation,
    });
  }
};

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      GENERATION_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordGenerationDetailEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, GENERATION_ERROR_CODES.UNEXPECTED_ERROR, "User not authenticated.");
    recordGenerationDetailEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const paramsValidationResult = getGenerationParamsSchema.safeParse({ id: params?.id });
  if (!paramsValidationResult.success) {
    const descriptor = buildErrorResponse(
      400,
      GENERATION_ERROR_CODES.INVALID_PARAMS,
      paramsValidationResult.error.issues.map((issue) => issue.message).join("; ") || "Invalid generation id."
    );
    recordGenerationDetailEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      userId: locals.user.id,
      details: { reason: "invalid_params" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const { id } = paramsValidationResult.data;
  const userId = locals.user.id;

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    const descriptor = buildErrorResponse(400, GENERATION_ERROR_CODES.INVALID_PAYLOAD, "Invalid JSON payload.");
    recordGenerationDetailEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      userId,
      generationId: id,
      details: { reason: "invalid_json" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const bodyValidationResult = updateGenerationSchema.safeParse(requestBody);
  if (!bodyValidationResult.success) {
    const descriptor = buildErrorResponse(
      400,
      GENERATION_ERROR_CODES.INVALID_PAYLOAD,
      bodyValidationResult.error.issues.map((issue) => issue.message).join("; ") || "Invalid request body."
    );
    recordGenerationDetailEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      userId,
      generationId: id,
      details: { reason: "invalid_body" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  let generation: GenerationRecord | null = null;

  try {
    generation = await getGenerationById(supabase, userId, id);

    if (!generation) {
      const descriptor = buildErrorResponse(404, GENERATION_ERROR_CODES.NOT_FOUND, "Generation could not be found.");
      recordGenerationDetailEvent({
        outcome: descriptor.body.error.code,
        status: descriptor.status,
        userId,
        generationId: id,
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (generation.status !== "pending" && generation.status !== "running") {
      const descriptor = buildErrorResponse(
        409,
        GENERATION_ERROR_CODES.INVALID_TRANSITION,
        "Generation cannot be cancelled as it is not in an active state."
      );
      recordGenerationDetailEvent({
        outcome: descriptor.body.error.code,
        status: descriptor.status,
        userId,
        generationId: id,
        model: generation.model,
        details: { current_status: generation.status },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const updatedGeneration = await cancelGenerationIfActive(supabase, userId, id);

    if (!updatedGeneration) {
      const currentGeneration = await getGenerationById(supabase, userId, id);

      if (!currentGeneration) {
        const descriptor = buildErrorResponse(404, GENERATION_ERROR_CODES.NOT_FOUND, "Generation could not be found.");
        recordGenerationDetailEvent({
          outcome: descriptor.body.error.code,
          status: descriptor.status,
          userId,
          generationId: id,
        });
        return jsonResponse(descriptor.status, descriptor.body);
      }

      const descriptor = buildErrorResponse(
        409,
        GENERATION_ERROR_CODES.INVALID_TRANSITION,
        "Generation status changed during cancellation attempt."
      );
      recordGenerationDetailEvent({
        outcome: descriptor.body.error.code,
        status: descriptor.status,
        userId,
        generationId: id,
        model: currentGeneration.model,
        details: { final_status: currentGeneration.status },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const response: UpdateGenerationResponse = {
      generation: updatedGeneration,
    };

    recordGenerationDetailEvent({
      outcome: "cancelled",
      status: 200,
      userId,
      generationId: id,
      model: generation.model,
      sourceHash: generation.sanitized_input_sha256 ?? undefined,
      sourceLength: generation.sanitized_input_length ?? undefined,
    });

    return jsonResponse(200, response);
  } catch (error) {
    return handleGenerationFailure(supabase, {
      error,
      userId,
      generationId: id,
      generation,
    });
  }
};

async function handleGenerationFailure(
  supabase: SupabaseClient,
  context: {
    error: unknown;
    userId: string;
    generationId: string;
    generation: GenerationRecord | null;
  }
): Promise<Response> {
  if (isPostgrestError(context.error)) {
    const descriptor = buildDbErrorResponse(context.error);
    await logDetailedGenerationError(supabase, context.generation, descriptor);
    recordGenerationDetailEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      userId: context.userId,
      generationId: context.generationId,
      model: context.generation?.model,
      sourceHash: context.generation?.sanitized_input_sha256 ?? undefined,
      sourceLength: context.generation?.sanitized_input_length ?? undefined,
      details: { db_code: context.error.code },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const descriptor = buildErrorResponse(
    500,
    GENERATION_ERROR_CODES.UNEXPECTED_ERROR,
    "Unexpected error while fetching the generation.",
    context.error instanceof Error ? { message: context.error.message } : undefined
  );

  await logDetailedGenerationError(supabase, context.generation, descriptor);

  recordGenerationDetailEvent({
    outcome: descriptor.body.error.code,
    status: descriptor.status,
    userId: context.userId,
    generationId: context.generationId,
    model: context.generation?.model,
    sourceHash: context.generation?.sanitized_input_sha256 ?? undefined,
    sourceLength: context.generation?.sanitized_input_length ?? undefined,
    details: { reason: "unexpected_non_pg_error" },
  });

  return jsonResponse(descriptor.status, descriptor.body);
}

function buildDbErrorResponse(error: PostgrestError): HttpErrorDescriptor<GenerationErrorCode> {
  return buildErrorResponse(
    500,
    GENERATION_ERROR_CODES.DB_ERROR,
    "A database error occurred while retrieving the generation.",
    { db_code: error.code }
  );
}

async function logDetailedGenerationError(
  supabase: SupabaseClient,
  generation: GenerationRecord | null,
  descriptor: HttpErrorDescriptor<GenerationErrorCode>
): Promise<void> {
  if (!generation || !generation.sanitized_input_sha256 || typeof generation.sanitized_input_length !== "number") {
    return;
  }

  await logGenerationError(supabase, {
    user_id: generation.user_id,
    model: generation.model,
    error_code: descriptor.body.error.code,
    error_message: descriptor.body.error.message,
    source_text_hash: generation.sanitized_input_sha256,
    source_text_length: generation.sanitized_input_length,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function isPostgrestError(error: unknown): error is PostgrestError {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return typeof (error as Record<string, unknown>).code === "string";
}

type GenerationDetailEventOutcome = GenerationErrorCode | "retrieved" | "cancelled";

interface GenerationDetailEventPayload {
  outcome: GenerationDetailEventOutcome;
  status: number;
  userId?: string;
  generationId?: string;
  model?: string;
  sourceHash?: string;
  sourceLength?: number;
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
function recordGenerationDetailEvent(payload: GenerationDetailEventPayload): void {
  const entry = {
    scope: EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const logger = payload.status >= 500 ? console.error : console.info;
  logger(`[${EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
