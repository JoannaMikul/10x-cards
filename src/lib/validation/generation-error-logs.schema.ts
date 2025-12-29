import { z } from "zod";

export const DEFAULT_GENERATION_ERROR_LOGS_LIMIT = 20;
export const MAX_GENERATION_ERROR_LOGS_LIMIT = 100;

export const generationErrorLogsQuerySchema = z.object({
  user_id: z
    .string({
      invalid_type_error: "User ID must be a string",
    })
    .uuid("User ID must be a valid UUID")
    .optional(),
  model: z
    .string({
      invalid_type_error: "Model must be a string",
    })
    .min(1, "Model cannot be empty")
    .optional(),
  from: z
    .string({
      invalid_type_error: "From date must be a string",
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "From date must be in YYYY-MM-DD format")
    .transform((dateStr) => {
      const date = new Date(`${dateStr}T00:00:00.000Z`);
      return date.toISOString();
    })
    .optional(),
  to: z
    .string({
      invalid_type_error: "To date must be a string",
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "To date must be in YYYY-MM-DD format")
    .transform((dateStr) => {
      const date = new Date(`${dateStr}T23:59:59.999Z`);
      return date.toISOString();
    })
    .optional(),
  limit: z
    .string({
      invalid_type_error: "Limit must be a string",
    })
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val), "Limit must be a valid number")
    .refine((val) => val >= 1, "Limit must be at least 1")
    .refine((val) => val <= MAX_GENERATION_ERROR_LOGS_LIMIT, `Limit cannot exceed ${MAX_GENERATION_ERROR_LOGS_LIMIT}`)
    .optional()
    .default(String(DEFAULT_GENERATION_ERROR_LOGS_LIMIT)),
  cursor: z
    .string({
      invalid_type_error: "Cursor must be a string",
    })
    .optional(),
});

export type GenerationErrorLogsQuery = z.infer<typeof generationErrorLogsQuerySchema>;

export function buildGenerationErrorLogsQuery(params: GenerationErrorLogsQuery): Omit<
  GenerationErrorLogsQuery,
  "limit"
> & {
  limit: number;
} {
  return {
    ...params,
    limit: params.limit ?? DEFAULT_GENERATION_ERROR_LOGS_LIMIT,
  };
}
