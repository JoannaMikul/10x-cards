import { describe, it, expect } from "vitest";
import {
  sourcesQuerySchema,
  decodeSourceCursor,
  buildSourcesQuery,
  InvalidSourceCursorError,
  SOURCE_LIMIT_DEFAULT,
  SOURCE_LIMIT_MIN,
  SOURCE_LIMIT_MAX,
  SOURCE_SORT_FIELDS,
  SOURCE_KIND_VALUES,
} from "../sources.schema";

describe("sourcesQuerySchema", () => {
  describe("kind validation", () => {
    it("accepts valid kind values", () => {
      SOURCE_KIND_VALUES.forEach((kind) => {
        const result = sourcesQuerySchema.safeParse({
          kind,
          limit: 20,
          sort: "name",
        });
        expect(result.success).toBe(true);
        expect(result.data?.kind).toBe(kind);
      });
    });

    it("normalizes kind to lowercase and trims", () => {
      const result = sourcesQuerySchema.safeParse({
        kind: "  BOOK  ",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe("book");
    });

    it("accepts undefined kind when empty string provided", () => {
      const result = sourcesQuerySchema.safeParse({
        kind: "   ",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.kind).toBeUndefined();
    });

    it("rejects invalid kind", () => {
      const result = sourcesQuerySchema.safeParse({
        kind: "invalid",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Kind must be one of: ${SOURCE_KIND_VALUES.join(", ")}.`);
    });

    it("accepts undefined kind for non-string values", () => {
      const result = sourcesQuerySchema.safeParse({
        kind: 123,
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.kind).toBeUndefined();
    });
  });

  describe("search validation", () => {
    it("accepts valid search query", () => {
      const result = sourcesQuerySchema.safeParse({
        search: "test query",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBe("test query");
    });

    it("trims search query", () => {
      const result = sourcesQuerySchema.safeParse({
        search: "  test query  ",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBe("test query");
    });

    it("accepts undefined search when empty string provided", () => {
      const result = sourcesQuerySchema.safeParse({
        search: "   ",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBeUndefined();
    });

    it("rejects search exceeding max length", () => {
      const longSearch = "a".repeat(201);
      const result = sourcesQuerySchema.safeParse({
        search: longSearch,
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Search query cannot exceed 200 characters.");
    });

    it("accepts undefined search for non-string values", () => {
      const result = sourcesQuerySchema.safeParse({
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
      const result = sourcesQuerySchema.safeParse({
        limit: 50,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it("accepts valid string limit", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: "30",
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(30);
    });

    it("uses default limit for empty string", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: "",
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(SOURCE_LIMIT_DEFAULT);
    });

    it("uses default limit for null/undefined", () => {
      const result = sourcesQuerySchema.safeParse({
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(SOURCE_LIMIT_DEFAULT);
    });

    it("rejects limit below minimum", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 0,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Limit must be at least ${SOURCE_LIMIT_MIN}.`);
    });

    it("rejects limit above maximum", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 101,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Limit cannot exceed ${SOURCE_LIMIT_MAX}.`);
    });

    it("rejects non-integer limit", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 10.5,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be a valid integer.");
    });

    it("rejects invalid string limit", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: "invalid",
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be a valid integer.");
    });
  });

  describe("sort validation", () => {
    it("accepts valid sort fields", () => {
      SOURCE_SORT_FIELDS.forEach((sortField) => {
        const result = sourcesQuerySchema.safeParse({
          limit: 20,
          sort: sortField,
        });
        expect(result.success).toBe(true);
        expect(result.data?.sort).toBe(sortField);
      });
    });

    it("normalizes sort to lowercase and trims", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 20,
        sort: "  CREATED_AT  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("created_at");
    });

    it("uses default sort for empty string", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 20,
        sort: "",
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("name");
    });

    it("uses default sort for non-string values", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 20,
        sort: 123,
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("name");
    });

    it("rejects invalid sort field", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 20,
        sort: "invalid",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Sort must be one of: ${SOURCE_SORT_FIELDS.join(", ")}.`);
    });
  });

  describe("cursor validation", () => {
    it("accepts valid cursor string", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 20,
        sort: "name",
        cursor: "valid_cursor",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("valid_cursor");
    });

    it("trims cursor", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 20,
        sort: "name",
        cursor: "  valid_cursor  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("valid_cursor");
    });

    it("accepts undefined cursor", () => {
      const result = sourcesQuerySchema.safeParse({
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBeUndefined();
    });

    it("rejects empty cursor", () => {
      const result = sourcesQuerySchema.safeParse({
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
      const result = sourcesQuerySchema.safeParse({
        kind: "book",
        search: "test search",
        limit: 25,
        cursor: "cursor123",
        sort: "created_at",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        kind: "book",
        search: "test search",
        limit: 25,
        cursor: "cursor123",
        sort: "created_at",
      });
    });

    it("accepts minimal valid payload", () => {
      const result = sourcesQuerySchema.safeParse({
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

describe("decodeSourceCursor", () => {
  it("decodes valid base64 cursor to number", () => {
    const result = decodeSourceCursor("MTIz"); // "123" in base64
    expect(result).toBe(123);
  });

  it("handles base64 with whitespace", () => {
    const result = decodeSourceCursor("  MTIz  "); // "123" in base64 with spaces
    expect(result).toBe(123);
  });

  it("throws InvalidSourceCursorError for invalid base64", () => {
    expect(() => decodeSourceCursor("invalid_base64!")).toThrow(InvalidSourceCursorError);
    expect(() => decodeSourceCursor("invalid_base64!")).toThrow("Cursor must be a valid Base64 string.");
  });

  it("throws InvalidSourceCursorError for non-numeric decoded value", () => {
    expect(() => decodeSourceCursor("aGVsbG8=")).toThrow(InvalidSourceCursorError); // "hello" in base64
    expect(() => decodeSourceCursor("aGVsbG8=")).toThrow("Cursor must decode to a positive integer identifier.");
  });

  it("throws InvalidSourceCursorError for zero", () => {
    expect(() => decodeSourceCursor("MA==")).toThrow(InvalidSourceCursorError); // "0" in base64
    expect(() => decodeSourceCursor("MA==")).toThrow("Cursor must decode to a positive integer identifier.");
  });

  it("throws InvalidSourceCursorError for negative number", () => {
    expect(() => decodeSourceCursor("LTE=")).toThrow(InvalidSourceCursorError); // "-1" in base64
    expect(() => decodeSourceCursor("LTE=")).toThrow("Cursor must decode to a positive integer identifier.");
  });

  it("throws InvalidSourceCursorError for non-numeric decoded value", () => {
    expect(() => decodeSourceCursor("YWJj")).toThrow(InvalidSourceCursorError); // "abc" in base64
    expect(() => decodeSourceCursor("YWJj")).toThrow("Cursor must decode to a positive integer identifier.");
  });
});

describe("buildSourcesQuery", () => {
  it("builds query without cursor", () => {
    const payload = {
      kind: "book" as const,
      search: "test",
      limit: 25,
      sort: "name" as const,
    };
    const result = buildSourcesQuery(payload);
    expect(result).toEqual({
      kind: "book",
      search: "test",
      limit: 25,
      sort: "name",
    });
  });

  it("builds query with valid cursor", () => {
    const payload = {
      kind: "article" as const,
      limit: 30,
      sort: "created_at" as const,
      cursor: "MTIz", // "123" in base64
    };
    const result = buildSourcesQuery(payload);
    expect(result).toEqual({
      kind: "article",
      limit: 30,
      sort: "created_at",
      cursor: 123,
    });
  });

  it("throws InvalidSourceCursorError for invalid cursor", () => {
    const payload = {
      limit: 20,
      sort: "name" as const,
      cursor: "YWJj", // "abc" in base64 - valid base64 but not a number
    };
    expect(() => buildSourcesQuery(payload)).toThrow(InvalidSourceCursorError);
    expect(() => buildSourcesQuery(payload)).toThrow("Cursor must decode to a positive integer identifier.");
  });
});

describe("InvalidSourceCursorError", () => {
  it("creates error with correct name and message", () => {
    const error = new InvalidSourceCursorError("Test message");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InvalidSourceCursorError");
    expect(error.message).toBe("Test message");
  });
});
