import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

import type { Enums } from "../../db/database.types.ts";
import { supabaseClient } from "../../db/supabase.client.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import {
  GENERATION_ERROR_CODES,
  buildErrorResponse,
  mapGenerationDbError,
  type GenerationErrorCode,
  type HttpErrorDescriptor,
} from "../../lib/errors.ts";
import { logGenerationError } from "../../lib/services/error-logs.service.ts";
import { sanitizeSourceText, startGeneration } from "../../lib/services/generations.service.ts";
import {
  MAX_SANITIZED_TEXT_LENGTH,
  MIN_SANITIZED_TEXT_LENGTH,
  createGenerationSchema,
} from "../../lib/validation/generations.schema.ts";
import type { CreateGenerationCommand } from "../../types";
import { projectGeneration } from "../../lib/services/generation-projection.service.ts";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const ACTIVE_STATUSES: readonly Enums<"generation_status">[] = ["pending", "running"];

export const GET: APIRoute = async (context) => {
  const { locals, url } = context;
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      GENERATION_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordGenerationEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, GENERATION_ERROR_CODES.UNEXPECTED_ERROR, "User not authenticated.");
    recordGenerationEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const userId = locals.user.id;
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const showAll = url.searchParams.get("all") === "true";

  try {
    let query = supabase
      .from("generations")
      .select(
        `
        id,
        user_id,
        model,
        status,
        temperature,
        prompt_tokens,
        sanitized_input_length,
        sanitized_input_sha256,
        sanitized_input_text,
        started_at,
        completed_at,
        created_at,
        updated_at,
        error_code,
        error_message
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // If not showing all, filter to active generations only
    if (!showAll) {
      query = query.in("status", [...ACTIVE_STATUSES]);
    }

    const { data, error } = await query;

    if (error) {
      const descriptor = mapGenerationDbError(error);
      recordGenerationEvent({
        outcome: descriptor.body.error.code,
        status: descriptor.status,
        details: { db_code: error.code },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const generations = data.map(projectGeneration);
    recordGenerationEvent({
      outcome: "retrieved",
      status: 200,
      userId,
      details: { count: generations.length },
    });

    return jsonResponse(200, { generations });
  } catch {
    const descriptor = buildErrorResponse(
      500,
      GENERATION_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while retrieving active generations."
    );
    recordGenerationEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "unexpected_error" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

export const POST: APIRoute = async (context) => {
  const { locals, request } = context;
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      GENERATION_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordGenerationEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, GENERATION_ERROR_CODES.UNEXPECTED_ERROR, "User not authenticated.");
    recordGenerationEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.success) {
    recordGenerationEvent({
      outcome: bodyResult.error.body.error.code,
      status: bodyResult.error.status,
      details: { reason: "invalid_json_body" },
    });
    return jsonResponse(bodyResult.error.status, bodyResult.error.body);
  }

  const validationResult = createGenerationSchema.safeParse(bodyResult.data);
  if (!validationResult.success) {
    const descriptor = buildErrorResponse(
      400,
      GENERATION_ERROR_CODES.INVALID_PAYLOAD,
      validationResult.error.issues.map((issue) => issue.message).join("; ")
    );
    recordGenerationEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      details: { reason: "schema_validation_failed" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const parsedPayload = validationResult.data;
  const sanitizedInput = sanitizeSourceText(parsedPayload.sanitized_input_text);
  const sourceTextHash = createSourceTextHash(sanitizedInput);
  const sourceTextLength = sanitizedInput.length;

  if (sanitizedInput.length < MIN_SANITIZED_TEXT_LENGTH || sanitizedInput.length > MAX_SANITIZED_TEXT_LENGTH) {
    const descriptor = buildErrorResponse(
      400,
      GENERATION_ERROR_CODES.LENGTH_OUT_OF_RANGE,
      `Sanitized input length must be between ${MIN_SANITIZED_TEXT_LENGTH} and ${MAX_SANITIZED_TEXT_LENGTH} characters.`
    );
    recordGenerationEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      model: parsedPayload.model,
      sourceHash: sourceTextHash,
      sourceLength: sourceTextLength,
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const command: CreateGenerationCommand = {
    model: parsedPayload.model,
    sanitized_input_text: sanitizedInput,
    temperature: parsedPayload.temperature,
  };

  const userId = locals.user.id;

  const activeCheck = await hasActiveGeneration(supabase, userId);
  if (!activeCheck.success) {
    return handlePostgrestFailure(
      supabase,
      command,
      { hash: sourceTextHash, length: sourceTextLength },
      userId,
      activeCheck.error
    );
  }

  if (activeCheck.data) {
    await logGenerationError(supabase, {
      user_id: userId,
      model: command.model,
      error_code: GENERATION_ERROR_CODES.ACTIVE_REQUEST_EXISTS,
      error_message: "Active generation already exists.",
      source_text_hash: sourceTextHash,
      source_text_length: sourceTextLength,
    });

    const descriptor = buildErrorResponse(
      409,
      GENERATION_ERROR_CODES.ACTIVE_REQUEST_EXISTS,
      "An active generation request is already in progress."
    );
    recordGenerationEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      userId,
      model: command.model,
      sourceHash: sourceTextHash,
      sourceLength: sourceTextLength,
      details: { origin: "optimistic_conflict" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    const enqueued = await startGeneration(supabase, userId, command);
    recordGenerationEvent({
      outcome: "accepted",
      status: 202,
      userId,
      model: command.model,
      sourceHash: sourceTextHash,
      sourceLength: sourceTextLength,
    });

    return jsonResponse(202, {
      id: enqueued.id,
      status: "pending",
      enqueued_at: enqueued.created_at,
    });
  } catch (error) {
    if (isPostgrestError(error)) {
      return handlePostgrestFailure(
        supabase,
        command,
        { hash: sourceTextHash, length: sourceTextLength },
        userId,
        error
      );
    }

    await logGenerationError(supabase, {
      user_id: userId,
      model: command.model,
      error_code: GENERATION_ERROR_CODES.UNEXPECTED_ERROR,
      error_message: error instanceof Error ? error.message : "Unknown error",
      source_text_hash: sourceTextHash,
      source_text_length: sourceTextLength,
    });

    const descriptor = buildErrorResponse(
      500,
      GENERATION_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while starting the generation."
    );
    recordGenerationEvent({
      outcome: descriptor.body.error.code,
      status: descriptor.status,
      userId,
      model: command.model,
      sourceHash: sourceTextHash,
      sourceLength: sourceTextLength,
      details: { reason: "unexpected_non_pg_error" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

async function hasActiveGeneration(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: true; data: boolean } | { success: false; error: PostgrestError }> {
  const { data, error } = await supabase
    .from("generations")
    .select("id")
    .eq("user_id", userId)
    .in("status", [...ACTIVE_STATUSES])
    .limit(1)
    .maybeSingle();

  if (error) {
    return { success: false, error };
  }

  return { success: true, data: Boolean(data) };
}

function createSourceTextHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64");
}

async function handlePostgrestFailure(
  supabase: SupabaseClient,
  command: CreateGenerationCommand,
  source: { hash: string; length: number },
  userId: string,
  error: PostgrestError
): Promise<Response> {
  const descriptor = mapGenerationDbError(error);

  if ([409, 429, 500].includes(descriptor.status)) {
    await logGenerationError(supabase, {
      user_id: userId,
      model: command.model,
      error_code: descriptor.body.error.code,
      error_message: descriptor.body.error.message,
      source_text_hash: source.hash,
      source_text_length: source.length,
    });
  }

  recordGenerationEvent({
    outcome: descriptor.body.error.code,
    status: descriptor.status,
    userId,
    model: command.model,
    sourceHash: source.hash,
    sourceLength: source.length,
    details: { db_code: error.code },
  });

  return jsonResponse(descriptor.status, descriptor.body);
}

async function readJsonBody(
  request: Request
): Promise<{ success: true; data: unknown } | { success: false; error: HttpErrorDescriptor<GenerationErrorCode> }> {
  try {
    const data = await request.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: buildErrorResponse(
        400,
        GENERATION_ERROR_CODES.INVALID_PAYLOAD,
        "Request body must be valid JSON.",
        error instanceof Error ? { message: error.message } : undefined
      ),
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

type GenerationEventOutcome = GenerationErrorCode | "accepted" | "retrieved";

interface GenerationEventPayload {
  outcome: GenerationEventOutcome;
  status: number;
  userId?: string;
  model?: string;
  sourceHash?: string;
  sourceLength?: number;
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
function recordGenerationEvent(payload: GenerationEventPayload): void {
  const entry = {
    scope: "api/generations",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const logger = payload.status >= 500 ? console.error : console.info;
  logger("[api/generations]", JSON.stringify(entry));
}
/* eslint-enable no-console */
