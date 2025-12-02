import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { DEFAULT_USER_ID, supabaseClient, supabaseServiceClient } from "../../../db/supabase.client.ts";
import type { SupabaseClient } from "../../../db/supabase.client.ts";
import {
  GENERATION_ERROR_CODES,
  buildErrorResponse,
  type GenerationErrorCode,
  type HttpErrorDescriptor,
} from "../../../lib/errors.ts";
import { logGenerationError } from "../../../lib/services/error-logs.service.ts";
import {
  getCandidatesStatuses,
  getGenerationById,
  type GenerationCandidatesSummary,
  type GenerationRecord,
} from "../../../lib/services/generations.service.ts";
import { getGenerationParamsSchema } from "../../../lib/validation/generations.schema.ts";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const EVENT_SCOPE = "api/generations/:id";

type GenerationResponseShape = Pick<
  GenerationRecord,
  | "id"
  | "model"
  | "status"
  | "temperature"
  | "prompt_tokens"
  | "sanitized_input_length"
  | "started_at"
  | "completed_at"
  | "created_at"
  | "updated_at"
  | "error_code"
  | "error_message"
>;

interface GetGenerationResponse {
  generation: GenerationResponseShape;
  candidates_summary: GenerationCandidatesSummary;
}

export const GET: APIRoute = async ({ locals, params }) => {
  const supabase = supabaseServiceClient ?? locals.supabase ?? supabaseClient;

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
      details: { reason: "invalid_params" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const { id } = validationResult.data;
  const userId = DEFAULT_USER_ID;

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

function projectGeneration(generation: GenerationRecord): GenerationResponseShape {
  const {
    id,
    model,
    status,
    temperature,
    prompt_tokens,
    sanitized_input_length,
    started_at,
    completed_at,
    created_at,
    updated_at,
    error_code,
    error_message,
  } = generation;

  return {
    id,
    model,
    status,
    temperature,
    prompt_tokens,
    sanitized_input_length,
    started_at,
    completed_at,
    created_at,
    updated_at,
    error_code,
    error_message,
  };
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

type GenerationDetailEventOutcome = GenerationErrorCode | "retrieved";

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
