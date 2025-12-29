import { describe, it, expect } from "vitest";
import {
  generationErrorLogsQuerySchema,
  buildGenerationErrorLogsQuery,
  DEFAULT_GENERATION_ERROR_LOGS_LIMIT,
  MAX_GENERATION_ERROR_LOGS_LIMIT,
  type GenerationErrorLogsQuery,
} from "../generation-error-logs.schema";

describe("generationErrorLogsQuerySchema", () => {
  describe("user_id validation", () => {
    it("accepts valid UUID", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = generationErrorLogsQuerySchema.safeParse({
        user_id: validUuid,
      });
      expect(result.success).toBe(true);
      expect(result.data?.user_id).toBe(validUuid);
    });

    it("rejects invalid UUID format", () => {
      const invalidUuids = ["not-a-uuid", "123", "550e8400-e29b-41d4-a716"];

      invalidUuids.forEach((uuid) => {
        const result = generationErrorLogsQuerySchema.safeParse({
          user_id: uuid,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("User ID must be a valid UUID");
      });
    });

    it("rejects non-string user_id", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        user_id: 123,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("User ID must be a string");
    });

    it("accepts undefined user_id", () => {
      const result = generationErrorLogsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.user_id).toBeUndefined();
    });
  });

  describe("model validation", () => {
    it("accepts valid model string", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        model: "gpt-4",
      });
      expect(result.success).toBe(true);
      expect(result.data?.model).toBe("gpt-4");
    });

    it("rejects empty model string", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        model: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Model cannot be empty");
    });

    it("rejects non-string model", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        model: 123,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Model must be a string");
    });

    it("accepts undefined model", () => {
      const result = generationErrorLogsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.model).toBeUndefined();
    });
  });

  describe("from date validation", () => {
    it("accepts valid YYYY-MM-DD format and transforms to ISO", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        from: "2024-01-15",
      });
      expect(result.success).toBe(true);
      expect(result.data?.from).toBe("2024-01-15T00:00:00.000Z");
    });

    it("rejects invalid date format", () => {
      const invalidDates = ["2024/01/15", "2024-1-15", "01-15-2024", "not-a-date", "2024-01"];

      invalidDates.forEach((date) => {
        const result = generationErrorLogsQuerySchema.safeParse({
          from: date,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("From date must be in YYYY-MM-DD format");
      });
    });

    it("rejects non-string from date", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        from: 20240115,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("From date must be a string");
    });

    it("accepts undefined from date", () => {
      const result = generationErrorLogsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.from).toBeUndefined();
    });
  });

  describe("to date validation", () => {
    it("accepts valid YYYY-MM-DD format and transforms to ISO", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        to: "2024-01-15",
      });
      expect(result.success).toBe(true);
      expect(result.data?.to).toBe("2024-01-15T23:59:59.999Z");
    });

    it("rejects invalid date format", () => {
      const invalidDates = ["2024/01/15", "2024-1-15", "01-15-2024", "not-a-date", "2024-01"];

      invalidDates.forEach((date) => {
        const result = generationErrorLogsQuerySchema.safeParse({
          to: date,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("To date must be in YYYY-MM-DD format");
      });
    });

    it("rejects non-string to date", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        to: 20240115,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("To date must be a string");
    });

    it("accepts undefined to date", () => {
      const result = generationErrorLogsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.to).toBeUndefined();
    });
  });

  describe("limit validation", () => {
    it("accepts valid string limit and transforms to number", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        limit: "50",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it("accepts valid numeric string limit", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        limit: "75",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(75);
    });

    it("defaults to DEFAULT_GENERATION_ERROR_LOGS_LIMIT when not provided", () => {
      const result = generationErrorLogsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(DEFAULT_GENERATION_ERROR_LOGS_LIMIT);
    });

    it("rejects limit below minimum", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        limit: "0",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be at least 1");
    });

    it("rejects limit above maximum", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        limit: "101",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Limit cannot exceed ${MAX_GENERATION_ERROR_LOGS_LIMIT}`);
    });

    it("rejects invalid numeric string", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        limit: "not-a-number",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be a valid number");
    });

    it("rejects non-string limit", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        limit: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be a string");
    });
  });

  describe("cursor validation", () => {
    it("accepts valid cursor string", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        cursor: "cursor123",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("cursor123");
    });

    it("rejects non-string cursor", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        cursor: 123,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Cursor must be a string");
    });

    it("accepts undefined cursor", () => {
      const result = generationErrorLogsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBeUndefined();
    });
  });

  describe("complete object validation", () => {
    it("accepts valid complete object", () => {
      const result = generationErrorLogsQuerySchema.safeParse({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        model: "gpt-4",
        from: "2024-01-01",
        to: "2024-01-31",
        limit: "25",
        cursor: "cursor123",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        model: "gpt-4",
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-01-31T23:59:59.999Z",
        limit: 25,
        cursor: "cursor123",
      });
    });

    it("accepts minimal valid object", () => {
      const result = generationErrorLogsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(DEFAULT_GENERATION_ERROR_LOGS_LIMIT);
    });
  });
});

describe("constants", () => {
  it("DEFAULT_GENERATION_ERROR_LOGS_LIMIT equals 20", () => {
    expect(DEFAULT_GENERATION_ERROR_LOGS_LIMIT).toBe(20);
  });

  it("MAX_GENERATION_ERROR_LOGS_LIMIT equals 100", () => {
    expect(MAX_GENERATION_ERROR_LOGS_LIMIT).toBe(100);
  });
});

describe("buildGenerationErrorLogsQuery", () => {
  it("returns params with numeric limit when limit is provided", () => {
    const params: GenerationErrorLogsQuery = {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      limit: 50,
    };
    const result = buildGenerationErrorLogsQuery(params);
    expect(result).toEqual({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      limit: 50,
    });
    expect(typeof result.limit).toBe("number");
  });

  it("returns params with default limit when limit is undefined", () => {
    const params = {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
    } as GenerationErrorLogsQuery;
    const result = buildGenerationErrorLogsQuery(params);
    expect(result).toEqual({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      limit: DEFAULT_GENERATION_ERROR_LOGS_LIMIT,
    });
    expect(typeof result.limit).toBe("number");
  });

  it("returns params with default limit when limit is not provided", () => {
    const params = {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
    } as const;
    const result = buildGenerationErrorLogsQuery(params as GenerationErrorLogsQuery);
    expect(result).toEqual({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      limit: DEFAULT_GENERATION_ERROR_LOGS_LIMIT,
    });
    expect(typeof result.limit).toBe("number");
  });

  it("preserves all other properties", () => {
    const params: GenerationErrorLogsQuery = {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      model: "gpt-4",
      from: "2024-01-01T00:00:00.000Z",
      to: "2024-01-31T23:59:59.999Z",
      cursor: "cursor123",
      limit: 75,
    };
    const result = buildGenerationErrorLogsQuery(params);
    expect(result).toEqual({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      model: "gpt-4",
      from: "2024-01-01T00:00:00.000Z",
      to: "2024-01-31T23:59:59.999Z",
      cursor: "cursor123",
      limit: 75,
    });
  });
});
