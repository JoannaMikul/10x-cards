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
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? undefined : value))
  .pipe(
    z.string().min(1, "Search query cannot be empty.").max(200, "Search query cannot exceed 200 characters.").optional()
  );

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
  search: searchSchema.optional(),
  limit: limitSchema,
  cursor: cursorSchema.optional(),
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

  if (!/^\d+$/.test(trimmed)) {
    throw new InvalidCategoryCursorError("Cursor must decode to a positive integer identifier.");
  }

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

const createCategoryNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1, "Category name cannot be empty.").max(255, "Category name cannot exceed 255 characters."));

const createCategorySlugSchema = z
  .string()
  .min(1, "Category slug cannot be empty.")
  .regex(/^[a-z0-9-]+$/, "Category slug must contain only lowercase letters, numbers, and hyphens.")
  .max(255, "Category slug cannot exceed 255 characters.");

const createCategoryDescriptionSchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

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

export const categoryIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Category ID must be a valid positive integer.")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, "Category ID must be a positive integer."),
});

export type CategoryIdParamSchema = z.infer<typeof categoryIdParamSchema>;

const updateCategoryNameSchema = createCategoryNameSchema.optional();
const updateCategorySlugSchema = createCategorySlugSchema.optional();
const updateCategoryDescriptionSchema = createCategoryDescriptionSchema.optional();
const updateCategoryColorSchema = z.union([createCategoryColorSchema, z.null()]).optional();

export const updateCategoryBodySchema = z
  .object({
    name: updateCategoryNameSchema,
    slug: updateCategorySlugSchema,
    description: updateCategoryDescriptionSchema,
    color: updateCategoryColorSchema,
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one field must be provided for update."
  );

export type UpdateCategoryBodySchema = z.infer<typeof updateCategoryBodySchema>;
