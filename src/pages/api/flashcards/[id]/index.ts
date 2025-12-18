import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../../../../db/database.types.ts";
import { DEFAULT_USER_ID, supabaseClient } from "../../../../db/supabase.client.ts";
import { FLASHCARD_ERROR_CODES, buildErrorResponse, mapFlashcardDbError } from "../../../../lib/errors.ts";
import { getFlashcardById } from "../../../../lib/services/flashcards.service.ts";
import { flashcardIdParamSchema, parseFlashcardId } from "../../../../lib/validation/flashcards.schema.ts";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const FLASHCARD_EVENT_SCOPE = "api/flashcards";

export const GET: APIRoute = async ({ locals, params }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      FLASHCARD_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordFlashcardsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  // In development, use DEFAULT_USER_ID if no authenticated user
  const userId = locals.user?.id ?? DEFAULT_USER_ID;

  // Validate flashcard ID parameter
  const idValidationResult = flashcardIdParamSchema.safeParse(params);
  if (!idValidationResult.success) {
    const descriptor = buildErrorResponse(400, FLASHCARD_ERROR_CODES.INVALID_QUERY, "Invalid flashcard ID parameter.");
    recordFlashcardsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      cardId: params.id as string,
      details: {
        validation_errors: idValidationResult.error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path,
        })),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const cardId = parseFlashcardId(idValidationResult.data);

  try {
    const flashcard = await getFlashcardById(supabase, userId, cardId);

    recordFlashcardsEvent({
      severity: "info",
      status: 200,
      code: "success",
      userId,
      cardId,
    });

    return jsonResponse(200, flashcard);
  } catch (error) {
    if (error instanceof Error && error.message === "Flashcard not found") {
      const descriptor = buildErrorResponse(404, FLASHCARD_ERROR_CODES.NOT_FOUND, "Flashcard not found.");
      recordFlashcardsEvent({
        severity: "warning",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        cardId,
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if ((error as PostgrestError).code) {
      const descriptor = mapFlashcardDbError(error as PostgrestError);
      recordFlashcardsEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        cardId,
        db_code: (error as PostgrestError).code,
        details: { db_message: (error as PostgrestError).message },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      FLASHCARD_ERROR_CODES.UNEXPECTED_ERROR,
      "An unexpected error occurred while retrieving the flashcard."
    );
    recordFlashcardsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      cardId,
      details: { error_message: error instanceof Error ? error.message : "Unknown error" },
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

interface FlashcardEventPayload {
  severity: "info" | "warning" | "error";
  status: number;
  code: string;
  userId?: string;
  cardId?: string;
  db_code?: string;
  details?: Json;
}

/* eslint-disable no-console */
function recordFlashcardsEvent(payload: FlashcardEventPayload): void {
  const entry = {
    scope: FLASHCARD_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: payload.userId ?? DEFAULT_USER_ID,
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${FLASHCARD_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
