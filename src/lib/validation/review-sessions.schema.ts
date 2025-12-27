import { z } from "zod";

import type { Enums, Json } from "../../db/database.types.ts";

const REVIEW_OUTCOMES = ["fail", "hard", "good", "easy", "again"] as const satisfies readonly Enums<"review_outcome">[];

const GRADE_MIN = 0;
const GRADE_MAX = 5;

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonSchema), z.record(jsonSchema)])
);

export const createReviewSessionSchema = z.object({
  session_id: z.string().uuid("Session ID must be a valid UUID."),
  started_at: z.string().datetime("Started at must be a valid ISO date string."),
  completed_at: z.string().datetime("Completed at must be a valid ISO date string."),
  reviews: z
    .array(
      z.object({
        card_id: z.string().uuid("Card ID must be a valid UUID."),
        outcome: z.enum(REVIEW_OUTCOMES, {
          errorMap: () => ({
            message: `Outcome must be one of: ${REVIEW_OUTCOMES.join(", ")}.`,
          }),
        }),
        grade: z
          .number({
            required_error: "Grade is required.",
            invalid_type_error: "Grade must be a number.",
          })
          .int("Grade must be an integer.")
          .min(GRADE_MIN, `Grade must be at least ${GRADE_MIN}.`)
          .max(GRADE_MAX, `Grade must be at most ${GRADE_MAX}.`),
        response_time_ms: z
          .number({
            invalid_type_error: "Response time must be a number.",
          })
          .int("Response time must be an integer.")
          .positive("Response time must be positive.")
          .optional(),
        prev_interval_days: z
          .number({
            invalid_type_error: "Previous interval must be a number.",
          })
          .int("Previous interval must be an integer.")
          .min(0, "Previous interval cannot be negative.")
          .optional(),
        next_interval_days: z
          .number({
            invalid_type_error: "Next interval must be a number.",
          })
          .int("Next interval must be an integer.")
          .min(0, "Next interval cannot be negative.")
          .optional(),
        was_learning_step: z
          .boolean({
            invalid_type_error: "Was learning step must be a boolean.",
          })
          .optional(),
        payload: jsonSchema.optional(),
      }),
      {
        invalid_type_error: "Reviews must be an array of review objects.",
      }
    )
    .min(1, "At least one review is required.")
    .max(100, "Cannot process more than 100 reviews at once."),
});

export type CreateReviewSessionPayload = z.infer<typeof createReviewSessionSchema>;
