import { z } from "zod";

import { decodeBase64 } from "../utils/base64.ts";

export const TAG_LIMIT_DEFAULT = 20;
export const TAG_LIMIT_MIN = 1;
export const TAG_LIMIT_MAX = 100;

export const TAG_SORT_FIELDS = ["name", "created_at"] as const;
export type TagSortField = (typeof TAG_SORT_FIELDS)[number];
const DEFAULT_TAG_SORT: TagSortField = "name";

export interface TagsQuery {
  search?: string;
  limit: number;
  cursor?: number;
  sort: TagSortField;
}

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
        return TAG_LIMIT_DEFAULT;
      }

      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : value;
    }

    if (value == null) {
      return TAG_LIMIT_DEFAULT;
    }

    return value;
  },
  z
    .number({
      invalid_type_error: "Limit must be a valid integer.",
    })
    .int("Limit must be a valid integer.")
    .min(TAG_LIMIT_MIN, `Limit must be at least ${TAG_LIMIT_MIN}.`)
    .max(TAG_LIMIT_MAX, `Limit cannot exceed ${TAG_LIMIT_MAX}.`)
);

const sortSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return DEFAULT_TAG_SORT;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length === 0 ? DEFAULT_TAG_SORT : normalized;
  },
  z.enum(TAG_SORT_FIELDS, {
    errorMap: () => ({
      message: `Sort must be one of: ${TAG_SORT_FIELDS.join(", ")}.`,
    }),
  })
);

const cursorSchema = z.string().trim().min(1, "Cursor cannot be empty.").optional();

export const tagsQuerySchema = z.object({
  search: searchSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  sort: sortSchema,
});

export type TagsQuerySchema = z.infer<typeof tagsQuerySchema>;

export class InvalidTagCursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTagCursorError";
  }
}

export function decodeTagCursor(value: string): number {
  let decoded: string;
  try {
    decoded = decodeBase64(value);
  } catch {
    throw new InvalidTagCursorError("Cursor must be a valid Base64 string.");
  }

  const trimmed = decoded.trim();
  const cursorId = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(cursorId) || cursorId <= 0) {
    throw new InvalidTagCursorError("Cursor must decode to a positive integer identifier.");
  }

  return cursorId;
}

export function buildTagsQuery(payload: TagsQuerySchema): TagsQuery {
  const { cursor, ...rest } = payload;
  return cursor
    ? {
        ...rest,
        cursor: decodeTagCursor(cursor),
      }
    : rest;
}
