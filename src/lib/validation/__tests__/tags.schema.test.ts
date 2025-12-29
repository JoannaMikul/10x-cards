import { describe, it, expect } from "vitest";
import {
  tagsQuerySchema,
  decodeTagCursor,
  buildTagsQuery,
  InvalidTagCursorError,
  TAG_LIMIT_DEFAULT,
  TAG_LIMIT_MIN,
  TAG_LIMIT_MAX,
  TAG_SORT_FIELDS,
} from "../tags.schema";

describe("tagsQuerySchema", () => {
  describe("search validation", () => {
    it("accepts valid search query", () => {
      const result = tagsQuerySchema.safeParse({
        search: "test query",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBe("test query");
    });

    it("trims search query", () => {
      const result = tagsQuerySchema.safeParse({
        search: "  test query  ",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBe("test query");
    });

    it("accepts undefined search when empty string provided", () => {
      const result = tagsQuerySchema.safeParse({
        search: "   ",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBeUndefined();
    });

    it("rejects search exceeding max length", () => {
      const longSearch = "a".repeat(201);
      const result = tagsQuerySchema.safeParse({
        search: longSearch,
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Search query cannot exceed 200 characters.");
    });

    it("accepts undefined search for non-string values", () => {
      const result = tagsQuerySchema.safeParse({
        search: 123,
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBeUndefined();
    });
  });

  describe("limit validation", () => {
    it("accepts valid numeric limit", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 50,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it("accepts valid string limit", () => {
      const result = tagsQuerySchema.safeParse({
        limit: "30",
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(30);
    });

    it("uses default limit for empty string", () => {
      const result = tagsQuerySchema.safeParse({
        limit: "",
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(TAG_LIMIT_DEFAULT);
    });

    it("uses default limit for null/undefined", () => {
      const result = tagsQuerySchema.safeParse({
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(TAG_LIMIT_DEFAULT);
    });

    it("rejects limit below minimum", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 0,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Limit must be at least ${TAG_LIMIT_MIN}.`);
    });

    it("rejects limit above maximum", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 101,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Limit cannot exceed ${TAG_LIMIT_MAX}.`);
    });

    it("rejects non-integer limit", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 10.5,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be a valid integer.");
    });

    it("rejects invalid string limit", () => {
      const result = tagsQuerySchema.safeParse({
        limit: "invalid",
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be a valid integer.");
    });
  });

  describe("sort validation", () => {
    it("accepts valid sort fields", () => {
      TAG_SORT_FIELDS.forEach((sortField) => {
        const result = tagsQuerySchema.safeParse({
          limit: 20,
          sort: sortField,
        });
        expect(result.success).toBe(true);
        expect(result.data?.sort).toBe(sortField);
      });
    });

    it("normalizes sort to lowercase and trims", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 20,
        sort: "  CREATED_AT  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("created_at");
    });

    it("uses default sort for empty string", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 20,
        sort: "",
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("name");
    });

    it("uses default sort for non-string values", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 20,
        sort: 123,
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("name");
    });

    it("rejects invalid sort field", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 20,
        sort: "invalid",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Sort must be one of: ${TAG_SORT_FIELDS.join(", ")}.`);
    });
  });

  describe("cursor validation", () => {
    it("accepts valid cursor string", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 20,
        sort: "name",
        cursor: "valid_cursor",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("valid_cursor");
    });

    it("trims cursor", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 20,
        sort: "name",
        cursor: "  valid_cursor  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("valid_cursor");
    });

    it("accepts undefined cursor", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBeUndefined();
    });

    it("rejects empty cursor", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 20,
        sort: "name",
        cursor: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Cursor cannot be empty.");
    });
  });

  describe("complete schema validation", () => {
    it("accepts complete valid payload", () => {
      const result = tagsQuerySchema.safeParse({
        search: "test search",
        limit: 25,
        cursor: "cursor123",
        sort: "created_at",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        search: "test search",
        limit: 25,
        cursor: "cursor123",
        sort: "created_at",
      });
    });

    it("accepts minimal valid payload", () => {
      const result = tagsQuerySchema.safeParse({
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        limit: 20,
        sort: "name",
      });
    });
  });
});

describe("decodeTagCursor", () => {
  it("decodes valid base64 cursor to number", () => {
    const result = decodeTagCursor("MTIz"); // "123" in base64
    expect(result).toBe(123);
  });

  it("handles base64 with whitespace", () => {
    const result = decodeTagCursor("  MTIz  "); // "123" in base64 with spaces
    expect(result).toBe(123);
  });

  it("throws InvalidTagCursorError for invalid base64", () => {
    expect(() => decodeTagCursor("invalid_base64!")).toThrow(InvalidTagCursorError);
    expect(() => decodeTagCursor("invalid_base64!")).toThrow("Cursor must be a valid Base64 string.");
  });

  it("throws InvalidTagCursorError for non-numeric decoded value", () => {
    expect(() => decodeTagCursor("aGVsbG8=")).toThrow(InvalidTagCursorError); // "hello" in base64
    expect(() => decodeTagCursor("aGVsbG8=")).toThrow("Cursor must decode to a positive integer identifier.");
  });

  it("throws InvalidTagCursorError for zero", () => {
    expect(() => decodeTagCursor("MA==")).toThrow(InvalidTagCursorError); // "0" in base64
    expect(() => decodeTagCursor("MA==")).toThrow("Cursor must decode to a positive integer identifier.");
  });

  it("throws InvalidTagCursorError for negative number", () => {
    expect(() => decodeTagCursor("LTE=")).toThrow(InvalidTagCursorError); // "-1" in base64
    expect(() => decodeTagCursor("LTE=")).toThrow("Cursor must decode to a positive integer identifier.");
  });

  it("throws InvalidTagCursorError for non-numeric decoded value", () => {
    expect(() => decodeTagCursor("YWJj")).toThrow(InvalidTagCursorError); // "abc" in base64
    expect(() => decodeTagCursor("YWJj")).toThrow("Cursor must decode to a positive integer identifier.");
  });
});

describe("buildTagsQuery", () => {
  it("builds query without cursor", () => {
    const payload = {
      search: "test",
      limit: 25,
      sort: "name" as const,
    };
    const result = buildTagsQuery(payload);
    expect(result).toEqual({
      search: "test",
      limit: 25,
      sort: "name",
    });
  });

  it("builds query with valid cursor", () => {
    const payload = {
      limit: 30,
      sort: "created_at" as const,
      cursor: "MTIz", // "123" in base64
    };
    const result = buildTagsQuery(payload);
    expect(result).toEqual({
      limit: 30,
      sort: "created_at",
      cursor: 123,
    });
  });

  it("throws InvalidTagCursorError for invalid cursor", () => {
    const payload = {
      limit: 20,
      sort: "name" as const,
      cursor: "YWJj", // "abc" in base64 - valid base64 but not a number
    };
    expect(() => buildTagsQuery(payload)).toThrow(InvalidTagCursorError);
    expect(() => buildTagsQuery(payload)).toThrow("Cursor must decode to a positive integer identifier.");
  });
});

describe("InvalidTagCursorError", () => {
  it("creates error with correct name and message", () => {
    const error = new InvalidTagCursorError("Test message");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InvalidTagCursorError");
    expect(error.message).toBe("Test message");
  });
});
