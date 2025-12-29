import { describe, it, expect } from "vitest";
import {
  generationCandidatesQuerySchema,
  decodeCandidateCursor,
  buildGenerationCandidatesQuery,
  InvalidCandidateCursorError,
  acceptGenerationCandidateSchema,
  rejectGenerationCandidateSchema,
  updateGenerationCandidateSchema,
  getCandidateParamsSchema,
  CANDIDATE_LIMIT_DEFAULT,
  CANDIDATE_LIMIT_MIN,
  CANDIDATE_LIMIT_MAX,
  CANDIDATE_STATUSES,
  ACCEPTABLE_ORIGINS,
  EDITABLE_CANDIDATE_STATUS,
  MAX_FRONT_LENGTH,
  MAX_BACK_LENGTH,
  type GenerationCandidatesQuerySchema,
} from "../generation-candidates.schema";

describe("generationCandidatesQuerySchema", () => {
  describe("generation_id validation", () => {
    it("accepts valid UUID", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
      });
      expect(result.success).toBe(true);
      expect(result.data?.generation_id).toBe("794d9f4a-3b8f-482f-a61c-0b4cce9b2f95");
    });

    it("rejects empty generation_id", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "",
        limit: 20,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Generation id must be a valid UUID.");
    });

    it("rejects invalid UUID format", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "not-a-uuid",
        limit: 20,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Generation id must be a valid UUID.");
    });
  });

  describe("limit validation", () => {
    it("accepts valid integer", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 50,
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it("accepts string number", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: "15",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(15);
    });

    it("defaults to CANDIDATE_LIMIT_DEFAULT for empty string", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: "",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(CANDIDATE_LIMIT_DEFAULT);
    });

    it("defaults to CANDIDATE_LIMIT_DEFAULT for null", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: null,
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(CANDIDATE_LIMIT_DEFAULT);
    });

    it("rejects non-integer", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: "abc",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be a valid integer.");
    });

    it("rejects below minimum", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: CANDIDATE_LIMIT_MIN - 1,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Limit must be at least ${CANDIDATE_LIMIT_MIN}.`);
    });

    it("rejects above maximum", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: CANDIDATE_LIMIT_MAX + 1,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Limit cannot exceed ${CANDIDATE_LIMIT_MAX}.`);
    });
  });

  describe("cursor validation", () => {
    it("accepts valid cursor string", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
        cursor: "valid-cursor",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("valid-cursor");
    });

    it("trims cursor string", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
        cursor: "  cursor  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("cursor");
    });

    it("rejects empty cursor", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
        cursor: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Cursor cannot be empty.");
    });

    it("accepts undefined cursor", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBeUndefined();
    });
  });

  describe("status[] validation", () => {
    it("accepts valid status array", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
        "status[]": ["proposed", "accepted"],
      });
      expect(result.success).toBe(true);
      expect(result.data?.["status[]"]).toEqual(["proposed", "accepted"]);
    });

    it("deduplicates status array", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
        "status[]": ["proposed", "proposed", "accepted"],
      });
      expect(result.success).toBe(true);
      expect(result.data?.["status[]"]).toEqual(["proposed", "accepted"]);
    });

    it("returns undefined for empty status array", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
        "status[]": [],
      });
      expect(result.success).toBe(true);
      expect(result.data?.["status[]"]).toBeUndefined();
    });

    it("rejects invalid status", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
        "status[]": ["invalid"],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Status must be one of: ${CANDIDATE_STATUSES.join(", ")}.`);
    });

    it("rejects too many statuses", () => {
      const tooManyStatuses = [...CANDIDATE_STATUSES, "extra"] as const;
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
        "status[]": tooManyStatuses,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        `Status filter cannot exceed ${CANDIDATE_STATUSES.length} entries.`
      );
    });

    it("accepts undefined status array", () => {
      const result = generationCandidatesQuerySchema.safeParse({
        generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        limit: 20,
      });
      expect(result.success).toBe(true);
      expect(result.data?.["status[]"]).toBeUndefined();
    });
  });
});

describe("decodeCandidateCursor", () => {
  it("decodes valid base64 UUID", () => {
    const result = decodeCandidateCursor("Nzk0ZDlmNGEtM2I4Zi00ODJmLWE2MWMtMGI0Y2NlOWIyZjk1"); // base64 for "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95"
    expect(result).toBe("794d9f4a-3b8f-482f-a61c-0b4cce9b2f95");
  });

  it("decodes base64 UUID with whitespace", () => {
    const result = decodeCandidateCursor("ICA3OTRkOWY0YS0zYjhmLTQ4MmYtYTYxYy0wYjRjY2U5YjJmOTUgIA=="); // base64 for "  794d9f4a-3b8f-482f-a61c-0b4cce9b2f95  "
    expect(result).toBe("794d9f4a-3b8f-482f-a61c-0b4cce9b2f95");
  });

  it("throws InvalidCandidateCursorError for invalid base64", () => {
    expect(() => decodeCandidateCursor("invalid-base64!")).toThrow(InvalidCandidateCursorError);
    expect(() => decodeCandidateCursor("invalid-base64!")).toThrow("Cursor must be a valid Base64 string.");
  });

  it("throws InvalidCandidateCursorError for non-UUID decoded value", () => {
    expect(() => decodeCandidateCursor("bm90LWEtLXV1aWQ=")).toThrow(InvalidCandidateCursorError); // base64 for "not-a-uuid"
    expect(() => decodeCandidateCursor("bm90LWEtLXV1aWQ=")).toThrow("Cursor must decode to a valid UUID.");
  });
});

describe("buildGenerationCandidatesQuery", () => {
  it("builds query with all fields", () => {
    const payload: GenerationCandidatesQuerySchema = {
      generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
      limit: 50,
      cursor: "YzFiMzhkODYtZDBhNS00ZTJkLWE3MGItMDJmNGIwMDcxYjRh", // base64 for "c1b38d86-d0a5-4e2d-a70b-02f4b0071b4a"
      "status[]": ["proposed", "accepted"],
    };

    const result = buildGenerationCandidatesQuery(payload);
    expect(result).toEqual({
      generationId: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
      statuses: ["proposed", "accepted"],
      cursor: "c1b38d86-d0a5-4e2d-a70b-02f4b0071b4a",
      limit: 50,
    });
  });

  it("builds query without optional fields", () => {
    const payload: GenerationCandidatesQuerySchema = {
      generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
      limit: 20,
    };

    const result = buildGenerationCandidatesQuery(payload);
    expect(result).toEqual({
      generationId: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
      limit: 20,
    });
  });

  it("handles undefined cursor", () => {
    const payload: GenerationCandidatesQuerySchema = {
      generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
      limit: 20,
      cursor: undefined,
      "status[]": undefined,
    };

    const result = buildGenerationCandidatesQuery(payload);
    expect(result.cursor).toBeUndefined();
    expect(result.statuses).toBeUndefined();
  });
});

describe("InvalidCandidateCursorError", () => {
  it("creates error with message", () => {
    const error = new InvalidCandidateCursorError("Test message");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InvalidCandidateCursorError");
    expect(error.message).toBe("Test message");
  });
});

describe("acceptGenerationCandidateSchema", () => {
  describe("category_id validation", () => {
    it("accepts valid positive integer", () => {
      const result = acceptGenerationCandidateSchema.safeParse({
        category_id: 5,
      });
      expect(result.success).toBe(true);
      expect(result.data?.category_id).toBe(5);
    });

    it("accepts undefined category_id", () => {
      const result = acceptGenerationCandidateSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.category_id).toBeUndefined();
    });

    it("rejects zero", () => {
      const result = acceptGenerationCandidateSchema.safeParse({
        category_id: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Value must be greater than 0.");
    });

    it("rejects negative number", () => {
      const result = acceptGenerationCandidateSchema.safeParse({
        category_id: -1,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Value must be greater than 0.");
    });
  });

  describe("tag_ids validation", () => {
    it("accepts valid unique positive integers", () => {
      const result = acceptGenerationCandidateSchema.safeParse({
        tag_ids: [1, 2, 3],
      });
      expect(result.success).toBe(true);
      expect(result.data?.tag_ids).toEqual([1, 2, 3]);
    });

    it("rejects duplicate tag_ids", () => {
      const result = acceptGenerationCandidateSchema.safeParse({
        tag_ids: [1, 2, 2, 3, 1],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Tag ids must be unique.");
    });

    it("accepts undefined tag_ids", () => {
      const result = acceptGenerationCandidateSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.tag_ids).toBeUndefined();
    });

    it("rejects non-array", () => {
      const result = acceptGenerationCandidateSchema.safeParse({
        tag_ids: "not-an-array",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Tag ids must be an array of integers.");
    });

    it("rejects zero in tag_ids", () => {
      const result = acceptGenerationCandidateSchema.safeParse({
        tag_ids: [1, 0, 3],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Value must be greater than 0.");
    });

    it("rejects too many tag_ids", () => {
      const tooManyTags = Array.from({ length: 51 }, (_, i) => i + 1);
      const result = acceptGenerationCandidateSchema.safeParse({
        tag_ids: tooManyTags,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Tag selection cannot exceed 50 entries.");
    });
  });

  describe("content_source_id validation", () => {
    it("accepts valid positive integer", () => {
      const result = acceptGenerationCandidateSchema.safeParse({
        content_source_id: 10,
      });
      expect(result.success).toBe(true);
      expect(result.data?.content_source_id).toBe(10);
    });

    it("accepts undefined content_source_id", () => {
      const result = acceptGenerationCandidateSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.content_source_id).toBeUndefined();
    });
  });

  describe("origin validation", () => {
    it("accepts valid origin", () => {
      ACCEPTABLE_ORIGINS.forEach((origin) => {
        const result = acceptGenerationCandidateSchema.safeParse({
          origin,
        });
        expect(result.success).toBe(true);
        expect(result.data?.origin).toBe(origin);
      });
    });

    it("accepts undefined origin", () => {
      const result = acceptGenerationCandidateSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.origin).toBeUndefined();
    });

    it("rejects invalid origin", () => {
      const result = acceptGenerationCandidateSchema.safeParse({
        origin: "invalid-origin",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Origin must be one of: ${ACCEPTABLE_ORIGINS.join(", ")}.`);
    });
  });
});

describe("rejectGenerationCandidateSchema", () => {
  it("accepts empty object", () => {
    const result = rejectGenerationCandidateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects non-empty object", () => {
    const result = rejectGenerationCandidateSchema.safeParse({
      reason: "spam",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Unrecognized key(s) in object: 'reason'");
  });
});

describe("updateGenerationCandidateSchema", () => {
  describe("front validation", () => {
    it("accepts valid front text", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        front: "Valid front text",
      });
      expect(result.success).toBe(true);
      expect(result.data?.front).toBe("Valid front text");
    });

    it("trims front text", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        front: "  Valid front text  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.front).toBe("Valid front text");
    });

    it("rejects empty front", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        front: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Front text must contain at least 1 character.");
    });

    it("rejects whitespace-only front", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        front: "   ",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Front text must contain at least 1 character.");
    });

    it("rejects front too long", () => {
      const longFront = "a".repeat(MAX_FRONT_LENGTH + 1);
      const result = updateGenerationCandidateSchema.safeParse({
        front: longFront,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Front text cannot exceed ${MAX_FRONT_LENGTH} characters.`);
    });
  });

  describe("back validation", () => {
    it("accepts valid back text", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        back: "Valid back text",
      });
      expect(result.success).toBe(true);
      expect(result.data?.back).toBe("Valid back text");
    });

    it("trims back text", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        back: "  Valid back text  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.back).toBe("Valid back text");
    });

    it("rejects empty back", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        back: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Back text must contain at least 1 character.");
    });

    it("rejects back too long", () => {
      const longBack = "a".repeat(MAX_BACK_LENGTH + 1);
      const result = updateGenerationCandidateSchema.safeParse({
        back: longBack,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Back text cannot exceed ${MAX_BACK_LENGTH} characters.`);
    });
  });

  describe("status validation", () => {
    it("accepts edited status", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        status: EDITABLE_CANDIDATE_STATUS,
      });
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(EDITABLE_CANDIDATE_STATUS);
    });

    it("rejects other statuses", () => {
      const invalidStatuses = CANDIDATE_STATUSES.filter((s) => s !== EDITABLE_CANDIDATE_STATUS);
      invalidStatuses.forEach((status) => {
        const result = updateGenerationCandidateSchema.safeParse({
          status,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(`Status must be set to "${EDITABLE_CANDIDATE_STATUS}".`);
      });
    });

    it("accepts undefined status", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        front: "Updated front",
      });
      expect(result.success).toBe(true);
      expect(result.data?.status).toBeUndefined();
    });
  });

  describe("required fields validation", () => {
    it("requires at least one field", () => {
      const result = updateGenerationCandidateSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("At least one property must be provided to update the candidate.");
    });

    it("accepts single field updates", () => {
      const singleFieldUpdates = [{ front: "New front" }, { back: "New back" }, { status: EDITABLE_CANDIDATE_STATUS }];

      singleFieldUpdates.forEach((update) => {
        const result = updateGenerationCandidateSchema.safeParse(update);
        expect(result.success).toBe(true);
      });
    });

    it("accepts multiple field updates", () => {
      const result = updateGenerationCandidateSchema.safeParse({
        front: "New front",
        back: "New back",
        status: EDITABLE_CANDIDATE_STATUS,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("getCandidateParamsSchema", () => {
  it("accepts valid UUID", () => {
    const result = getCandidateParamsSchema.safeParse({
      id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
    });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe("794d9f4a-3b8f-482f-a61c-0b4cce9b2f95");
  });

  it("rejects empty id", () => {
    const result = getCandidateParamsSchema.safeParse({
      id: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Candidate id must be a valid UUID.");
  });

  it("rejects invalid UUID", () => {
    const result = getCandidateParamsSchema.safeParse({
      id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Candidate id must be a valid UUID.");
  });
});
