import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../../db/database.types";
import { DEFAULT_USER_ID, supabaseClient } from "../../db/supabase.client";
import {
  FLASHCARD_ERROR_CODES,
  buildErrorResponse,
  mapFlashcardDbError,
  type FlashcardErrorCode,
  type HttpErrorDescriptor,
} from "../../lib/errors";
import { FlashcardReferenceError, createFlashcard, listFlashcards } from "../../lib/services/flashcards.service";
import {
  createFlashcardSchema,
  flashcardsQuerySchema,
  buildFlashcardsQuery,
  InvalidFlashcardsCursorError,
} from "../../lib/validation/flashcards.schema";
import type { CreateFlashcardCommand } from "../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const FLASHCARD_EVENT_SCOPE = "api/flashcards";

export const GET: APIRoute = async ({ locals, url }) => {
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

  // Parse and validate query parameters
  const searchParams = url.searchParams;
  const categoryIdParam = searchParams.get("category_id");
  const contentSourceIdParam = searchParams.get("content_source_id");

  const queryPayload = {
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    category_id: categoryIdParam ? parseInt(categoryIdParam, 10) : undefined,
    content_source_id: contentSourceIdParam ? parseInt(contentSourceIdParam, 10) : undefined,
    origin: searchParams.get("origin") ?? undefined,
    tag_ids: searchParams
      .getAll("tag_ids[]")
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id)),
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    include_deleted: searchParams.get("include_deleted") ?? undefined,
  };

  const validationResult = flashcardsQuerySchema.safeParse(queryPayload);
  if (!validationResult.success) {
    const descriptor = buildErrorResponse(
      400,
      FLASHCARD_ERROR_CODES.INVALID_QUERY,
      validationResult.error.issues.map((issue) => issue.message).join("; ") || "Query parameters are invalid."
    );
    recordFlashcardsEvent({
      severity: "info",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "query_validation_failed" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const userId = locals.user.id;

  try {
    const query = buildFlashcardsQuery(validationResult.data);
    const result = await listFlashcards(supabase, userId, query);

    const response = {
      data: result.items,
      page: {
        next_cursor: result.nextCursor,
        has_more: result.hasMore,
      },
      aggregates: result.aggregates,
    };

    return jsonResponse(200, response);
  } catch (error) {
    if (error instanceof InvalidFlashcardsCursorError) {
      const descriptor = buildErrorResponse(400, FLASHCARD_ERROR_CODES.INVALID_QUERY, error.message);
      recordFlashcardsEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        details: { reason: "invalid_cursor" },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (isPostgrestError(error)) {
      const descriptor = buildErrorResponse(
        500,
        FLASHCARD_ERROR_CODES.DB_ERROR,
        "A database error occurred while listing flashcards."
      );
      recordFlashcardsEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        details: { db_code: error.code },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      FLASHCARD_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while listing flashcards."
    );
    recordFlashcardsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      details: { reason: "unexpected_non_pg_error", message: error instanceof Error ? error.message : String(error) },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
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
    const descriptor = buildErrorResponse(401, FLASHCARD_ERROR_CODES.UNEXPECTED_ERROR, "User not authenticated.");
    recordFlashcardsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.success) {
    recordFlashcardsEvent({
      severity: "info",
      status: bodyResult.error.status,
      code: bodyResult.error.body.error.code,
      details: { reason: "invalid_json_body" },
    });
    return jsonResponse(bodyResult.error.status, bodyResult.error.body);
  }

  const validationResult = createFlashcardSchema.safeParse(bodyResult.data);
  if (!validationResult.success) {
    const descriptor = buildErrorResponse(
      400,
      FLASHCARD_ERROR_CODES.INVALID_BODY,
      validationResult.error.issues.map((issue) => issue.message).join("; ") || "Request body is invalid."
    );
    recordFlashcardsEvent({
      severity: "info",
      status: descriptor.status,
      code: descriptor.body.error.code,
      details: { reason: "schema_validation_failed" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const command: CreateFlashcardCommand = validationResult.data;
  const userId = locals.user.id;

  try {
    const flashcard = await createFlashcard(supabase, userId, command);
    return jsonResponse(201, flashcard);
  } catch (error) {
    if (error instanceof FlashcardReferenceError) {
      const descriptor = mapReferenceErrorToResponse(error);
      recordFlashcardsEvent({
        severity: "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        details: error.details,
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (isPostgrestError(error)) {
      const descriptor = mapFlashcardDbError(error);
      recordFlashcardsEvent({
        severity: descriptor.status >= 500 ? "error" : "info",
        status: descriptor.status,
        code: descriptor.body.error.code,
        userId,
        details: { db_code: error.code },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      FLASHCARD_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while creating the flashcard."
    );
    recordFlashcardsEvent({
      severity: "error",
      status: descriptor.status,
      code: descriptor.body.error.code,
      userId,
      details: { reason: "unexpected_non_pg_error", message: error instanceof Error ? error.message : String(error) },
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
  return buildErrorResponse(404, error.code, error.message, error.details);
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

interface FlashcardEventPayload {
  severity: "info" | "error";
  status: number;
  code: FlashcardErrorCode;
  userId?: string;
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
