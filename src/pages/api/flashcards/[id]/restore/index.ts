import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../../../../../db/database.types.ts";
import { FLASHCARD_ERROR_CODES, buildErrorResponse, mapFlashcardDbError } from "../../../../../lib/errors.ts";
import {
  FlashcardNotFoundError,
  FlashcardUnauthorizedError,
  restoreFlashcard,
} from "../../../../../lib/services/flashcards.service.ts";
import { flashcardIdParamSchema, parseFlashcardId } from "../../../../../lib/validation/flashcards.schema.ts";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const RESTORE_EVENT_SCOPE = "api/flashcards/[id]/restore";

export const POST: APIRoute = async ({ locals, params }) => {
  const supabase = locals.supabase;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      FLASHCARD_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordRestoreEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, FLASHCARD_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordRestoreEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const idValidationResult = flashcardIdParamSchema.safeParse(params);
  if (!idValidationResult.success) {
    const descriptor = buildErrorResponse(400, FLASHCARD_ERROR_CODES.INVALID_QUERY, "Invalid flashcard ID parameter.");
    recordRestoreEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId: locals.user.id,
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
  const userId = locals.user.id;

  const adminCheck = await supabase.rpc("is_admin");
  if (adminCheck.error) {
    recordRestoreEvent({
      severity: "error",
      status: 500,
      code: FLASHCARD_ERROR_CODES.DB_ERROR,
      userId,
      cardId,
      details: { db_code: adminCheck.error.code, db_message: adminCheck.error.message },
    });
    return jsonResponse(
      500,
      buildErrorResponse(500, FLASHCARD_ERROR_CODES.DB_ERROR, "Failed to verify admin privileges.").body
    );
  }

  if (adminCheck.data !== true) {
    const descriptor = buildErrorResponse(
      401,
      FLASHCARD_ERROR_CODES.UNAUTHORIZED,
      "User not authorized to restore cards."
    );
    recordRestoreEvent({
      severity: "warning",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      cardId,
      details: { reason: "not_admin" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    const flashcard = await restoreFlashcard(supabase, cardId);

    recordRestoreEvent({
      severity: "info",
      status: 200,
      code: "success",
      userId,
      cardId,
    });

    return jsonResponse(200, flashcard);
  } catch (error) {
    if (error instanceof FlashcardNotFoundError) {
      const descriptor = buildErrorResponse(404, FLASHCARD_ERROR_CODES.NOT_FOUND, error.message);
      recordRestoreEvent({
        severity: "warning",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        cardId,
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (error instanceof FlashcardUnauthorizedError) {
      const descriptor = buildErrorResponse(401, FLASHCARD_ERROR_CODES.UNAUTHORIZED, error.message);
      recordRestoreEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        cardId,
        details: { reason: "rpc_not_admin" },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (isPostgrestError(error)) {
      const descriptor = mapFlashcardDbError(error);
      recordRestoreEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        cardId,
        details: { db_code: error.code, db_message: error.message },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      FLASHCARD_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while restoring the flashcard."
    );
    recordRestoreEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      cardId,
      details: { message: error instanceof Error ? error.message : "Unknown error" },
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

interface RestoreEventPayload {
  severity: "info" | "warning" | "error";
  status: number;
  code: string;
  userId?: string;
  cardId?: string;
  details?: Json;
}

/* eslint-disable no-console */
function recordRestoreEvent(payload: RestoreEventPayload): void {
  const entry = {
    scope: RESTORE_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${RESTORE_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
