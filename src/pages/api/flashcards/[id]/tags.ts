import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../../../../db/database.types.ts";

import {
  FLASHCARD_ERROR_CODES,
  buildErrorResponse,
  mapFlashcardDbError,
  type FlashcardErrorCode,
  type HttpErrorDescriptor,
} from "../../../../lib/errors.ts";
import { FlashcardReferenceError, setFlashcardTags } from "../../../../lib/services/flashcards.service.ts";
import {
  flashcardIdParamSchema,
  parseFlashcardId,
  setFlashcardTagsSchema,
  type SetFlashcardTagsPayload,
} from "../../../../lib/validation/flashcards.schema.ts";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const FLASHCARD_TAGS_EVENT_SCOPE = "api/flashcards/[id]/tags";

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const supabase = locals.supabase;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      FLASHCARD_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordFlashcardTagsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, FLASHCARD_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordFlashcardTagsEvent({
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
    recordFlashcardTagsEvent({
      severity: "info",
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

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.success) {
    recordFlashcardTagsEvent({
      severity: "info",
      status: bodyResult.error.status,
      code: bodyResult.error.body.error.code,
      userId: locals.user.id,
      cardId,
      details: { reason: "invalid_json_body" },
    });
    return jsonResponse(bodyResult.error.status, bodyResult.error.body);
  }

  const validationResult = setFlashcardTagsSchema.safeParse(bodyResult.data);
  if (!validationResult.success) {
    const descriptor = buildErrorResponse(
      400,
      FLASHCARD_ERROR_CODES.INVALID_BODY,
      validationResult.error.issues.map((issue) => issue.message).join("; ") || "Request body is invalid.",
      {
        issues: validationResult.error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path,
        })),
      }
    );
    recordFlashcardTagsEvent({
      severity: "info",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId: locals.user.id,
      cardId,
      details: { reason: "schema_validation_failed" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const userId = locals.user.id;
  const command: SetFlashcardTagsPayload = validationResult.data;

  try {
    const tags = await setFlashcardTags(supabase, userId, cardId, command);

    recordFlashcardTagsEvent({
      severity: "info",
      status: 200,
      code: "success",
      userId,
      cardId,
      details: { tag_count: tags.length },
    });

    return jsonResponse(200, tags);
  } catch (error) {
    if (error instanceof FlashcardReferenceError) {
      const descriptor = mapReferenceErrorToResponse(error);
      recordFlashcardTagsEvent({
        severity: descriptor.status === 404 ? "warning" : "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        cardId,
        details: error.details,
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (isPostgrestError(error)) {
      const descriptor = mapFlashcardDbError(error);
      recordFlashcardTagsEvent({
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
      "Unexpected error while updating flashcard tags."
    );
    recordFlashcardTagsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      cardId,
      details: { reason: "unexpected_error", message: error instanceof Error ? error.message : String(error) },
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

function mapReferenceErrorToResponse(error: FlashcardReferenceError): HttpErrorDescriptor<FlashcardErrorCode> {
  const status =
    error.code === FLASHCARD_ERROR_CODES.NOT_FOUND || error.code === FLASHCARD_ERROR_CODES.TAG_NOT_FOUND ? 404 : 422;
  return buildErrorResponse(status, error.code, error.message, error.details);
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

interface FlashcardTagsEventPayload {
  severity: "info" | "warning" | "error";
  status: number;
  code: string;
  userId?: string;
  cardId?: string;
  details?: Json;
}

/* eslint-disable no-console */
function recordFlashcardTagsEvent(payload: FlashcardTagsEventPayload): void {
  const entry = {
    scope: FLASHCARD_TAGS_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${FLASHCARD_TAGS_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
