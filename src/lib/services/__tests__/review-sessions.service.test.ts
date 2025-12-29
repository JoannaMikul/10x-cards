import { describe, it, expect, vi, beforeEach } from "vitest";
import { createReviewSession, prepareReviewSession } from "../review-sessions.service";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { CreateReviewSessionCommand } from "../../../types";

/**
 * Test-compatible Supabase client that allows method overrides
 * Extends the real SupabaseClient but makes 'from' writable for mocking
 */
type TestableSupabaseClient = Omit<SupabaseClient, "from"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
};

describe("review-sessions.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    } as TestableSupabaseClient;
  });

  describe("createReviewSession", () => {
    it("should create review session with valid reviews", async () => {
      const command: CreateReviewSessionCommand = {
        session_id: "550e8400-e29b-41d4-a716-446655440000",
        started_at: "2025-12-30T10:00:00.000Z",
        completed_at: "2025-12-30T10:05:30.000Z",
        reviews: [
          {
            card_id: "550e8400-e29b-41d4-a716-446655440001",
            outcome: "good",
            response_time_ms: 1500,
          },
          {
            card_id: "550e8400-e29b-41d4-a716-446655440002",
            outcome: "easy",
            response_time_ms: 800,
          },
        ],
      };

      const validateOwnershipMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [{ id: "550e8400-e29b-41d4-a716-446655440001" }, { id: "550e8400-e29b-41d4-a716-446655440002" }],
          error: null,
        }),
      };

      const fetchStatsMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const insertEventsMock = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from = vi.fn((table) => {
        if (table === "flashcards") return validateOwnershipMock;
        if (table === "review_stats") return fetchStatsMock;
        if (table === "review_events") return insertEventsMock;
        return {};
      });

      const result = await createReviewSession(mockSupabase as SupabaseClient, "user-123", command);

      expect(result.logged).toBe(2);
      expect(validateOwnershipMock.select).toHaveBeenCalledWith("id");
      expect(fetchStatsMock.select).toHaveBeenCalledWith("*");
      expect(insertEventsMock.insert).toHaveBeenCalled();
    });

    it("should handle empty review session", async () => {
      const command: CreateReviewSessionCommand = {
        session_id: "550e8400-e29b-41d4-a716-446655440000",
        started_at: "2025-12-30T10:00:00.000Z",
        completed_at: "2025-12-30T10:00:00.000Z",
        reviews: [],
      };

      const result = await createReviewSession(mockSupabase as SupabaseClient, "user-123", command);

      expect(result.logged).toBe(0);
    });

    it("should throw error for invalid user ID", async () => {
      const command: CreateReviewSessionCommand = {
        session_id: "550e8400-e29b-41d4-a716-446655440000",
        started_at: "2025-12-30T10:00:00.000Z",
        completed_at: "2025-12-30T10:05:30.000Z",
        reviews: [
          {
            card_id: "550e8400-e29b-41d4-a716-446655440001",
            outcome: "good",
          },
        ],
      };

      await expect(createReviewSession(mockSupabase as SupabaseClient, "", command)).rejects.toThrow(
        "User ID is required"
      );
    });

    it("should throw error for invalid review outcome", async () => {
      const command: CreateReviewSessionCommand = {
        session_id: "550e8400-e29b-41d4-a716-446655440000",
        started_at: "2025-12-30T10:00:00.000Z",
        completed_at: "2025-12-30T10:05:30.000Z",
        reviews: [
          {
            card_id: "550e8400-e29b-41d4-a716-446655440001",
            outcome: "invalid" as unknown as "fail" | "hard" | "good" | "easy" | "again",
          },
        ],
      };

      const validateOwnershipMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [{ id: "550e8400-e29b-41d4-a716-446655440001" }],
          error: null,
        }),
      };

      mockSupabase.from = vi.fn((table) => {
        if (table === "flashcards") return validateOwnershipMock;
        return {};
      });

      await expect(createReviewSession(mockSupabase as SupabaseClient, "user-123", command)).rejects.toThrow(
        "Invalid review outcome: invalid"
      );
    });

    it("should throw error when card is not owned by user", async () => {
      const command: CreateReviewSessionCommand = {
        session_id: "550e8400-e29b-41d4-a716-446655440000",
        started_at: "2025-12-30T10:00:00.000Z",
        completed_at: "2025-12-30T10:05:30.000Z",
        reviews: [
          {
            card_id: "550e8400-e29b-41d4-a716-446655440001",
            outcome: "good",
          },
        ],
      };

      const validateOwnershipMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [], // No cards found
          error: null,
        }),
      };

      mockSupabase.from = vi.fn((table) => {
        if (table === "flashcards") return validateOwnershipMock;
        return {};
      });

      await expect(createReviewSession(mockSupabase as SupabaseClient, "user-123", command)).rejects.toThrow(
        "Cards not found or not owned by user: 550e8400-e29b-41d4-a716-446655440001"
      );
    });
  });

  describe("prepareReviewSession", () => {
    it("should validate review session parameters", async () => {
      const params = { cardIds: "invalid-uuid" };

      await expect(prepareReviewSession(mockSupabase as SupabaseClient, "user-123", params)).rejects.toThrow(
        "Invalid card ID format: invalid-uuid"
      );
    });
  });
});
