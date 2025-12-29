import { describe, it, expect } from "vitest";
import {
  createFlashcardSchema,
  updateFlashcardSchema,
  flashcardsQuerySchema,
  flashcardIdParamSchema,
  setFlashcardTagsSchema,
  decodeFlashcardsCursor,
  buildFlashcardsQuery,
  parseFlashcardId,
  InvalidFlashcardsCursorError,
  type FlashcardsQueryPayload,
  type FlashcardIdParamPayload,
} from "../flashcards.schema";

describe("createFlashcardSchema", () => {
  describe("valid inputs", () => {
    it("accepts minimal valid flashcard", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchInlineSnapshot(`
        {
          "back": "Answer",
          "front": "Question",
          "origin": "manual",
        }
      `);
    });

    it("accepts full flashcard with all optional fields", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "ai-full",
        category_id: 1,
        content_source_id: 2,
        tag_ids: [1, 2, 3],
        metadata: { key: "value" },
        next_review_at: "2024-01-01T12:00:00Z",
      });
      expect(result.success).toBe(true);
      expect(result.data?.tag_ids).toEqual([1, 2, 3]);
      expect(result.data?.next_review_at).toBe("2024-01-01T12:00:00Z");
    });
  });

  describe("front validation", () => {
    it("rejects empty front", () => {
      const result = createFlashcardSchema.safeParse({
        front: "",
        back: "Answer",
        origin: "manual",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Front text cannot be empty.");
    });

    it("rejects front exceeding max length", () => {
      const result = createFlashcardSchema.safeParse({
        front: "a".repeat(201),
        back: "Answer",
        origin: "manual",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Front text cannot exceed 200 characters.");
    });

    it("trims whitespace from front", () => {
      const result = createFlashcardSchema.safeParse({
        front: "  Question  ",
        back: "Answer",
        origin: "manual",
      });
      expect(result.success).toBe(true);
      expect(result.data?.front).toBe("Question");
    });
  });

  describe("back validation", () => {
    it("rejects empty back", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "",
        origin: "manual",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Back text cannot be empty.");
    });

    it("rejects back exceeding max length", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "a".repeat(501),
        origin: "manual",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Back text cannot exceed 500 characters.");
    });
  });

  describe("origin validation", () => {
    it("accepts all valid origins", () => {
      const origins = ["ai-full", "ai-edited", "manual"] as const;
      origins.forEach((origin) => {
        const result = createFlashcardSchema.safeParse({
          front: "Question",
          back: "Answer",
          origin,
        });
        expect(result.success).toBe(true);
      });
    });

    it("rejects invalid origin", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "invalid",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Origin must be one of: ai-full, ai-edited, manual.");
    });
  });

  describe("tag_ids validation", () => {
    it("accepts unique tag ids", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
        tag_ids: [1, 2, 3],
      });
      expect(result.success).toBe(true);
    });

    it("rejects duplicate tag ids", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
        tag_ids: [1, 1, 2],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Tag IDs must be unique.");
    });

    it("rejects too many tags", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
        tag_ids: Array.from({ length: 51 }, (_, i) => i + 1),
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Tag selection cannot exceed 50 entries.");
    });
  });

  describe("next_review_at validation", () => {
    it("accepts valid ISO datetime string", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
        next_review_at: "2024-01-01T12:00:00Z",
      });
      expect(result.success).toBe(true);
      expect(result.data?.next_review_at).toBe("2024-01-01T12:00:00Z");
    });

    it("accepts valid ISO datetime with milliseconds", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
        next_review_at: "2024-01-01T12:00:00.123Z",
      });
      expect(result.success).toBe(true);
      expect(result.data?.next_review_at).toBe("2024-01-01T12:00:00.123Z");
    });

    it("rejects invalid datetime string", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
        next_review_at: "not-a-date",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Next review date must be a valid ISO date string.");
    });

    it("rejects invalid date format", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
        next_review_at: "01-01-2024",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Next review date must be a valid ISO date string.");
    });

    it("rejects empty string", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
        next_review_at: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Next review date must be a valid ISO date string.");
    });

    it("accepts undefined (optional field)", () => {
      const result = createFlashcardSchema.safeParse({
        front: "Question",
        back: "Answer",
        origin: "manual",
      });
      expect(result.success).toBe(true);
      expect(result.data?.next_review_at).toBeUndefined();
    });
  });
});

describe("updateFlashcardSchema", () => {
  describe("valid inputs", () => {
    it("accepts partial updates", () => {
      const result = updateFlashcardSchema.safeParse({
        front: "Updated question",
      });
      expect(result.success).toBe(true);
      expect(result.data?.front).toBe("Updated question");
    });

    it("accepts soft delete", () => {
      const result = updateFlashcardSchema.safeParse({
        deleted_at: true,
      });
      expect(result.success).toBe(true);
      expect(result.data?.deleted_at).toBe(true);
    });

    it("accepts datetime string for deleted_at", () => {
      const datetime = "2024-01-01T00:00:00Z";
      const result = updateFlashcardSchema.safeParse({
        deleted_at: datetime,
      });
      expect(result.success).toBe(true);
      expect(result.data?.deleted_at).toBe(datetime);
    });
  });

  describe("field validation", () => {
    it("validates front length", () => {
      const result = updateFlashcardSchema.safeParse({
        front: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Front text cannot be empty.");
    });

    it("validates back length", () => {
      const result = updateFlashcardSchema.safeParse({
        back: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Back text cannot be empty.");
    });

    it("validates next_review_at format", () => {
      const result = updateFlashcardSchema.safeParse({
        next_review_at: "invalid-date",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Next review date must be a valid ISO date string.");
    });

    it("accepts valid next_review_at", () => {
      const result = updateFlashcardSchema.safeParse({
        next_review_at: "2024-01-01T12:00:00Z",
      });
      expect(result.success).toBe(true);
      expect(result.data?.next_review_at).toBe("2024-01-01T12:00:00Z");
    });
  });
});

describe("flashcardsQuerySchema", () => {
  describe("limit validation", () => {
    it("uses default limit when not provided", () => {
      const result = flashcardsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });

    it("accepts valid limit string", () => {
      const result = flashcardsQuerySchema.safeParse({ limit: "10" });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(10);
    });

    it("rejects limit below minimum", () => {
      const result = flashcardsQuerySchema.safeParse({ limit: "0" });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be between 1 and 100.");
    });

    it("rejects limit above maximum", () => {
      const result = flashcardsQuerySchema.safeParse({ limit: "101" });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be between 1 and 100.");
    });
  });

  describe("cursor validation", () => {
    it("accepts valid base64 cursor", () => {
      const cursor = Buffer.from("2024-01-01T00:00:00Z#123e4567-e89b-12d3-a456-426614174000").toString("base64");
      const result = flashcardsQuerySchema.safeParse({ cursor });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe(cursor);
    });

    it("rejects invalid base64 cursor", () => {
      const result = flashcardsQuerySchema.safeParse({ cursor: "invalid!" });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Cursor must be a valid base64 string.");
    });
  });

  describe("search validation", () => {
    it("accepts valid search string", () => {
      const result = flashcardsQuerySchema.safeParse({ search: "test query" });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBe("test query");
    });

    it("trims search string", () => {
      const result = flashcardsQuerySchema.safeParse({ search: "  test  " });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBe("test");
    });

    it("rejects search too short", () => {
      const result = flashcardsQuerySchema.safeParse({ search: "" });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Search term must be at least 1 character.");
    });

    it("rejects search too long", () => {
      const result = flashcardsQuerySchema.safeParse({ search: "a".repeat(201) });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Search term cannot exceed 200 characters.");
    });
  });

  describe("sort validation", () => {
    it("accepts valid sort fields", () => {
      const validSorts = ["created_at", "-created_at", "updated_at", "next_review_at"];
      validSorts.forEach((sort) => {
        const result = flashcardsQuerySchema.safeParse({ sort });
        expect(result.success).toBe(true);
      });
    });

    it("rejects invalid sort field", () => {
      const result = flashcardsQuerySchema.safeParse({ sort: "invalid" });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "Sort must be one of: created_at, -created_at, updated_at, next_review_at."
      );
    });
  });

  describe("include_deleted validation", () => {
    it("converts string to boolean", () => {
      const result = flashcardsQuerySchema.safeParse({ include_deleted: "true" });
      expect(result.success).toBe(true);
      expect(result.data?.include_deleted).toBe(true);
    });

    it("defaults to false", () => {
      const result = flashcardsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.include_deleted).toBe(false);
    });
  });
});

describe("flashcardIdParamSchema", () => {
  it("accepts valid UUID", () => {
    const result = flashcardIdParamSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("rejects invalid UUID", () => {
    const result = flashcardIdParamSchema.safeParse({ id: "invalid" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("ID must be a valid UUID.");
  });
});

describe("setFlashcardTagsSchema", () => {
  it("accepts valid tag ids", () => {
    const result = setFlashcardTagsSchema.safeParse({ tag_ids: [1, 2, 3] });
    expect(result.success).toBe(true);
    expect(result.data?.tag_ids).toEqual([1, 2, 3]);
  });

  it("rejects duplicate tag ids", () => {
    const result = setFlashcardTagsSchema.safeParse({ tag_ids: [1, 1] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Tag IDs must be unique.");
  });

  it("rejects non-array input", () => {
    const result = setFlashcardTagsSchema.safeParse({ tag_ids: "not array" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Tag IDs must be an array of numbers.");
  });
});

describe("decodeFlashcardsCursor", () => {
  it("decodes valid cursor", () => {
    const createdAt = "2024-01-01T00:00:00Z";
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const cursor = Buffer.from(`${createdAt}#${id}`).toString("base64");

    const result = decodeFlashcardsCursor(cursor);
    expect(result).toEqual({ createdAt, id });
  });

  it("throws for invalid base64", () => {
    expect(() => decodeFlashcardsCursor("invalid!")).toThrow(InvalidFlashcardsCursorError);
    expect(() => decodeFlashcardsCursor("invalid!")).toThrow("Failed to decode cursor from base64.");
  });

  it("throws for wrong number of parts", () => {
    const cursor = Buffer.from("2024-01-01T00:00:00Z").toString("base64");
    expect(() => decodeFlashcardsCursor(cursor)).toThrow(InvalidFlashcardsCursorError);
    expect(() => decodeFlashcardsCursor(cursor)).toThrow("Cursor must contain exactly one '#' separator.");
  });

  it("throws for empty parts", () => {
    const cursor = Buffer.from("#").toString("base64");
    expect(() => decodeFlashcardsCursor(cursor)).toThrow(InvalidFlashcardsCursorError);
    expect(() => decodeFlashcardsCursor(cursor)).toThrow("Cursor parts cannot be empty.");
  });

  it("throws for invalid date", () => {
    const cursor = Buffer.from("invalid-date#123").toString("base64");
    expect(() => decodeFlashcardsCursor(cursor)).toThrow(InvalidFlashcardsCursorError);
    expect(() => decodeFlashcardsCursor(cursor)).toThrow("Invalid created_at timestamp in cursor.");
  });
});

describe("buildFlashcardsQuery", () => {
  it("builds query with defaults", () => {
    const payload: FlashcardsQueryPayload = { limit: 20, include_deleted: false };
    const result = buildFlashcardsQuery(payload);

    expect(result).toEqual({
      limit: 20,
      cursor: undefined,
      categoryId: undefined,
      contentSourceId: undefined,
      origin: undefined,
      tagIds: undefined,
      search: undefined,
      sort: "-created_at",
      includeDeleted: false,
    });
  });

  it("builds query with all fields", () => {
    const cursor = Buffer.from("2024-01-01T00:00:00Z#123").toString("base64");
    const payload: FlashcardsQueryPayload = {
      limit: 10,
      cursor,
      category_id: 1,
      content_source_id: 2,
      origin: "manual",
      tag_ids: [1, 2],
      search: "test",
      sort: "created_at",
      include_deleted: true,
    };

    const result = buildFlashcardsQuery(payload);
    expect(result.limit).toBe(10);
    expect(result.cursor).toEqual({ createdAt: "2024-01-01T00:00:00Z", id: "123" });
    expect(result.categoryId).toBe(1);
    expect(result.contentSourceId).toBe(2);
    expect(result.origin).toBe("manual");
    expect(result.tagIds).toEqual([1, 2]);
    expect(result.search).toBe("test");
    expect(result.sort).toBe("created_at");
    expect(result.includeDeleted).toBe(true);
  });

  it("throws for invalid cursor", () => {
    const payload: FlashcardsQueryPayload = {
      limit: 20,
      cursor: "invalid",
      include_deleted: false,
    };

    expect(() => buildFlashcardsQuery(payload)).toThrow(InvalidFlashcardsCursorError);
  });
});

describe("parseFlashcardId", () => {
  it("returns the id", () => {
    const params: FlashcardIdParamPayload = { id: "123e4567-e89b-12d3-a456-426614174000" };
    const result = parseFlashcardId(params);
    expect(result).toBe("123e4567-e89b-12d3-a456-426614174000");
  });
});

describe("InvalidFlashcardsCursorError", () => {
  it("has correct properties", () => {
    const error = new InvalidFlashcardsCursorError("test message");
    expect(error.message).toBe("test message");
    expect(error.name).toBe("InvalidFlashcardsCursorError");
    expect(error.code).toBe("INVALID_CURSOR");
  });
});
