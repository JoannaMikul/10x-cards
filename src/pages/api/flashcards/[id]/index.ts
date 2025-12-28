import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../../../../db/database.types.ts";
import { DEFAULT_USER_ID, supabaseClient } from "../../../../db/supabase.client.ts";
import {
  FLASHCARD_ERROR_CODES,
  buildErrorResponse,
  mapFlashcardDbError,
  type HttpErrorDescriptor,
  type FlashcardErrorCode,
} from "../../../../lib/errors.ts";
import {
  getFlashcardById,
  updateFlashcard,
  softDeleteFlashcard,
  FlashcardReferenceError,
} from "../../../../lib/services/flashcards.service.ts";
import {
  flashcardIdParamSchema,
  parseFlashcardId,
  updateFlashcardSchema,
} from "../../../../lib/validation/flashcards.schema.ts";

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
export const PATCH: APIRoute = async ({ locals, params, request }) => {
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

  const userId = locals.user?.id ?? DEFAULT_USER_ID;

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

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.success) {
    recordFlashcardsEvent({
      severity: "error",
      status: bodyResult.error.status,
      code: bodyResult.error.body.error.code,
      userId,
      cardId,
      details: { reason: "invalid_json_body" },
    });
    return jsonResponse(bodyResult.error.status, bodyResult.error.body);
  }

  const bodyValidationResult = updateFlashcardSchema.safeParse(bodyResult.data);
  if (!bodyValidationResult.success) {
    const descriptor = buildErrorResponse(400, FLASHCARD_ERROR_CODES.INVALID_BODY, "Invalid request body.");
    recordFlashcardsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      cardId,
      details: {
        validation_errors: bodyValidationResult.error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path,
        })),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const updateCommand = {
    ...bodyValidationResult.data,
    deleted_at: bodyValidationResult.data.deleted_at === true ? null : bodyValidationResult.data.deleted_at,
  };

  try {
    const updatedFlashcard = await updateFlashcard(supabase, userId, cardId, updateCommand);

    recordFlashcardsEvent({
      severity: "info",
      status: 200,
      code: "success",
      userId,
      cardId,
    });

    return jsonResponse(200, updatedFlashcard);
  } catch (error) {
    if (error instanceof FlashcardReferenceError) {
      let status = 422;
      if (
        error.code === FLASHCARD_ERROR_CODES.CATEGORY_NOT_FOUND ||
        error.code === FLASHCARD_ERROR_CODES.SOURCE_NOT_FOUND ||
        error.code === FLASHCARD_ERROR_CODES.TAG_NOT_FOUND
      ) {
        status = 404;
      }
      const descriptor = buildErrorResponse(status, error.code, error.message, error.details);
      recordFlashcardsEvent({
        severity: "warning",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        cardId,
        details: error.details,
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
      "An unexpected error occurred while updating the flashcard."
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

async function readJsonBody(
  request: Request
): Promise<{ success: true; data: unknown } | { success: false; error: HttpErrorDescriptor<FlashcardErrorCode> }> {
  try {
    const data = await request.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: buildErrorResponse(
        400,
        FLASHCARD_ERROR_CODES.INVALID_BODY,
        "Request body must be valid JSON.",
        error instanceof Error ? { message: error.message } : undefined
      ),
    };
  }
}

export const DELETE: APIRoute = async ({ locals, params }) => {
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

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, FLASHCARD_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordFlashcardsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const userId = locals.user.id;

  const idValidationResult = flashcardIdParamSchema.safeParse(params);
  if (!idValidationResult.success) {
    const descriptor = buildErrorResponse(400, FLASHCARD_ERROR_CODES.INVALID_QUERY, "Invalid flashcard ID parameter.");
    recordFlashcardsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      cardId: params.id as string,
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const cardId = parseFlashcardId(idValidationResult.data);

  try {
    await softDeleteFlashcard(supabase, userId, cardId);

    recordFlashcardsEvent({
      severity: "info",
      status: 204,
      code: "success",
      userId,
      cardId,
    });

    return new Response(null, { status: 204 });
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
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      FLASHCARD_ERROR_CODES.UNEXPECTED_ERROR,
      "An unexpected error occurred while deleting the flashcard."
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
