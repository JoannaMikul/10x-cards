import { z } from "zod";

export const MIN_SANITIZED_TEXT_LENGTH = 1000;
export const MAX_SANITIZED_TEXT_LENGTH = 10000;
export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 2;

const temperatureSchema = z
  .number({
    invalid_type_error: "Temperature must be a number",
    required_error: "Temperature is required",
  })
  .min(TEMPERATURE_MIN, `Temperature cannot be lower than ${TEMPERATURE_MIN}`)
  .max(TEMPERATURE_MAX, `Temperature cannot be higher than ${TEMPERATURE_MAX}`)
  .transform((value) => Math.round(value * 100) / 100);

/**
 * Validates the payload required to start an AI generation task.
 * Length limits mirror the constraints enforced by the database.
 */
export const createGenerationSchema = z.object({
  model: z
    .string({
      required_error: "Model is required",
      invalid_type_error: "Model must be a string",
    })
    .min(1, "Model cannot be empty"),
  sanitized_input_text: z
    .string({
      required_error: "Sanitized input text is required",
      invalid_type_error: "Sanitized input text must be a string",
    })
    .min(
      MIN_SANITIZED_TEXT_LENGTH,
      `Sanitized input text must be at least ${MIN_SANITIZED_TEXT_LENGTH} characters long`
    )
    .max(MAX_SANITIZED_TEXT_LENGTH, `Sanitized input text can contain at most ${MAX_SANITIZED_TEXT_LENGTH} characters`),
  temperature: temperatureSchema.optional(),
});

export type CreateGenerationInput = z.infer<typeof createGenerationSchema>;

export const getGenerationParamsSchema = z.object({
  id: z
    .string({
      required_error: "Generation id is required",
      invalid_type_error: "Generation id must be a string",
    })
    .uuid("Invalid generation id"),
});

export type GetGenerationParams = z.infer<typeof getGenerationParamsSchema>;

/**
 * Validates the payload required to cancel an active generation.
 * Only allows status transition to 'cancelled'.
 */
export const updateGenerationSchema = z
  .object({
    status: z.literal("cancelled", {
      invalid_type_error: "Status must be 'cancelled'",
      required_error: "Status is required",
    }),
  })
  .strict({
    message: "Only status field is allowed",
  });

export type UpdateGenerationInput = z.infer<typeof updateGenerationSchema>;
