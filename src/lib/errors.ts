import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../db/database.types.ts";
import type { ApiErrorResponse } from "../types";

export const GENERATION_ERROR_CODES = {
  LENGTH_OUT_OF_RANGE: "length_out_of_range",
  INVALID_PAYLOAD: "invalid_payload",
  UNAUTHORIZED: "unauthorized",
  ACTIVE_REQUEST_EXISTS: "active_request_exists",
  HOURLY_QUOTA_REACHED: "hourly_quota_reached",
  DB_ERROR: "db_error",
  UNEXPECTED_ERROR: "unexpected_error",
} as const;

export type GenerationErrorCode = (typeof GENERATION_ERROR_CODES)[keyof typeof GENERATION_ERROR_CODES];

export const CATEGORY_ERROR_CODES = {
  INVALID_QUERY: "invalid_query",
  UNAUTHORIZED: "unauthorized",
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
