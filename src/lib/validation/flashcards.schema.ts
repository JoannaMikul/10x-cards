import { z } from "zod";

import type { Enums, Json } from "../../db/database.types.ts";
import { decodeBase64 } from "../utils/base64.ts";

const CARD_ORIGINS = ["ai-full", "ai-edited", "manual"] as const satisfies readonly Enums<"card_origin">[];

// Query parameters constants
const LIMIT_DEFAULT = 20;
const LIMIT_MIN = 1;
const LIMIT_MAX = 100;
const SEARCH_MIN_LENGTH = 1;
const SEARCH_MAX_LENGTH = 200;
const SORT_FIELDS = ["created_at", "-created_at", "updated_at", "next_review_at"] as const;
const DEFAULT_SORT = "-created_at";

const MAX_FRONT_LENGTH = 200;
const MAX_BACK_LENGTH = 500;

const positiveIntSchema = z
  .number({
    required_error: "Value is required.",
    invalid_type_error: "Value must be a number.",
  })
  .int("Value must be an integer.")
  .positive("Value must be greater than 0.");

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonSchema), z.record(jsonSchema)])
);

const tagIdsSchema = z
  .array(positiveIntSchema)
  .max(50, "Tag selection cannot exceed 50 entries.")
  .refine((values) => new Set(values).size === values.length, "Tag IDs must be unique.")
  .optional();

export const createFlashcardSchema = z.object({
  front: z
    .string({
      required_error: "Front text is required.",
      invalid_type_error: "Front text must be a string.",
    })
    .trim()
    .min(1, "Front text cannot be empty.")
    .max(MAX_FRONT_LENGTH, `Front text cannot exceed ${MAX_FRONT_LENGTH} characters.`),
  back: z
    .string({
      required_error: "Back text is required.",
      invalid_type_error: "Back text must be a string.",
    })
    .trim()
    .min(1, "Back text cannot be empty.")
    .max(MAX_BACK_LENGTH, `Back text cannot exceed ${MAX_BACK_LENGTH} characters.`),
  origin: z.enum(CARD_ORIGINS, {
    errorMap: () => ({
      message: `Origin must be one of: ${CARD_ORIGINS.join(", ")}.`,
    }),
  }),
  category_id: positiveIntSchema.optional(),
  content_source_id: positiveIntSchema.optional(),
  tag_ids: tagIdsSchema,
  metadata: jsonSchema.optional(),
});

export type CreateFlashcardPayload = z.infer<typeof createFlashcardSchema>;

// Query validation schemas
export const flashcardsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : LIMIT_DEFAULT))
    .refine((val) => val >= LIMIT_MIN && val <= LIMIT_MAX, {
      message: `Limit must be between ${LIMIT_MIN} and ${LIMIT_MAX}.`,
    }),
  cursor: z
    .string()
    .optional()
    .refine((val) => !val || /^[A-Za-z0-9+/]+=*$/.test(val), {
      message: "Cursor must be a valid base64 string.",
    }),
  category_id: positiveIntSchema.optional(),
  content_source_id: positiveIntSchema.optional(),
  origin: z
    .enum(CARD_ORIGINS, {
      errorMap: () => ({
        message: `Origin must be one of: ${CARD_ORIGINS.join(", ")}.`,
      }),
    })
    .optional(),
  tag_ids: tagIdsSchema,
  search: z
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH, `Search term must be at least ${SEARCH_MIN_LENGTH} character.`)
    .max(SEARCH_MAX_LENGTH, `Search term cannot exceed ${SEARCH_MAX_LENGTH} characters.`)
    .optional(),
  sort: z
    .string()
    .optional()
    .refine((val) => !val || SORT_FIELDS.includes(val as any), {
      message: `Sort must be one of: ${SORT_FIELDS.join(", ")}.`,
    }),
  include_deleted: z
    .string()
    .optional()
    .transform((val) => val === "true")
    .pipe(z.boolean()),
});

export type FlashcardsQueryPayload = z.infer<typeof flashcardsQuerySchema>;

// Runtime query interface
export interface FlashcardsQuery {
  limit: number;
  cursor?: FlashcardsCursor;
  categoryId?: number;
  contentSourceId?: number;
  origin?: Enums<"card_origin">;
  tagIds?: number[];
  search?: string;
  sort: (typeof SORT_FIELDS)[number];
  includeDeleted: boolean;
}

export interface FlashcardsCursor {
  createdAt: string;
  id: string;
}

export class InvalidFlashcardsCursorError extends Error {
  readonly code = "INVALID_CURSOR";

  constructor(message: string) {
    super(message);
    this.name = "InvalidFlashcardsCursorError";
  }
}

export function decodeFlashcardsCursor(value: string): FlashcardsCursor {
  try {
    const decoded = decodeBase64(value);
    const parts = decoded.split("#");

    if (parts.length !== 2) {
      throw new InvalidFlashcardsCursorError("Cursor must contain exactly one '#' separator.");
    }

    const [createdAt, id] = parts;

    if (!createdAt || !id) {
      throw new InvalidFlashcardsCursorError("Cursor parts cannot be empty.");
    }

    // Validate ISO date format
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) {
      throw new InvalidFlashcardsCursorError("Invalid created_at timestamp in cursor.");
    }

    return { createdAt, id };
  } catch (error) {
    if (error instanceof InvalidFlashcardsCursorError) {
      throw error;
    }
    throw new InvalidFlashcardsCursorError("Failed to decode cursor from base64.");
  }
}

export function buildFlashcardsQuery(payload: FlashcardsQueryPayload): FlashcardsQuery {
  const cursor = payload.cursor ? decodeFlashcardsCursor(payload.cursor) : undefined;
  const sort = (payload.sort as FlashcardsQuery["sort"]) ?? DEFAULT_SORT;

  return {
    limit: payload.limit,
    cursor,
    categoryId: payload.category_id,
    contentSourceId: payload.content_source_id,
    origin: payload.origin,
    tagIds: payload.tag_ids,
    search: payload.search,
    sort,
    includeDeleted: payload.include_deleted ?? false,
  };
}
