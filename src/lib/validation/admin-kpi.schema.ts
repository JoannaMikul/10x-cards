import { z } from "zod";

const RANGE_VALUES = ["7d", "30d", "custom"] as const;
const GROUP_BY_VALUES = ["day", "category", "origin"] as const;

export const adminKpiQuerySchema = z.object({
  range: z
    .enum(RANGE_VALUES, {
      errorMap: () => ({
        message: `Range must be one of: ${RANGE_VALUES.join(", ")}.`,
      }),
    })
    .optional()
    .default("7d"),
  group_by: z
    .enum(GROUP_BY_VALUES, {
      errorMap: () => ({
        message: `Group by must be one of: ${GROUP_BY_VALUES.join(", ")}.`,
      }),
    })
    .optional()
    .default("day"),
  from: z.string().datetime("From date must be a valid ISO date string.").optional(),
  to: z.string().datetime("To date must be a valid ISO date string.").optional(),
});

export const customRangeValidationSchema = z
  .object({
    range: z.literal("custom"),
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine(
    (data) => {
      const fromDate = new Date(data.from);
      const toDate = new Date(data.to);
      const maxRangeDays = 90;

      const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays <= maxRangeDays;
    },
    {
      message: "Date range cannot exceed 90 days.",
      path: ["to"],
    }
  )
  .refine((data) => new Date(data.from) <= new Date(data.to), {
    message: "From date must be before or equal to to date.",
    path: ["from"],
  });

export type AdminKpiQuery = z.infer<typeof adminKpiQuerySchema>;
export type CustomRangeValidation = z.infer<typeof customRangeValidationSchema>;
