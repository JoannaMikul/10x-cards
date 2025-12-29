import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createFlashcard,
  listFlashcards,
  updateFlashcard,
  getFlashcardById,
  softDeleteFlashcard,
  restoreFlashcard,
  setFlashcardTags,
  FlashcardReferenceError,
  FlashcardNotFoundError,
  FlashcardUnauthorizedError,
} from "../flashcards.service";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { FlashcardsQuery } from "../../validation/flashcards.schema";
import type { CreateFlashcardCommand, UpdateFlashcardCommand, SetFlashcardTagsCommand } from "../../../types";

type TestableSupabaseClient = Omit<SupabaseClient, "from" | "rpc"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
  rpc: SupabaseClient["rpc"] | ReturnType<typeof vi.fn>;
};

describe("flashcards.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    } as TestableSupabaseClient;
  });

  describe("createFlashcard", () => {
    it("should create flashcard successfully", async () => {
      const userId = "user-123";
      const command: CreateFlashcardCommand = {
        front: "What is React?",
        back: "A JavaScript library for building user interfaces",
        origin: "manual",
        category_id: 1,
        tag_ids: [1, 2],
      };

      const mockFlashcardRow = {
        id: "card-123",
        front: command.front,
        back: command.back,
        origin: command.origin,
        metadata: null,
        category_id: command.category_id,
        content_source_id: null,
        owner_id: userId,
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
        deleted_at: null,
        front_back_fingerprint: "fingerprint",
      };

      const mockTags = [
        {
          id: 1,
          name: "React",
          slug: "react",
          description: "JavaScript library",
          created_at: "2025-11-30T09:00:00.000Z",
          updated_at: "2025-11-30T09:00:00.000Z",
        },
      ];

      // Global counter for single calls
      let singleCallCount = 0;

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "categories":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              head: vi.fn().mockReturnThis(),
              count: vi.fn().mockResolvedValue({ count: 1, error: null }),
            };
          case "sources":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              head: vi.fn().mockReturnThis(),
              count: vi.fn().mockResolvedValue({ count: 1, error: null }),
            };
          case "tags":
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], error: null }),
            };
          case "flashcards":
            return {
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => ({ data: { id: "card-123" }, error: null })),
                })),
              })),
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => ({ data: mockFlashcardRow, error: null })),
                })),
              })),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockImplementation(() => {
                singleCallCount++;
                if (singleCallCount === 1) {
                  return { data: { id: "card-123" }, error: null };
                } else {
                  return { data: mockFlashcardRow, error: null };
                }
              }),
            };
          case "card_tags":
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [{ tags: mockTags[0] }], error: null }),
              }),
            };
          default:
            return {};
        }
      });

      const result = await createFlashcard(mockSupabase as SupabaseClient, userId, command);

      expect(result.id).toBe("card-123");
      expect(result.front).toBe(command.front);
      expect(result.back).toBe(command.back);
      expect(result.tags).toEqual(mockTags);
    });

    it("should throw FlashcardReferenceError when category does not exist", async () => {
      const userId = "user-123";
      const command: CreateFlashcardCommand = {
        front: "What is React?",
        back: "A JavaScript library for building user interfaces",
        origin: "manual",
        category_id: 999,
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "categories":
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  head: vi.fn(() => ({
                    count: vi.fn().mockResolvedValue({ count: 0, error: null }),
                  })),
                })),
              })),
            };
          default:
            return {};
        }
      });

      await expect(createFlashcard(mockSupabase as SupabaseClient, userId, command)).rejects.toThrow(
        FlashcardReferenceError
      );
    });

    it("should throw FlashcardReferenceError when content source does not exist", async () => {
      const userId = "user-123";
      const command: CreateFlashcardCommand = {
        front: "What is React?",
        back: "A JavaScript library for building user interfaces",
        origin: "manual",
        content_source_id: 999,
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "sources":
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  head: vi.fn(() => ({
                    count: vi.fn().mockResolvedValue({ count: 0, error: null }),
                  })),
                })),
              })),
            };
          default:
            return {};
        }
      });

      await expect(createFlashcard(mockSupabase as SupabaseClient, userId, command)).rejects.toThrow(
        FlashcardReferenceError
      );
    });

    it("should throw FlashcardReferenceError when tag does not exist", async () => {
      const userId = "user-123";
      const command: CreateFlashcardCommand = {
        front: "What is React?",
        back: "A JavaScript library for building user interfaces",
        origin: "manual",
        tag_ids: [999],
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "categories":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              head: vi.fn().mockReturnThis(),
              count: vi.fn().mockResolvedValue({ count: 1, error: null }),
            };
          case "tags":
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          default:
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              head: vi.fn().mockReturnThis(),
              count: vi.fn().mockResolvedValue({ count: 1, error: null }),
              insert: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: "card-123" }, error: null }),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
        }
      });

      await expect(createFlashcard(mockSupabase as SupabaseClient, userId, command)).rejects.toThrow(
        FlashcardReferenceError
      );
    });
  });

  describe("listFlashcards", () => {
    it("should list flashcards with default parameters", async () => {
      const userId = "user-123";
      const query: FlashcardsQuery = { limit: 10, sort: "created_at", includeDeleted: false };

      const mockRows = [
        {
          id: "card-1",
          front: "What is React?",
          back: "A JavaScript library",
          origin: "manual",
          metadata: null,
          category_id: 1,
          content_source_id: null,
          owner_id: userId,
          created_at: "2025-12-01T10:00:00.000Z",
          updated_at: "2025-12-01T10:00:00.000Z",
          deleted_at: null,
          front_back_fingerprint: "fp1",
        },
      ];

      const flashcardsBuilder = Promise.resolve({ data: mockRows, error: null });

      Object.assign(flashcardsBuilder, {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      });

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return flashcardsBuilder;
          case "card_tags":
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          case "review_stats":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          default:
            return {};
        }
      });

      const result = await listFlashcards(mockSupabase as SupabaseClient, userId, query);

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBe(null);
      expect(result.items[0].id).toBe("card-1");
    });

    it("should handle search filtering", async () => {
      const userId = "user-123";
      const query: FlashcardsQuery = { limit: 10, sort: "created_at", search: "react", includeDeleted: false };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await listFlashcards(mockSupabase as SupabaseClient, userId, query);

      expect(mockBuilder.or).toHaveBeenCalledWith("front.ilike.%react%,back.ilike.%react%");
    });

    it("should handle category filtering", async () => {
      const userId = "user-123";
      const query: FlashcardsQuery = { limit: 10, sort: "created_at", categoryId: 1, includeDeleted: false };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await listFlashcards(mockSupabase as SupabaseClient, userId, query);

      expect(mockBuilder.eq).toHaveBeenCalledWith("category_id", 1);
    });
  });

  describe("getFlashcardById", () => {
    it("should get flashcard by ID successfully", async () => {
      const userId = "user-123";
      const cardId = "card-123";

      const mockFlashcardRow = {
        id: cardId,
        front: "What is React?",
        back: "A JavaScript library for building user interfaces",
        origin: "manual",
        metadata: null,
        category_id: 1,
        content_source_id: null,
        owner_id: userId,
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
        deleted_at: null,
        front_back_fingerprint: "fingerprint",
      };

      const mockTags = [
        {
          id: 1,
          name: "React",
          slug: "react",
          description: "JavaScript library",
          created_at: "2025-11-30T09:00:00.000Z",
          updated_at: "2025-11-30T09:00:00.000Z",
        },
      ];

      const mockReviewStats = {
        card_id: cardId,
        user_id: userId,
        total_reviews: 5,
        successes: 4,
        consecutive_successes: 2,
        last_outcome: "good",
        last_interval_days: 3,
        next_review_at: "2025-12-04T10:00:00.000Z",
        last_reviewed_at: "2025-12-01T10:00:00.000Z",
        aggregates: null,
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockFlashcardRow, error: null }),
            };
          case "card_tags":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [{ tags: mockTags[0] }], error: null }),
            };
          case "review_stats":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockReviewStats, error: null }),
            };
          default:
            return {};
        }
      });

      const result = await getFlashcardById(mockSupabase as SupabaseClient, userId, cardId);

      expect(result.id).toBe(cardId);
      expect(result.front).toBe(mockFlashcardRow.front);
      expect(result.tags).toEqual(mockTags);
      expect(result.review_stats).toEqual(mockReviewStats);
    });

    it("should return undefined review_stats when not found", async () => {
      const userId = "user-123";
      const cardId = "card-123";

      const mockFlashcardRow = {
        id: cardId,
        front: "What is React?",
        back: "A JavaScript library for building user interfaces",
        origin: "manual",
        metadata: null,
        category_id: 1,
        content_source_id: null,
        owner_id: userId,
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
        deleted_at: null,
        front_back_fingerprint: "fingerprint",
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockFlashcardRow, error: null }),
            };
          case "card_tags":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          case "review_stats":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
            };
          default:
            return {};
        }
      });

      const result = await getFlashcardById(mockSupabase as SupabaseClient, userId, cardId);

      expect(result.review_stats).toBeUndefined();
    });
  });

  describe("updateFlashcard", () => {
    it("should update flashcard successfully", async () => {
      const userId = "user-123";
      const cardId = "card-123";
      const command: UpdateFlashcardCommand = {
        back: "Updated: A JavaScript library for building user interfaces with components",
      };

      const mockFlashcardRow = {
        id: cardId,
        front: "What is React?",
        back: "Updated: A JavaScript library for building user interfaces with components",
        origin: "manual",
        metadata: null,
        category_id: 1,
        content_source_id: null,
        owner_id: userId,
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T11:00:00.000Z",
        deleted_at: null,
        front_back_fingerprint: "fingerprint",
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "categories":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              head: vi.fn().mockReturnThis(),
              count: vi.fn().mockResolvedValue({ count: 1, error: null }),
            };
          case "flashcards":
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockFlashcardRow, error: null }),
            };
          case "review_stats":
            return {
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
            };
          case "card_tags":
            return {
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
            };
          default:
            return {};
        }
      });

      const result = await updateFlashcard(mockSupabase as SupabaseClient, userId, cardId, command);

      expect(result.back).toBe(command.back);
      expect(result.updated_at).toBe("2025-12-01T11:00:00.000Z");
    });

    it("should reset review stats when front or back is updated", async () => {
      const userId = "user-123";
      const cardId = "card-123";
      const command: UpdateFlashcardCommand = {
        front: "Updated front",
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: cardId,
                  front: "Updated front",
                  back: "Back",
                  origin: "manual",
                  metadata: null,
                  category_id: 1,
                  content_source_id: null,
                  owner_id: userId,
                  created_at: "2025-12-01T10:00:00.000Z",
                  updated_at: "2025-12-01T11:00:00.000Z",
                  deleted_at: null,
                  front_back_fingerprint: "fingerprint",
                },
                error: null,
              }),
            };
          case "review_stats":
            return {
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
            };
          default:
            return {
              select: vi.fn().mockReturnThis(),
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
            };
        }
      });

      const result = await updateFlashcard(mockSupabase as SupabaseClient, userId, cardId, command);

      expect(result.front).toBe(command.front);
    });
  });

  describe("softDeleteFlashcard", () => {
    it("should soft delete flashcard successfully", async () => {
      const userId = "user-123";
      const cardId = "card-123";

      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

      await softDeleteFlashcard(mockSupabase as SupabaseClient, userId, cardId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("soft_delete_flashcard", {
        p_owner_id: userId,
        p_card_id: cardId,
      });
    });

    it("should throw error when flashcard not found", async () => {
      const userId = "user-123";
      const cardId = "card-123";

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        error: { code: "P0001", message: "flashcard_not_found" },
      });

      await expect(softDeleteFlashcard(mockSupabase as SupabaseClient, userId, cardId)).rejects.toThrow(
        "Flashcard not found"
      );
    });
  });

  describe("restoreFlashcard", () => {
    it("should restore flashcard successfully", async () => {
      const cardId = "card-123";

      const mockFlashcardRow = {
        id: cardId,
        front: "What is React?",
        back: "A JavaScript library for building user interfaces",
        origin: "manual",
        metadata: null,
        category_id: 1,
        content_source_id: null,
        owner_id: "user-123",
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T14:00:00.000Z",
        deleted_at: null,
        front_back_fingerprint: "fingerprint",
      };

      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockFlashcardRow, error: null }),
            };
          case "card_tags":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          case "review_stats":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
            };
          default:
            return {};
        }
      });

      const result = await restoreFlashcard(mockSupabase as SupabaseClient, cardId);

      expect(result.id).toBe(cardId);
      expect(result.deleted_at).toBe(null);
    });

    it("should throw FlashcardNotFoundError when flashcard not found", async () => {
      const cardId = "card-123";

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        error: { code: "P0001", message: "flashcard_not_found" },
      });

      await expect(restoreFlashcard(mockSupabase as SupabaseClient, cardId)).rejects.toThrow(FlashcardNotFoundError);
    });

    it("should throw FlashcardUnauthorizedError when not admin", async () => {
      const cardId = "card-123";

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        error: { code: "P0001", message: "not_admin" },
      });

      await expect(restoreFlashcard(mockSupabase as SupabaseClient, cardId)).rejects.toThrow(
        FlashcardUnauthorizedError
      );
    });
  });

  describe("setFlashcardTags", () => {
    it("should set flashcard tags successfully", async () => {
      const userId = "user-123";
      const cardId = "card-123";
      const command: SetFlashcardTagsCommand = {
        tag_ids: [1, 2],
      };

      const mockTags = [
        {
          id: 1,
          name: "React",
          slug: "react",
          description: "JavaScript library",
          created_at: "2025-11-30T09:00:00.000Z",
          updated_at: "2025-11-30T09:00:00.000Z",
        },
        {
          id: 2,
          name: "Frontend",
          slug: "frontend",
          description: "Frontend development",
          created_at: "2025-11-30T10:00:00.000Z",
          updated_at: "2025-11-30T10:00:00.000Z",
        },
      ];

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: mockTags,
        error: null,
      });

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              head: vi.fn().mockReturnThis(),
              count: vi.fn().mockResolvedValue({ count: 1, error: null }),
              is: vi.fn().mockReturnThis(),
            };
          case "tags":
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], error: null }),
            };
          default:
            return {};
        }
      });

      const result = await setFlashcardTags(mockSupabase as SupabaseClient, userId, cardId, command);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it("should throw FlashcardReferenceError when flashcard not accessible", async () => {
      const userId = "user-123";
      const cardId = "card-123";
      const command: SetFlashcardTagsCommand = {
        tag_ids: [],
      };

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "flashcard_not_found" },
      });

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              head: vi.fn().mockReturnThis(),
              count: vi.fn().mockResolvedValue({ count: 1, error: null }),
              is: vi.fn().mockReturnThis(),
            };
          default:
            return {};
        }
      });

      await expect(setFlashcardTags(mockSupabase as SupabaseClient, userId, cardId, command)).rejects.toThrow(
        FlashcardReferenceError
      );
    });

    it("should throw FlashcardReferenceError when tag not found", async () => {
      const userId = "user-123";
      const cardId = "card-123";
      const command: SetFlashcardTagsCommand = {
        tag_ids: [999],
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              head: vi.fn().mockReturnThis(),
              count: vi.fn().mockResolvedValue({ count: 1, error: null }),
              is: vi.fn().mockReturnThis(),
            };
          case "tags":
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          default:
            return {};
        }
      });

      await expect(setFlashcardTags(mockSupabase as SupabaseClient, userId, cardId, command)).rejects.toThrow(
        FlashcardReferenceError
      );
    });
  });
});
