import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../db/database.types.ts";
import type { ApiErrorResponse } from "../types";

export const GENERATION_ERROR_CODES = {
  LENGTH_OUT_OF_RANGE: "length_out_of_range",
  INVALID_PAYLOAD: "invalid_payload",
  INVALID_PARAMS: "invalid_params",
  UNAUTHORIZED: "unauthorized",
  ACTIVE_REQUEST_EXISTS: "active_request_exists",
  HOURLY_QUOTA_REACHED: "hourly_quota_reached",
  NOT_FOUND: "generation_not_found",
  INVALID_TRANSITION: "invalid_transition",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type GenerationErrorCode = (typeof GENERATION_ERROR_CODES)[keyof typeof GENERATION_ERROR_CODES];

export const CATEGORY_ERROR_CODES = {
  INVALID_QUERY: "invalid_query",
  INVALID_BODY: "invalid_body",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  SLUG_TAKEN: "slug_taken",
  NAME_TAKEN: "name_taken",
  CONSTRAINT_VIOLATION: "constraint_violation",
  CATEGORY_IN_USE: "category_in_use",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type CategoryErrorCode = (typeof CATEGORY_ERROR_CODES)[keyof typeof CATEGORY_ERROR_CODES];

export const TAG_ERROR_CODES = {
  INVALID_QUERY: "invalid_query",
  UNAUTHORIZED: "unauthorized",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type TagErrorCode = (typeof TAG_ERROR_CODES)[keyof typeof TAG_ERROR_CODES];

export const SOURCE_ERROR_CODES = {
  INVALID_QUERY: "invalid_query",
  UNAUTHORIZED: "unauthorized",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type SourceErrorCode = (typeof SOURCE_ERROR_CODES)[keyof typeof SOURCE_ERROR_CODES];

export const FLASHCARD_ERROR_CODES = {
  INVALID_QUERY: "invalid_query",
  INVALID_BODY: "invalid_body",
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "not_found",
  CATEGORY_NOT_FOUND: "category_not_found",
  SOURCE_NOT_FOUND: "source_not_found",
  TAG_NOT_FOUND: "tag_not_found",
  DUPLICATE_FLASHCARD: "duplicate_flashcard",
  UNPROCESSABLE_ENTITY: "unprocessable_entity",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type FlashcardErrorCode = (typeof FLASHCARD_ERROR_CODES)[keyof typeof FLASHCARD_ERROR_CODES];

export const CANDIDATE_ERROR_CODES = {
  INVALID_QUERY: "invalid_query",
  INVALID_PARAMS: "invalid_params",
  INVALID_BODY: "invalid_body",
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "not_found",
  INVALID_TRANSITION: "invalid_transition",
  DUPLICATE_CANDIDATE: "duplicate_candidate",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type CandidateErrorCode = (typeof CANDIDATE_ERROR_CODES)[keyof typeof CANDIDATE_ERROR_CODES];

export const CANDIDATE_ACCEPT_ERROR_CODES = {
  INVALID_BODY: "invalid_body",
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "not_found",
  ALREADY_ACCEPTED: "already_accepted",
  FINGERPRINT_CONFLICT: "fingerprint_conflict",
  UNPROCESSABLE_ENTITY: "unprocessable_entity",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type CandidateAcceptErrorCode = (typeof CANDIDATE_ACCEPT_ERROR_CODES)[keyof typeof CANDIDATE_ACCEPT_ERROR_CODES];

export const GENERATION_ERROR_LOGS_ERROR_CODES = {
  INVALID_QUERY: "invalid_query",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type GenerationErrorLogsErrorCode =
  (typeof GENERATION_ERROR_LOGS_ERROR_CODES)[keyof typeof GENERATION_ERROR_LOGS_ERROR_CODES];

export interface HttpErrorDescriptor<TCode extends string = string> {
  status: number;
  body: ApiErrorResponse<TCode>;
}

export function buildErrorResponse<TCode extends string>(
  status: number,
  code: TCode,
  message: string,
  details?: Json
): HttpErrorDescriptor<TCode> {
  return {
    status,
    body: {
      error: details ? { code, message, details } : { code, message },
    },
  };
}

const ACTIVE_GENERATION_INDEX = "generations_active_per_user_unique";
const RATE_LIMIT_SIGNATURE = "generation_rate_limit_exceeded";
const FLASHCARD_FINGERPRINT_INDEX = "flashcards_owner_fingerprint_unique";
const CANDIDATE_FINGERPRINT_INDEX = "generation_candidates_owner_fingerprint_unique";
const ACCEPT_ALREADY_ACCEPTED_SIGNATURE = "candidate_already_accepted";

/**
 * Maps PostgREST or plain PostgreSQL errors to structured responses returned by the
 * generations endpoint.
 */
export function mapGenerationDbError(error: PostgrestError): HttpErrorDescriptor<GenerationErrorCode> {
  if (error.code === "23505" && matchesSignature(error, ACTIVE_GENERATION_INDEX)) {
    return buildErrorResponse(
      409,
      GENERATION_ERROR_CODES.ACTIVE_REQUEST_EXISTS,
      "An active generation request is already in progress."
    );
  }

  if (matchesSignature(error, RATE_LIMIT_SIGNATURE)) {
    return buildErrorResponse(
      429,
      GENERATION_ERROR_CODES.HOURLY_QUOTA_REACHED,
      "Hourly generation limit (5 requests) has been exceeded."
    );
  }

  return buildErrorResponse(
    500,
    GENERATION_ERROR_CODES.DB_ERROR,
    "A database error occurred while starting the generation."
  );
}

function matchesSignature(error: PostgrestError, signature: string): boolean {
  return [error.message, error.details, error.hint].some((value) => value?.includes(signature));
}

export function mapFlashcardDbError(error: PostgrestError): HttpErrorDescriptor<FlashcardErrorCode> {
  if (error.code === "23505" && matchesSignature(error, FLASHCARD_FINGERPRINT_INDEX)) {
    return buildErrorResponse(
      409,
      FLASHCARD_ERROR_CODES.DUPLICATE_FLASHCARD,
      "A flashcard with the same front and back already exists."
    );
  }

  if (error.code === "23503") {
    return buildErrorResponse(
      422,
      FLASHCARD_ERROR_CODES.UNPROCESSABLE_ENTITY,
      "Referenced entities are invalid or no longer exist."
    );
  }

  return buildErrorResponse(
    500,
    FLASHCARD_ERROR_CODES.DB_ERROR,
    "A database error occurred while creating the flashcard."
  );
}

export function mapCandidateDbError(error: PostgrestError): HttpErrorDescriptor<CandidateErrorCode> {
  if (error.code === "23505" && matchesSignature(error, CANDIDATE_FINGERPRINT_INDEX)) {
    return buildErrorResponse(
      409,
      CANDIDATE_ERROR_CODES.DUPLICATE_CANDIDATE,
      "A generation candidate with the same front and back already exists."
    );
  }

  return buildErrorResponse(
    500,
    CANDIDATE_ERROR_CODES.DB_ERROR,
    "A database error occurred while processing generation candidates."
  );
}

export function mapAcceptCandidateDbError(error: PostgrestError): HttpErrorDescriptor<CandidateAcceptErrorCode> {
  if (error.code === "23505" && matchesSignature(error, FLASHCARD_FINGERPRINT_INDEX)) {
    return buildErrorResponse(
      422,
      CANDIDATE_ACCEPT_ERROR_CODES.FINGERPRINT_CONFLICT,
      "An active flashcard with the same content already exists."
    );
  }

  if (error.code === "23503") {
    return buildErrorResponse(
      422,
      CANDIDATE_ACCEPT_ERROR_CODES.UNPROCESSABLE_ENTITY,
      "Referenced metadata entities are invalid or no longer exist."
    );
  }

  if (error.code === "P0001" && matchesSignature(error, ACCEPT_ALREADY_ACCEPTED_SIGNATURE)) {
    return buildErrorResponse(
      409,
      CANDIDATE_ACCEPT_ERROR_CODES.ALREADY_ACCEPTED,
      "The generation candidate has already been accepted."
    );
  }

  return buildErrorResponse(
    500,
    CANDIDATE_ACCEPT_ERROR_CODES.DB_ERROR,
    "A database error occurred while accepting the generation candidate."
  );
}

export function mapCategoryDbError(error: PostgrestError): HttpErrorDescriptor<CategoryErrorCode> {
  if (error.code === "23505") {
    // Unique constraint violation - try to determine which field
    if (matchesSignature(error, "categories_slug_key")) {
      return buildErrorResponse(409, CATEGORY_ERROR_CODES.SLUG_TAKEN, "A category with this slug already exists.");
    }

    if (matchesSignature(error, "categories_name_key")) {
      return buildErrorResponse(409, CATEGORY_ERROR_CODES.NAME_TAKEN, "A category with this name already exists.");
    }

    // Fallback for other unique constraints
    return buildErrorResponse(
      409,
      CATEGORY_ERROR_CODES.CONSTRAINT_VIOLATION,
      "A category with these details already exists."
    );
  }

  if (error.code === "23503") {
    // Foreign key violation - category is in use
    return buildErrorResponse(
      409,
      CATEGORY_ERROR_CODES.CATEGORY_IN_USE,
      "Cannot delete category because it is referenced by flashcards."
    );
  }

  return buildErrorResponse(
    500,
    CATEGORY_ERROR_CODES.DB_ERROR,
    "A database error occurred while creating the category."
  );
}

export const REVIEW_ERROR_CODES = {
  INVALID_QUERY: "invalid_query",
  INVALID_BODY: "invalid_body",
  UNAUTHORIZED: "unauthorized",
  CARD_NOT_FOUND: "card_not_found",
  INVALID_OUTCOME: "invalid_outcome",
  INVALID_GRADE: "invalid_grade",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type ReviewErrorCode = (typeof REVIEW_ERROR_CODES)[keyof typeof REVIEW_ERROR_CODES];

export function mapReviewDbError(): HttpErrorDescriptor<ReviewErrorCode> {
  return buildErrorResponse(
    500,
    REVIEW_ERROR_CODES.DB_ERROR,
    "A database error occurred while processing the review session."
  );
}

export const AUTH_ERROR_CODES = {
  INVALID_BODY: "invalid_body",
  INVALID_CREDENTIALS: "invalid_credentials",
  EMAIL_ALREADY_REGISTERED: "email_already_registered",
  UNAUTHORIZED: "unauthorized",
  PASSWORD_TOO_WEAK: "password_too_weak",
  INVALID_RECOVERY_CODE: "invalid_recovery_code",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export const ANALYTICS_ERROR_CODES = {
  INVALID_QUERY: "invalid_query",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type AnalyticsErrorCode = (typeof ANALYTICS_ERROR_CODES)[keyof typeof ANALYTICS_ERROR_CODES];
