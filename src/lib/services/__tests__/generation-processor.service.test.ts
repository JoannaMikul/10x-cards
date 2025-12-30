import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { GenerationRecord } from "../generations.service";
import {
  processGeneration,
  processPendingGenerations,
  validateFlashcard,
  sanitizeTagIds,
  getSystemPrompt,
  formatAvailableTagsForPrompt,
  getOpenRouterServiceHealth,
} from "../generation-processor.service";
import { openRouterHandlers } from "../../mocks/handlers/openrouter";
import { generationProcessorHandlers } from "../../mocks/handlers/generation-processor";
import { server } from "../../../test/setup";
import { openRouterService, OpenRouterRateLimitError } from "../../openrouter-service";

vi.mock("../../openrouter-service", () => ({
  openRouterService: {
    completeStructuredChat: vi.fn(),
  },
  OpenRouterRateLimitError: class OpenRouterRateLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "OpenRouterRateLimitError";
    }
  },
  OpenRouterServerError: class OpenRouterServerError extends Error {
    constructor(
      message: string,
      public statusCode: number
    ) {
      super(message);
      this.name = "OpenRouterServerError";
    }
  },
  OpenRouterNetworkError: class OpenRouterNetworkError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "OpenRouterNetworkError";
    }
  },
}));

type TestableSupabaseClient = Omit<SupabaseClient, "from" | "rpc"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
  rpc: SupabaseClient["rpc"] | ReturnType<typeof vi.fn>;
};

describe("generation-processor.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    } as TestableSupabaseClient;

    vi.clearAllMocks();
    server.use(...openRouterHandlers, ...generationProcessorHandlers);
  });

  afterEach(() => {
    vi.clearAllMocks();
    server.resetHandlers();
  });

  describe("processGeneration", () => {
    const mockGeneration: GenerationRecord = {
      id: "gen-123",
      user_id: "user-123",
      model: "openai/gpt-3.5-turbo",
      sanitized_input_text: "This is a test input text for generating flashcards about networking protocols.",
      sanitized_input_sha256: "abc123",
      sanitized_input_length: 85,
      temperature: 0.3,
      status: "pending",
      created_at: "2025-12-01T10:00:00.000Z",
      updated_at: "2025-12-01T10:00:00.000Z",
      started_at: null,
      completed_at: null,
      error_message: null,
      error_code: null,
      prompt_tokens: null,
    };

    it("should process generation successfully", async () => {
      const mockTags = [
        { id: 1, name: "networking", slug: "networking" },
        { id: 2, name: "protocols", slug: "protocols" },
      ];

      const mockFlashcardsResponse = {
        cards: [
          {
            front: "What is TCP?",
            back: "Transmission Control Protocol - a connection-oriented protocol.",
            tag_ids: [1],
          },
        ],
      };

      vi.mocked(openRouterService.completeStructuredChat).mockResolvedValue(mockFlashcardsResponse);

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "tags":
            return {
              ...mockBuilder,
              mockResolvedValue: vi.fn(() => ({ data: mockTags, error: null })),
            };
          case "generations":
            return mockBuilder;
          case "generation_candidates":
            return mockBuilder;
          default:
            return mockBuilder;
        }
      });

      const result = await processGeneration(mockSupabase as SupabaseClient, mockGeneration);

      expect(openRouterService.completeStructuredChat).toHaveBeenCalledWith({
        systemPrompt: expect.stringContaining("You are an expert in creating high-quality educational flashcards"),
        userPrompt: expect.stringContaining("Analyze the following source text"),
        responseFormat: expect.any(Object),
        model: "openai/gpt-3.5-turbo",
        params: { temperature: 0.3 },
      });

      expect(result.success).toBe(true);
      expect(result.candidatesCreated).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("should handle OpenRouter rate limit error with retry", async () => {
      const mockTags = [{ id: 1, name: "networking", slug: "networking" }];

      const mockFlashcardsResponse = {
        cards: [
          {
            front: "What is TCP?",
            back: "Transmission Control Protocol",
            tag_ids: [1],
          },
        ],
      };

      const rateLimitError = new OpenRouterRateLimitError("Rate limit exceeded");

      vi.mocked(openRouterService.completeStructuredChat)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockFlashcardsResponse);

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "tags":
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: mockTags, error: null }),
            };
          case "generations":
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          case "generation_candidates":
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          default:
            return {};
        }
      });

      const result = await processGeneration(mockSupabase as SupabaseClient, mockGeneration);

      expect(openRouterService.completeStructuredChat).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.candidatesCreated).toBe(1);
    });

    it("should handle database error when fetching tags", async () => {
      vi.mocked(openRouterService.completeStructuredChat).mockResolvedValue({
        cards: [{ front: "Test", back: "Test", tag_ids: [] }],
      });

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "tags":
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn(() => ({ data: null, error: { message: "Database error" } })),
            };
          case "generations":
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          default:
            return {};
        }
      });

      const result = await processGeneration(mockSupabase as SupabaseClient, mockGeneration);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to fetch available tags");
    });

    it("should handle OpenRouter server error", async () => {
      const mockTags = [{ id: 1, name: "networking", slug: "networking" }];

      vi.mocked(openRouterService.completeStructuredChat).mockRejectedValue(
        new Error("OpenRouter service temporarily unavailable")
      );

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "tags":
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: mockTags, error: null }),
            };
          case "generations":
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          case "generation_candidates":
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          default:
            return {};
        }
      });

      const result = await processGeneration(mockSupabase as SupabaseClient, mockGeneration);

      expect(result.success).toBe(false);
      expect(result.error).toContain("OpenRouter service temporarily unavailable");
    });

    it("should handle case when no valid flashcards are generated", async () => {
      const mockTags = [{ id: 1, name: "networking", slug: "networking" }];

      const mockEmptyResponse = {
        cards: [],
      };

      vi.mocked(openRouterService.completeStructuredChat).mockResolvedValue(mockEmptyResponse);

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "tags":
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: mockTags, error: null }),
            };
          case "generations":
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          default:
            return {};
        }
      });

      const result = await processGeneration(mockSupabase as SupabaseClient, mockGeneration);

      expect(result.success).toBe(false);
      expect(result.candidatesCreated).toBe(0);
      expect(result.error).toContain("No valid flashcards were generated");
    });
  });

  describe("processPendingGenerations", () => {
    it("should process multiple pending generations", async () => {
      const mockGenerations: GenerationRecord[] = [
        {
          id: "gen-1",
          user_id: "user-1",
          model: "openai/gpt-3.5-turbo",
          sanitized_input_text: "Test content 1",
          sanitized_input_sha256: "hash1",
          sanitized_input_length: 13,
          temperature: 0.3,
          status: "pending",
          created_at: "2025-12-01T10:00:00.000Z",
          updated_at: "2025-12-01T10:00:00.000Z",
          started_at: null,
          completed_at: null,
          error_message: null,
          error_code: null,
          prompt_tokens: null,
        },
        {
          id: "gen-2",
          user_id: "user-2",
          model: "openai/gpt-3.5-turbo",
          sanitized_input_text: "Test content 2",
          sanitized_input_sha256: "hash2",
          sanitized_input_length: 13,
          temperature: 0.3,
          status: "pending",
          created_at: "2025-12-01T10:01:00.000Z",
          updated_at: "2025-12-01T10:01:00.000Z",
          started_at: null,
          completed_at: null,
          error_message: null,
          error_code: null,
          prompt_tokens: null,
        },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockGenerations, error: null }),
      }));

      const result = await processPendingGenerations(mockSupabase as SupabaseClient);

      expect(result.processed).toBe(2);
      expect(result.succeeded + result.failed).toBe(2);
    });

    it("should return zero when no pending generations", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const result = await processPendingGenerations(mockSupabase as SupabaseClient);

      expect(result.processed).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("should handle database error when fetching pending generations", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn(() => ({ data: null, error: { message: "Database error" } })),
      }));

      await expect(processPendingGenerations(mockSupabase as SupabaseClient)).rejects.toThrow();
    });
  });

  describe("validateFlashcard", () => {
    it("should validate correct flashcard", () => {
      const card = {
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        tag_ids: [1, 2],
      };

      const result = validateFlashcard(card);

      expect(result).toEqual({
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        tagIds: [1, 2],
      });
    });

    it("should truncate front text that exceeds max length", () => {
      const longFront = "x".repeat(300);
      const card = {
        front: longFront,
        back: "Short back",
        tag_ids: [],
      };

      const result = validateFlashcard(card);

      expect(result?.front.length).toBeLessThanOrEqual(200);
    });

    it("should truncate and add ellipsis to back text that exceeds max length", () => {
      const longBack = "x".repeat(600);
      const card = {
        front: "Short front",
        back: longBack,
        tag_ids: [],
      };

      const result = validateFlashcard(card);

      expect(result?.back.length).toBeLessThanOrEqual(500);
      expect(result?.back).toContain("...");
    });

    it("should return null for invalid front", () => {
      const card = {
        front: "",
        back: "Valid back",
        tag_ids: [],
      };

      const result = validateFlashcard(card);

      expect(result).toBeNull();
    });

    it("should return null for invalid back", () => {
      const card = {
        front: "Valid front",
        back: null,
        tag_ids: [],
      };

      const result = validateFlashcard(card);

      expect(result).toBeNull();
    });

    it("should return null for non-object input", () => {
      const result = validateFlashcard("invalid");

      expect(result).toBeNull();
    });
  });

  describe("sanitizeTagIds", () => {
    it("should sanitize valid tag IDs", () => {
      const tagIds = [1, 2, 3.0, "invalid", null];

      const result = sanitizeTagIds(tagIds);

      expect(result).toEqual([1, 2, 3]);
    });

    it("should remove duplicates", () => {
      const tagIds = [1, 1, 2, 2, 3];

      const result = sanitizeTagIds(tagIds);

      expect(result).toEqual([1, 2, 3]);
    });

    it("should return empty array for invalid input", () => {
      const result = sanitizeTagIds("invalid");

      expect(result).toEqual([]);
    });

    it("should filter out negative and zero IDs", () => {
      const tagIds = [-1, 0, 1, 2];

      const result = sanitizeTagIds(tagIds);

      expect(result).toEqual([1, 2]);
    });
  });

  describe("getSystemPrompt", () => {
    it("should return the system prompt", () => {
      const prompt = getSystemPrompt();

      expect(prompt).toContain("You are an expert in creating high-quality educational flashcards");
      expect(prompt).toContain("Tasks:");
      expect(prompt).toContain("Formatting requirements:");
    });
  });

  describe("formatAvailableTagsForPrompt", () => {
    it("should format tags correctly", () => {
      const tags = [
        { id: 1, name: "networking", slug: "networking" },
        { id: 2, name: "protocols", slug: "protocols" },
      ];

      const result = formatAvailableTagsForPrompt(tags);

      expect(result).toContain("- [1] networking (slug: networking)");
      expect(result).toContain("- [2] protocols (slug: protocols)");
    });

    it("should return no tags message when empty", () => {
      const result = formatAvailableTagsForPrompt([]);

      expect(result).toContain("No tags are configured");
    });
  });

  describe("getOpenRouterServiceHealth", () => {
    it("should return healthy status when circuit breaker is closed", () => {
      const health = getOpenRouterServiceHealth();

      expect(health.circuitBreakerState).toBe("CLOSED");
      expect(health.failureCount).toBeGreaterThanOrEqual(0);
      expect(health.isHealthy).toBe(true);
      expect(health.lastChecked).toBeDefined();
    });
  });
});
