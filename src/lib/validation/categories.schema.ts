import { z } from "zod";

import { decodeBase64 } from "../utils/base64.ts";

export const CATEGORY_LIMIT_DEFAULT = 20;
export const CATEGORY_LIMIT_MIN = 1;
export const CATEGORY_LIMIT_MAX = 100;

export const CATEGORY_SORT_FIELDS = ["name", "created_at"] as const;
export type CategorySortField = (typeof CATEGORY_SORT_FIELDS)[number];
const DEFAULT_CATEGORY_SORT: CategorySortField = "name";

export interface CategoriesQuery {
  search?: string;
  limit: number;
  cursor?: number;
  sort: CategorySortField;
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
        return CATEGORY_LIMIT_DEFAULT;
      }

      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : value;
    }

    if (value == null) {
      return CATEGORY_LIMIT_DEFAULT;
    }

    return value;
  },
  z
    .number({
      invalid_type_error: "Limit must be a valid integer.",
    })
    .int("Limit must be a valid integer.")
    .min(CATEGORY_LIMIT_MIN, `Limit must be at least ${CATEGORY_LIMIT_MIN}.`)
    .max(CATEGORY_LIMIT_MAX, `Limit cannot exceed ${CATEGORY_LIMIT_MAX}.`)
);

const sortSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return DEFAULT_CATEGORY_SORT;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length === 0 ? DEFAULT_CATEGORY_SORT : normalized;
  },
  z.enum(CATEGORY_SORT_FIELDS, {
    errorMap: () => ({
      message: `Sort must be one of: ${CATEGORY_SORT_FIELDS.join(", ")}.`,
    }),
  })
);

const cursorSchema = z.string().trim().min(1, "Cursor cannot be empty.").optional();

export const categoriesQuerySchema = z.object({
  search: searchSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  sort: sortSchema,
});

export type CategoriesQuerySchema = z.infer<typeof categoriesQuerySchema>;

export class InvalidCategoryCursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCategoryCursorError";
  }
}

export function decodeCategoryCursor(value: string): number {
  let decoded: string;
  try {
    decoded = decodeBase64(value);
  } catch {
    throw new InvalidCategoryCursorError("Cursor must be a valid Base64 string.");
  }

  const trimmed = decoded.trim();
  const cursorId = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(cursorId) || cursorId <= 0) {
    throw new InvalidCategoryCursorError("Cursor must decode to a positive integer identifier.");
  }

  return cursorId;
}

export function buildCategoriesQuery(payload: CategoriesQuerySchema): CategoriesQuery {
  const { cursor, ...rest } = payload;
  return cursor
    ? {
        ...rest,
        cursor: decodeCategoryCursor(cursor),
      }
    : rest;
}

// Schema for creating a new category (POST /api/categories)
const createCategoryNameSchema = z
  .string()
  .min(1, "Category name cannot be empty.")
  .max(255, "Category name cannot exceed 255 characters.")
  .transform((value) => value.trim());

const createCategorySlugSchema = z
  .string()
  .min(1, "Category slug cannot be empty.")
  .regex(/^[a-z0-9-]+$/, "Category slug must contain only lowercase letters, numbers, and hyphens.")
  .max(255, "Category slug cannot exceed 255 characters.");

const createCategoryDescriptionSchema = z
  .string()
  .optional()
  .transform((value) => (value ? value.trim() : undefined));

const createCategoryColorSchema = z
  .string()
  .optional()
  .refine(
    (value) => !value || /^#[0-9A-Fa-f]{6}$/.test(value),
    "Category color must be a valid hex color (e.g., #FF0000)."
  );

export const createCategoryBodySchema = z.object({
  name: createCategoryNameSchema,
  slug: createCategorySlugSchema,
  description: createCategoryDescriptionSchema,
  color: createCategoryColorSchema,
});

export type CreateCategoryBodySchema = z.infer<typeof createCategoryBodySchema>;
