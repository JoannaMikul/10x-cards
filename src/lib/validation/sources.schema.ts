import { z } from "zod";

import { decodeBase64 } from "../utils/base64.ts";

export const SOURCE_LIMIT_DEFAULT = 20;
export const SOURCE_LIMIT_MIN = 1;
export const SOURCE_LIMIT_MAX = 100;

export const SOURCE_SORT_FIELDS = ["name", "created_at"] as const;
export type SourceSortField = (typeof SOURCE_SORT_FIELDS)[number];
const DEFAULT_SOURCE_SORT: SourceSortField = "name";

export const SOURCE_KIND_VALUES = ["book", "article", "course", "url", "other", "documentation", "notes"] as const;
export type SourceKind = (typeof SOURCE_KIND_VALUES)[number];

export interface SourcesQuery {
  kind?: SourceKind;
  search?: string;
  limit: number;
  cursor?: number;
  sort: SourceSortField;
}

const kindSchema = z
  .preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value ?? undefined;
      }

      const normalized = value.trim().toLowerCase();
      return normalized.length === 0 ? undefined : normalized;
    },
    z.enum(SOURCE_KIND_VALUES, {
      errorMap: () => ({
        message: `Kind must be one of: ${SOURCE_KIND_VALUES.join(", ")}.`,
      }),
    })
  )
  .optional();

const searchSchema = z
  .preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value ?? undefined;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().min(1, "Search query cannot be empty.").max(200, "Search query cannot exceed 200 characters.")
  )
  .optional();

const limitSchema = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return SOURCE_LIMIT_DEFAULT;
      }

      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : value;
    }

    if (value == null) {
      return SOURCE_LIMIT_DEFAULT;
    }

    return value;
  },
  z
    .number({
      invalid_type_error: "Limit must be a valid integer.",
    })
    .int("Limit must be a valid integer.")
    .min(SOURCE_LIMIT_MIN, `Limit must be at least ${SOURCE_LIMIT_MIN}.`)
    .max(SOURCE_LIMIT_MAX, `Limit cannot exceed ${SOURCE_LIMIT_MAX}.`)
);

const sortSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return DEFAULT_SOURCE_SORT;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length === 0 ? DEFAULT_SOURCE_SORT : normalized;
  },
  z.enum(SOURCE_SORT_FIELDS, {
    errorMap: () => ({
      message: `Sort must be one of: ${SOURCE_SORT_FIELDS.join(", ")}.`,
    }),
  })
);

const cursorSchema = z.string().trim().min(1, "Cursor cannot be empty.").optional();

export const sourcesQuerySchema = z.object({
  kind: kindSchema,
  search: searchSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  sort: sortSchema,
});

export type SourcesQuerySchema = z.infer<typeof sourcesQuerySchema>;

export class InvalidSourceCursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSourceCursorError";
  }
}

export function decodeSourceCursor(value: string): number {
  let decoded: string;
  try {
    decoded = decodeBase64(value);
  } catch {
    throw new InvalidSourceCursorError("Cursor must be a valid Base64 string.");
  }

  const trimmed = decoded.trim();
  const cursorId = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(cursorId) || cursorId <= 0) {
    throw new InvalidSourceCursorError("Cursor must decode to a positive integer identifier.");
  }

  return cursorId;
}

export function buildSourcesQuery(payload: SourcesQuerySchema): SourcesQuery {
  const { cursor, ...rest } = payload;
  return cursor
    ? {
        ...rest,
        cursor: decodeSourceCursor(cursor),
      }
    : rest;
}
