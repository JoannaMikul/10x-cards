import { z } from "zod";

import type { Enums, Json } from "../../db/database.types.ts";

const CARD_ORIGINS = ["ai-full", "ai-edited", "manual"] as const satisfies readonly Enums<"card_origin">[];

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
