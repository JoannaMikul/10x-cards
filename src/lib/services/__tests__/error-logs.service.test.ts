import { describe, it, expect, vi, beforeEach } from "vitest";
import { logGenerationError, getGenerationErrorLogs } from "../error-logs.service";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { GenerationErrorLogsQuery } from "../../validation/generation-error-logs.schema";

/**
 * Test-compatible Supabase client that allows method overrides
 * Extends the real SupabaseClient but makes 'from' writable for mocking
 */
type TestableSupabaseClient = Omit<SupabaseClient, "from" | "rpc"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
  rpc: SupabaseClient["rpc"] | ReturnType<typeof vi.fn>;
};

describe("error-logs.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    } as TestableSupabaseClient;
  });

  describe("logGenerationError", () => {
    it("should successfully log generation error", async () => {
      const mockRpcResponse = { error: null };

      mockSupabase.rpc = vi.fn().mockResolvedValue(mockRpcResponse);

      const payload = {
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        model: "gpt-4",
        error_code: "API_RATE_LIMIT",
        error_message: "Rate limit exceeded",
        source_text_hash: "abc123def456",
        source_text_length: 1500,
      };

      await expect(logGenerationError(mockSupabase as SupabaseClient, payload)).resolves.toBeUndefined();

      expect(mockSupabase.rpc).toHaveBeenCalledWith("log_generation_error", {
        p_user_id: payload.user_id,
        p_model: payload.model,
        p_error_code: payload.error_code,
        p_error_message: payload.error_message,
        p_source_text_hash: payload.source_text_hash,
        p_source_text_length: payload.source_text_length,
      });
    });

    it("should handle database error gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error");
      const mockError = new Error("Database connection failed");

      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: mockError });

      const payload = {
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        model: "gpt-4",
        error_code: "DB_ERROR",
        error_message: "Database error",
        source_text_hash: "abc123def456",
        source_text_length: 1000,
      };

      await expect(logGenerationError(mockSupabase as SupabaseClient, payload)).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith("[generation] Failed to log error to database:", mockError);

      consoleErrorSpy.mockRestore();
    });

    it("should handle unexpected errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error");
      const mockError = new Error("Unexpected error");

      mockSupabase.rpc = vi.fn().mockRejectedValue(mockError);

      const payload = {
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        model: "gpt-4",
        error_code: "UNEXPECTED",
        error_message: "Unexpected error occurred",
        source_text_hash: "abc123def456",
        source_text_length: 500,
      };

      await expect(logGenerationError(mockSupabase as SupabaseClient, payload)).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[generation] Unexpected error while logging generation error:",
        mockError
      );

      consoleErrorSpy.mockRestore();
    });

    it("should log error details to console for debugging", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error");

      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

      const payload = {
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        model: "claude-3-haiku",
        error_code: "API_TIMEOUT",
        error_message: "Request timeout",
        source_text_hash: "def456ghi789",
        source_text_length: 800,
      };

      await logGenerationError(mockSupabase as SupabaseClient, payload);

      expect(consoleErrorSpy).toHaveBeenCalledWith("[generation] Error occurred", {
        userId: payload.user_id,
        model: payload.model,
        errorCode: payload.error_code,
        errorMessage: payload.error_message,
        sourceHash: payload.source_text_hash,
        sourceLength: payload.source_text_length,
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("getGenerationErrorLogs", () => {
    it("should list error logs with default parameters", async () => {
      const mockQuery: GenerationErrorLogsQuery & { limit: number } = { limit: 20 };
      const mockResponse = {
        data: [
          {
            id: 1,
            user_id: "123e4567-e89b-12d3-a456-426614174000",
            model: "gpt-4",
            error_code: "API_RATE_LIMIT",
            error_message: "Rate limit exceeded",
            source_text_hash: "abc123def456",
            source_text_length: 1500,
            created_at: "2025-12-27T10:30:00.000Z",
          },
        ],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getGenerationErrorLogs(mockSupabase as SupabaseClient, mockQuery);

      expect(mockSupabase.from).toHaveBeenCalledWith("generation_error_logs");
      expect(mockBuilder.select).toHaveBeenCalledWith(
        "id, user_id, model, error_code, error_message, source_text_hash, source_text_length, created_at"
      );
      expect(mockBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockBuilder.order).toHaveBeenCalledWith("id", { ascending: false });
      expect(mockBuilder.limit).toHaveBeenCalledWith(21);

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursorId).toBe(null);
      expect(result.items[0]).toEqual({
        id: 1,
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        model: "gpt-4",
        error_code: "API_RATE_LIMIT",
        error_message: "Rate limit exceeded",
        source_text_hash: "abc123def456",
        source_text_length: 1500,
        created_at: "2025-12-27T10:30:00.000Z",
      });
    });

    it("should handle user_id filtering", async () => {
      const mockQuery: GenerationErrorLogsQuery & { limit: number } = {
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        limit: 10,
      };
      const mockResponse = {
        data: [],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await getGenerationErrorLogs(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", mockQuery.user_id);
    });

    it("should handle model filtering", async () => {
      const mockQuery: GenerationErrorLogsQuery & { limit: number } = {
        model: "gpt-4",
        limit: 10,
      };
      const mockResponse = {
        data: [],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await getGenerationErrorLogs(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.eq).toHaveBeenCalledWith("model", mockQuery.model);
    });

    it("should handle date range filtering", async () => {
      const mockQuery: GenerationErrorLogsQuery & { limit: number } = {
        from: "2025-12-27T00:00:00.000Z",
        to: "2025-12-27T23:59:59.999Z",
        limit: 10,
      };
      const mockResponse = {
        data: [],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await getGenerationErrorLogs(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.gte).toHaveBeenCalledWith("created_at", mockQuery.from);
      expect(mockBuilder.lte).toHaveBeenCalledWith("created_at", mockQuery.to);
    });

    it("should handle cursor pagination", async () => {
      const mockQuery: GenerationErrorLogsQuery & { limit: number } = {
        cursor: "2025-12-27T10:30:00.000Z",
        limit: 5,
      };
      const mockResponse = {
        data: [],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await getGenerationErrorLogs(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.lt).toHaveBeenCalledWith("created_at", mockQuery.cursor);
    });

    it("should detect hasMore when limit + 1 items returned", async () => {
      const mockQuery: GenerationErrorLogsQuery & { limit: number } = { limit: 2 };
      const mockResponse = {
        data: [
          {
            id: 1,
            user_id: "123e4567-e89b-12d3-a456-426614174000",
            model: "gpt-4",
            error_code: "API_RATE_LIMIT",
            error_message: "Rate limit exceeded",
            source_text_hash: "abc123def456",
            source_text_length: 1500,
            created_at: "2025-12-27T10:30:00.000Z",
          },
          {
            id: 2,
            user_id: "123e4567-e89b-12d3-a456-426614174001",
            model: "claude-3-haiku",
            error_code: "API_TIMEOUT",
            error_message: "Request timeout",
            source_text_hash: "def456ghi789",
            source_text_length: 800,
            created_at: "2025-12-27T09:15:00.000Z",
          },
          {
            id: 3,
            user_id: "123e4567-e89b-12d3-a456-426614174002",
            model: "gpt-3.5-turbo",
            error_code: "INVALID_REQUEST",
            error_message: "Invalid request format",
            source_text_hash: "ghi789jkl012",
            source_text_length: 200,
            created_at: "2025-12-27T08:00:00.000Z",
          },
        ],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getGenerationErrorLogs(mockSupabase as SupabaseClient, mockQuery);

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursorId).toBe("2025-12-27T09:15:00.000Z");
    });

    it("should throw error on database failure", async () => {
      const mockQuery: GenerationErrorLogsQuery & { limit: number } = { limit: 20 };
      const mockError = new Error("Database connection failed");

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(getGenerationErrorLogs(mockSupabase as SupabaseClient, mockQuery)).rejects.toThrow(mockError);
    });
  });
});
