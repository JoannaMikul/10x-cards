import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "../../../db/supabase.client";

import {
  sanitizeSourceText,
  startGeneration,
  getGenerationById,
  getCandidatesStatuses,
  cancelGenerationIfActive,
  type GenerationRecord,
} from "../generations.service";
import { server } from "../../../test/setup";

type TestableSupabaseClient = Omit<SupabaseClient, "from"> & {
  from: ReturnType<typeof vi.fn>;
};

describe("generations.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    } as TestableSupabaseClient;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    server.resetHandlers();
  });

  describe("sanitizeSourceText", () => {
    it("should return empty string for null input", () => {
      const result = sanitizeSourceText(null as never);
      expect(result).toBe("");
    });

    it("should return empty string for undefined input", () => {
      const result = sanitizeSourceText(undefined as never);
      expect(result).toBe("");
    });

    it("should return empty string for empty string", () => {
      const result = sanitizeSourceText("");
      expect(result).toBe("");
    });

    it("should normalize different newline characters to \\n", () => {
      const result = sanitizeSourceText("line1\r\nline2\nline3\rline4");
      expect(result).toBe("line1line2line3line4");
    });

    it("should remove control characters", () => {
      const result = sanitizeSourceText("text\x01\x02\x03more\x04\x05text");
      expect(result).toBe("textmoretext");
    });

    it("should collapse multiple spaces to single space", () => {
      const result = sanitizeSourceText("text  with    multiple     spaces");
      expect(result).toBe("text with multiple spaces");
    });

    it("should collapse multiple blank lines to double newline", () => {
      const result = sanitizeSourceText("line1\n\n\n\n\nline2\n\n\nline3");
      expect(result).toBe("line1line2line3");
    });

    it("should trim whitespace from start and end", () => {
      const result = sanitizeSourceText("  \n  text  \n  ");
      expect(result).toBe("text");
    });

    it("should handle complex text with all transformations", () => {
      const input = "  \r\n  text\x01\x02  with  \r\n\r\n\r\n  issues  \n  ";
      const expected = "text with issues";
      const result = sanitizeSourceText(input);
      expect(result).toBe(expected);
    });

    it("should preserve meaningful content", () => {
      const input = "This is a test.\n\nIt has multiple paragraphs.\nAnd some spacing.";
      const result = sanitizeSourceText(input);
      expect(result).toBe("This is a test.It has multiple paragraphs.And some spacing.");
    });
  });

  describe("startGeneration", () => {
    const mockCommand = {
      model: "openai/gpt-3.5-turbo",
      sanitized_input_text: "Test input text",
      temperature: 0.7,
    };

    it("should successfully start generation and return result", async () => {
      const mockInsertResult = {
        data: { id: "gen-123", created_at: "2025-12-01T10:00:00.000Z" },
        error: null,
      };

      mockSupabase.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue(mockInsertResult),
          })),
        })),
      }));

      const result = await startGeneration(mockSupabase as unknown as SupabaseClient, "user-123", mockCommand);

      expect(result).toEqual({
        id: "gen-123",
        created_at: "2025-12-01T10:00:00.000Z",
      });

      expect(mockSupabase.from).toHaveBeenCalledWith("generations");
    });

    it("should handle null temperature", async () => {
      const commandWithoutTemp = {
        model: "openai/gpt-3.5-turbo",
        sanitized_input_text: "Test input text",
      };

      const mockInsertResult = {
        data: { id: "gen-456", created_at: "2025-12-01T11:00:00.000Z" },
        error: null,
      };

      mockSupabase.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue(mockInsertResult),
          })),
        })),
      }));

      const result = await startGeneration(mockSupabase as unknown as SupabaseClient, "user-456", commandWithoutTemp);

      expect(result).toEqual({
        id: "gen-456",
        created_at: "2025-12-01T11:00:00.000Z",
      });
    });

    it("should throw error when insert fails", async () => {
      const mockInsertResult = {
        data: null,
        error: { message: "Insert failed" },
      };

      mockSupabase.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue(mockInsertResult),
          })),
        })),
      }));

      await expect(startGeneration(mockSupabase as unknown as SupabaseClient, "user-123", mockCommand)).rejects.toThrow(
        "Insert failed"
      );
    });

    it("should throw error when no data returned", async () => {
      const mockInsertResult = {
        data: null,
        error: null,
      };

      mockSupabase.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue(mockInsertResult),
          })),
        })),
      }));

      await expect(startGeneration(mockSupabase as unknown as SupabaseClient, "user-123", mockCommand)).rejects.toThrow(
        "Failed to insert generation"
      );
    });
  });

  describe("getGenerationById", () => {
    const mockGeneration: GenerationRecord = {
      id: "gen-123",
      user_id: "user-123",
      model: "openai/gpt-3.5-turbo",
      status: "running",
      temperature: 0.7,
      prompt_tokens: 1280,
      sanitized_input_length: 5600,
      sanitized_input_sha256: "abc123",
      sanitized_input_text: "Test input",
      started_at: "2025-12-01T12:00:00.000Z",
      completed_at: null,
      created_at: "2025-12-01T11:58:00.000Z",
      updated_at: "2025-12-01T12:00:30.000Z",
      error_code: null,
      error_message: null,
    };

    it("should return generation when found", async () => {
      const mockQueryResult = {
        data: mockGeneration,
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
        overrideTypes: vi.fn().mockResolvedValue(mockQueryResult),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getGenerationById(mockSupabase as unknown as SupabaseClient, "user-123", "gen-123");

      expect(result).toEqual(mockGeneration);
      expect(mockSupabase.from).toHaveBeenCalledWith("generations");
      expect(mockBuilder.select).toHaveBeenCalledWith(
        "id, user_id, model, status, temperature, prompt_tokens, sanitized_input_length, sanitized_input_sha256, sanitized_input_text, started_at, completed_at, created_at, updated_at, error_code, error_message"
      );
      expect(mockBuilder.eq).toHaveBeenCalledWith("id", "gen-123");
      expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "user-123");
    });

    it("should return null when generation not found", async () => {
      const mockQueryResult = {
        data: null,
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
        overrideTypes: vi.fn().mockResolvedValue(mockQueryResult),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getGenerationById(mockSupabase as unknown as SupabaseClient, "user-123", "gen-999");

      expect(result).toBeNull();
    });

    it("should throw error when database query fails", async () => {
      const mockQueryResult = {
        data: null,
        error: { message: "Database error" },
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
        overrideTypes: vi.fn().mockResolvedValue(mockQueryResult),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(getGenerationById(mockSupabase as unknown as SupabaseClient, "user-123", "gen-123")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("getCandidatesStatuses", () => {
    it("should return correct summary for mixed candidate statuses", async () => {
      const mockCandidatesData = [
        { status: "proposed" },
        { status: "proposed" },
        { status: "edited" },
        { status: "accepted" },
        { status: "accepted" },
        { status: "accepted" },
        { status: "rejected" },
        { status: "rejected" },
      ];

      const mockQueryResult = {
        data: mockCandidatesData,
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        overrideTypes: vi.fn().mockResolvedValue(mockQueryResult),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getCandidatesStatuses(mockSupabase as unknown as SupabaseClient, "user-123", "gen-123");

      expect(result).toEqual({
        total: 8,
        by_status: {
          proposed: 2,
          edited: 1,
          accepted: 3,
          rejected: 2,
        },
      });
    });

    it("should handle empty candidates list", async () => {
      const mockQueryResult = {
        data: [],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        overrideTypes: vi.fn().mockResolvedValue(mockQueryResult),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getCandidatesStatuses(mockSupabase as unknown as SupabaseClient, "user-123", "gen-123");

      expect(result).toEqual({
        total: 0,
        by_status: {
          proposed: 0,
          edited: 0,
          accepted: 0,
          rejected: 0,
        },
      });
    });

    it("should filter out invalid status values", async () => {
      const mockCandidatesData = [
        { status: "proposed" },
        { status: "invalid" as never },
        { status: null as never },
        { status: "accepted" },
      ];

      const mockQueryResult = {
        data: mockCandidatesData,
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        overrideTypes: vi.fn().mockResolvedValue(mockQueryResult),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getCandidatesStatuses(mockSupabase as unknown as SupabaseClient, "user-123", "gen-123");

      expect(result).toEqual({
        total: 4,
        by_status: {
          proposed: 1,
          edited: 0,
          accepted: 1,
          rejected: 0,
        },
      });
    });

    it("should throw error when database query fails", async () => {
      const mockQueryResult = {
        data: null,
        error: { message: "Database error" },
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        overrideTypes: vi.fn().mockResolvedValue(mockQueryResult),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(
        getCandidatesStatuses(mockSupabase as unknown as SupabaseClient, "user-123", "gen-123")
      ).rejects.toThrow("Database error");
    });
  });

  describe("cancelGenerationIfActive", () => {
    const mockUpdatedGeneration = {
      id: "gen-123",
      status: "cancelled" as const,
      completed_at: "2025-12-01T12:05:30.000Z",
      updated_at: "2025-12-01T12:05:30.000Z",
    };

    it("should successfully cancel pending generation", async () => {
      const mockUpdateResult = {
        data: mockUpdatedGeneration,
        error: null,
      };

      mockSupabase.from = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue(mockUpdateResult),
                })),
              })),
            })),
          })),
        })),
      }));

      const result = await cancelGenerationIfActive(mockSupabase as unknown as SupabaseClient, "user-123", "gen-123");

      expect(result).toEqual(mockUpdatedGeneration);
      expect(mockSupabase.from).toHaveBeenCalledWith("generations");
    });

    it("should successfully cancel running generation", async () => {
      const mockUpdateResult = {
        data: mockUpdatedGeneration,
        error: null,
      };

      mockSupabase.from = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue(mockUpdateResult),
                })),
              })),
            })),
          })),
        })),
      }));

      const result = await cancelGenerationIfActive(mockSupabase as unknown as SupabaseClient, "user-456", "gen-456");

      expect(result).toEqual(mockUpdatedGeneration);
    });

    it("should return null when generation not in active state", async () => {
      const mockUpdateResult = {
        data: null,
        error: { code: "PGRST116" }, // No rows affected
      };

      mockSupabase.from = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue(mockUpdateResult),
                })),
              })),
            })),
          })),
        })),
      }));

      const result = await cancelGenerationIfActive(mockSupabase as unknown as SupabaseClient, "user-123", "gen-123");

      expect(result).toBeNull();
    });

    it("should throw error for other database errors", async () => {
      const mockUpdateResult = {
        data: null,
        error: { code: "OTHER_ERROR", message: "Database error" },
      };

      mockSupabase.from = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue(mockUpdateResult),
                })),
              })),
            })),
          })),
        })),
      }));

      await expect(
        cancelGenerationIfActive(mockSupabase as unknown as SupabaseClient, "user-123", "gen-123")
      ).rejects.toThrow("Database error");
    });
  });
});
