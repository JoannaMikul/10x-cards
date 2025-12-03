import { z } from "zod";

import { decodeBase64 } from "../utils/base64.ts";

export const CANDIDATE_LIMIT_DEFAULT = 20;
export const CANDIDATE_LIMIT_MIN = 1;
export const CANDIDATE_LIMIT_MAX = 100;

export const CANDIDATE_STATUSES = ["proposed", "edited", "accepted", "rejected"] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export interface GenerationCandidatesQuery {
  generationId: string;
  statuses?: CandidateStatus[];
  limit: number;
  cursor?: string;
}

const generationIdSchema = z
  .string({
    required_error: "Generation id is required.",
    invalid_type_error: "Generation id must be a string.",
  })
  .uuid("Generation id must be a valid UUID.");

const limitSchema = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return CANDIDATE_LIMIT_DEFAULT;
      }

      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : value;
    }

    if (value == null) {
      return CANDIDATE_LIMIT_DEFAULT;
    }

    return value;
  },
  z
    .number({
      invalid_type_error: "Limit must be a valid integer.",
    })
    .int("Limit must be a valid integer.")
    .min(CANDIDATE_LIMIT_MIN, `Limit must be at least ${CANDIDATE_LIMIT_MIN}.`)
    .max(CANDIDATE_LIMIT_MAX, `Limit cannot exceed ${CANDIDATE_LIMIT_MAX}.`)
);

const statusesSchema = z
  .array(
    z.enum(CANDIDATE_STATUSES, {
      errorMap: () => ({
        message: `Status must be one of: ${CANDIDATE_STATUSES.join(", ")}.`,
      }),
    }),
    {
      invalid_type_error: "Status filter must be an array.",
    }
  )
  .max(CANDIDATE_STATUSES.length, `Status filter cannot exceed ${CANDIDATE_STATUSES.length} entries.`)
  .optional()
  .transform((value) => {
    if (!value || value.length === 0) {
      return undefined;
    }

    const deduplicated = Array.from(new Set(value));
    return deduplicated.length ? deduplicated : undefined;
  });

const cursorSchema = z
  .string({
    invalid_type_error: "Cursor must be a string.",
  })
  .trim()
  .min(1, "Cursor cannot be empty.")
  .optional();

export const generationCandidatesQuerySchema = z.object({
  generation_id: generationIdSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  "status[]": statusesSchema,
});

export type GenerationCandidatesQuerySchema = z.infer<typeof generationCandidatesQuerySchema>;

export class InvalidCandidateCursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCandidateCursorError";
  }
}

export function decodeCandidateCursor(value: string): string {
  let decoded: string;
  try {
    decoded = decodeBase64(value);
  } catch {
    throw new InvalidCandidateCursorError("Cursor must be a valid Base64 string.");
  }

  const trimmed = decoded.trim();
  const uuidResult = z
    .string({
      invalid_type_error: "Cursor must decode to a valid UUID.",
    })
    .uuid("Cursor must decode to a valid UUID.")
    .safeParse(trimmed);

  if (!uuidResult.success) {
    throw new InvalidCandidateCursorError("Cursor must decode to a valid UUID.");
  }

  return trimmed;
}

export function buildGenerationCandidatesQuery(payload: GenerationCandidatesQuerySchema): GenerationCandidatesQuery {
  const { cursor, generation_id, "status[]": statuses, ...rest } = payload;
  return {
    generationId: generation_id,
    statuses,
    cursor: cursor ? decodeCandidateCursor(cursor) : undefined,
    ...rest,
  };
}

const positiveIntSchema = z
  .number({
    required_error: "Value is required.",
    invalid_type_error: "Value must be a number.",
  })
  .int("Value must be an integer.")
  .positive("Value must be greater than 0.");

const tagIdsSchema = z
  .array(positiveIntSchema, {
    invalid_type_error: "Tag ids must be an array of integers.",
  })
  .max(50, "Tag selection cannot exceed 50 entries.")
  .refine((values) => new Set(values).size === values.length, "Tag ids must be unique.")
  .optional();

const ACCEPTABLE_ORIGINS = ["ai-full", "ai-edited"] as const;
const EDITABLE_CANDIDATE_STATUS = "edited" as const;
const MAX_FRONT_LENGTH = 200;
const MAX_BACK_LENGTH = 500;

export const getCandidateParamsSchema = z.object({
  id: z
    .string({
      required_error: "Candidate id is required.",
      invalid_type_error: "Candidate id must be a string.",
    })
    .uuid("Candidate id must be a valid UUID."),
});

export const acceptGenerationCandidateSchema = z.object({
  category_id: positiveIntSchema.optional(),
  tag_ids: tagIdsSchema,
  content_source_id: positiveIntSchema.optional(),
  origin: z
    .enum(ACCEPTABLE_ORIGINS, {
      errorMap: () => ({
        message: `Origin must be one of: ${ACCEPTABLE_ORIGINS.join(", ")}.`,
      }),
    })
    .optional(),
});

export type GetCandidateParamsSchema = z.infer<typeof getCandidateParamsSchema>;
export type AcceptGenerationCandidateSchema = z.infer<typeof acceptGenerationCandidateSchema>;
export const rejectGenerationCandidateSchema = z.object({}).strict();
export type RejectGenerationCandidateSchema = z.infer<typeof rejectGenerationCandidateSchema>;

const candidateFrontSchema = z
  .string({
    invalid_type_error: "Front text must be a string.",
  })
  .trim()
  .min(1, "Front text must contain at least 1 character.")
  .max(MAX_FRONT_LENGTH, `Front text cannot exceed ${MAX_FRONT_LENGTH} characters.`);

const candidateBackSchema = z
  .string({
    invalid_type_error: "Back text must be a string.",
  })
  .trim()
  .min(1, "Back text must contain at least 1 character.")
  .max(MAX_BACK_LENGTH, `Back text cannot exceed ${MAX_BACK_LENGTH} characters.`);

export const updateGenerationCandidateSchema = z
  .object({
    front: candidateFrontSchema.optional(),
    back: candidateBackSchema.optional(),
    status: z
      .literal(EDITABLE_CANDIDATE_STATUS, {
        errorMap: () => ({
          message: `Status must be set to "${EDITABLE_CANDIDATE_STATUS}".`,
        }),
      })
      .optional(),
  })
  .strict()
  .refine((payload) => payload.front !== undefined || payload.back !== undefined || payload.status !== undefined, {
    message: "At least one property must be provided to update the candidate.",
  });

export type UpdateGenerationCandidateSchema = z.infer<typeof updateGenerationCandidateSchema>;
