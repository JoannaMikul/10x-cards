import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listGenerationCandidates,
  updateCandidateForOwner,
  getCandidateForOwner,
  rejectCandidateForOwner,
  hasFingerprintConflict,
  acceptCandidateForOwner,
} from "../generation-candidates.service";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { GenerationCandidatesQuery } from "../../validation/generation-candidates.schema";
import type { AcceptGenerationCandidateCommand, UpdateGenerationCandidateCommand } from "../../../types";

type TestableSupabaseClient = Omit<SupabaseClient, "from" | "rpc"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
  rpc: SupabaseClient["rpc"] | ReturnType<typeof vi.fn>;
};

describe("generation-candidates.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    } as TestableSupabaseClient;
  });

  describe("listGenerationCandidates", () => {
    it("should list candidates with default parameters", async () => {
      const userId = "user-123";
      const query: GenerationCandidatesQuery = {
        generationId: "gen-123",
        limit: 20,
      };

      const mockCandidates = [
        {
          id: "cand-1",
          generation_id: "gen-123",
          owner_id: userId,
          front: "What is TCP?",
          back: "Transmission Control Protocol",
          front_back_fingerprint: "fp1",
          status: "proposed" as const,
          accepted_card_id: null,
          suggested_category_id: 1,
          suggested_tags: [1, 2],
          created_at: "2025-12-01T10:00:00.000Z",
          updated_at: "2025-12-01T10:00:00.000Z",
        },
      ];

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockCandidates, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await listGenerationCandidates(mockSupabase as SupabaseClient, userId, query);

      expect(mockSupabase.from).toHaveBeenCalledWith("generation_candidates");
      expect(mockBuilder.select).toHaveBeenCalledWith(
        "id, generation_id, owner_id, front, back, front_back_fingerprint, status, accepted_card_id, suggested_category_id, suggested_tags, created_at, updated_at"
      );
      expect(mockBuilder.eq).toHaveBeenCalledWith("owner_id", userId);
      expect(mockBuilder.eq).toHaveBeenCalledWith("generation_id", "gen-123");
      expect(mockBuilder.order).toHaveBeenCalledWith("id", { ascending: true });
      expect(mockBuilder.limit).toHaveBeenCalledWith(21);

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursorId).toBe(null);
      expect(result.items[0]).toEqual(mockCandidates[0]);
    });

    it("should handle status filtering", async () => {
      const userId = "user-123";
      const query: GenerationCandidatesQuery = {
        generationId: "gen-123",
        statuses: ["proposed", "edited"],
        limit: 10,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await listGenerationCandidates(mockSupabase as SupabaseClient, userId, query);

      expect(mockBuilder.in).toHaveBeenCalledWith("status", ["proposed", "edited"]);
    });

    it("should handle cursor pagination", async () => {
      const userId = "user-123";
      const query: GenerationCandidatesQuery = {
        generationId: "gen-123",
        cursor: "cursor-123",
        limit: 10,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await listGenerationCandidates(mockSupabase as SupabaseClient, userId, query);

      expect(mockBuilder.gt).toHaveBeenCalledWith("id", "cursor-123");
    });

    it("should handle pagination with hasMore", async () => {
      const userId = "user-123";
      const query: GenerationCandidatesQuery = {
        generationId: "gen-123",
        limit: 2,
      };

      const mockCandidates = [
        { id: "cand-1" },
        { id: "cand-2" },
        { id: "cand-3" }, // Extra item for hasMore detection
      ];

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockCandidates, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await listGenerationCandidates(mockSupabase as SupabaseClient, userId, query);

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursorId).toBe("cand-2");
    });

    it("should throw error on database failure", async () => {
      const userId = "user-123";
      const query: GenerationCandidatesQuery = {
        generationId: "gen-123",
        limit: 20,
      };

      const mockError = { message: "Database error" };
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(listGenerationCandidates(mockSupabase as SupabaseClient, userId, query)).rejects.toThrow();
    });
  });

  describe("updateCandidateForOwner", () => {
    it("should update candidate successfully", async () => {
      const userId = "user-123";
      const candidateId = "cand-123";
      const payload: UpdateGenerationCandidateCommand = {
        front: "Updated front",
        back: "Updated back",
      };

      const mockCandidate = {
        id: candidateId,
        generation_id: "gen-123",
        owner_id: userId,
        front: "Updated front",
        back: "Updated back",
        front_back_fingerprint: "fp1",
        status: "edited" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:30:00.000Z",
      };

      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockCandidate, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await updateCandidateForOwner(mockSupabase as SupabaseClient, userId, candidateId, {
        ...payload,
        updated_at: "2025-12-01T10:30:00.000Z",
      });

      expect(mockSupabase.from).toHaveBeenCalledWith("generation_candidates");
      expect(mockBuilder.update).toHaveBeenCalledWith({
        ...payload,
        updated_at: "2025-12-01T10:30:00.000Z",
      });
      expect(mockBuilder.eq).toHaveBeenCalledWith("owner_id", userId);
      expect(mockBuilder.eq).toHaveBeenCalledWith("id", candidateId);
      expect(mockBuilder.in).toHaveBeenCalledWith("status", ["proposed", "edited"]);

      expect(result).toEqual(mockCandidate);
    });

    it("should return null when candidate not found", async () => {
      const userId = "user-123";
      const candidateId = "cand-123";
      const payload: UpdateGenerationCandidateCommand = {
        front: "Updated front",
      };

      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await updateCandidateForOwner(mockSupabase as SupabaseClient, userId, candidateId, {
        ...payload,
        updated_at: "2025-12-01T10:30:00.000Z",
      });

      expect(result).toBeNull();
    });

    it("should throw error on database failure", async () => {
      const userId = "user-123";
      const candidateId = "cand-123";
      const payload: UpdateGenerationCandidateCommand = {
        front: "Updated front",
      };

      const mockError = { message: "Database error" };
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(
        updateCandidateForOwner(mockSupabase as SupabaseClient, userId, candidateId, {
          ...payload,
          updated_at: "2025-12-01T10:30:00.000Z",
        })
      ).rejects.toThrow();
    });
  });

  describe("getCandidateForOwner", () => {
    it("should get candidate successfully", async () => {
      const userId = "user-123";
      const candidateId = "cand-123";

      const mockCandidate = {
        id: candidateId,
        generation_id: "gen-123",
        owner_id: userId,
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        front_back_fingerprint: "fp1",
        status: "proposed" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockCandidate, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getCandidateForOwner(mockSupabase as SupabaseClient, userId, candidateId);

      expect(mockSupabase.from).toHaveBeenCalledWith("generation_candidates");
      expect(mockBuilder.select).toHaveBeenCalledWith(
        "id, generation_id, owner_id, front, back, front_back_fingerprint, status, accepted_card_id, suggested_category_id, suggested_tags, created_at, updated_at"
      );
      expect(mockBuilder.eq).toHaveBeenCalledWith("owner_id", userId);
      expect(mockBuilder.eq).toHaveBeenCalledWith("id", candidateId);

      expect(result).toEqual(mockCandidate);
    });

    it("should return null when candidate not found", async () => {
      const userId = "user-123";
      const candidateId = "cand-123";

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getCandidateForOwner(mockSupabase as SupabaseClient, userId, candidateId);

      expect(result).toBeNull();
    });

    it("should throw error on database failure", async () => {
      const userId = "user-123";
      const candidateId = "cand-123";

      const mockError = { message: "Database error" };
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(getCandidateForOwner(mockSupabase as SupabaseClient, userId, candidateId)).rejects.toThrow();
    });
  });

  describe("rejectCandidateForOwner", () => {
    it("should reject candidate successfully", async () => {
      const userId = "user-123";
      const candidateId = "cand-123";

      const mockCandidate = {
        id: candidateId,
        generation_id: "gen-123",
        owner_id: userId,
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        front_back_fingerprint: "fp1",
        status: "rejected" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:30:00.000Z",
      };

      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockCandidate, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await rejectCandidateForOwner(mockSupabase as SupabaseClient, userId, candidateId);

      expect(mockSupabase.from).toHaveBeenCalledWith("generation_candidates");
      expect(mockBuilder.update).toHaveBeenCalledWith({
        status: "rejected" as const,
        updated_at: expect.any(String),
      });
      expect(mockBuilder.eq).toHaveBeenCalledWith("owner_id", userId);
      expect(mockBuilder.eq).toHaveBeenCalledWith("id", candidateId);
      expect(mockBuilder.is).toHaveBeenCalledWith("accepted_card_id", null);
      expect(mockBuilder.in).toHaveBeenCalledWith("status", ["proposed", "edited"]);

      expect(result).toEqual(mockCandidate);
    });

    it("should return null when candidate not found", async () => {
      const userId = "user-123";
      const candidateId = "cand-123";

      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await rejectCandidateForOwner(mockSupabase as SupabaseClient, userId, candidateId);

      expect(result).toBeNull();
    });
  });

  describe("hasFingerprintConflict", () => {
    it("should return true when fingerprint exists", async () => {
      const userId = "user-123";
      const fingerprint = "fp123";

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                count: 1,
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await hasFingerprintConflict(mockSupabase as SupabaseClient, userId, fingerprint);

      expect(result).toBe(true);
    });

    it("should return false when fingerprint does not exist", async () => {
      const userId = "user-123";
      const fingerprint = "fp123";

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                count: 0,
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await hasFingerprintConflict(mockSupabase as SupabaseClient, userId, fingerprint);

      expect(result).toBe(false);
    });

    it("should return false when count is null", async () => {
      const userId = "user-123";
      const fingerprint = "fp123";

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                count: null,
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await hasFingerprintConflict(mockSupabase as SupabaseClient, userId, fingerprint);

      expect(result).toBe(false);
    });

    it("should throw error on database failure", async () => {
      const userId = "user-123";
      const fingerprint = "fp123";

      const mockError = { message: "Database error" };
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                count: null,
                error: mockError,
              })),
            })),
          })),
        })),
      }));

      await expect(hasFingerprintConflict(mockSupabase as SupabaseClient, userId, fingerprint)).rejects.toThrow();
    });
  });

  describe("acceptCandidateForOwner", () => {
    it("should accept candidate successfully", async () => {
      const userId = "user-123";
      const candidate = {
        id: "cand-123",
        generation_id: "gen-123",
        owner_id: userId,
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        front_back_fingerprint: "fp1",
        status: "proposed" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
      };

      const overrides: AcceptGenerationCandidateCommand = {
        category_id: 2,
        tag_ids: [3, 4],
        origin: "ai-edited",
      };

      const mockFlashcard = {
        id: "card-123",
        front: candidate.front,
        back: candidate.back,
        origin: "ai-edited",
        metadata: {
          accepted_from_candidate_id: candidate.id,
          generation_id: candidate.generation_id,
          candidate_fingerprint: candidate.front_back_fingerprint,
        },
        category_id: 2,
        content_source_id: null,
        owner_id: userId,
        created_at: "2025-12-01T11:00:00.000Z",
        updated_at: "2025-12-01T11:00:00.000Z",
        deleted_at: null,
        tags: [
          {
            id: 3,
            name: "networking",
            slug: "networking",
            description: "Network protocols",
            created_at: "2025-11-30T09:00:00.000Z",
            updated_at: "2025-11-30T09:00:00.000Z",
          },
        ],
      };

      // Mock RPC call
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: { new_card_id: "card-123" },
        error: null,
      });

      // Mock flashcard fetch
      const mockFlashcardBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockFlashcard, error: null }),
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return mockFlashcardBuilder;
          case "card_tags":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [{ tags: mockFlashcard.tags[0] }],
                error: null,
              }),
            };
          default:
            return {};
        }
      });

      const result = await acceptCandidateForOwner(mockSupabase as SupabaseClient, userId, candidate, overrides);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("accept_generation_candidate", {
        p_owner_id: userId,
        p_candidate_id: candidate.id,
        p_origin: "ai-edited",
        p_category_id: 2,
        p_tag_ids: [3, 4],
        p_content_source_id: null,
        p_metadata: {
          accepted_from_candidate_id: candidate.id,
          generation_id: candidate.generation_id,
          candidate_fingerprint: candidate.front_back_fingerprint,
        },
      });

      expect(result).toEqual(mockFlashcard);
    });

    it("should accept candidate with default values", async () => {
      const userId = "user-123";
      const candidate = {
        id: "cand-123",
        generation_id: "gen-123",
        owner_id: userId,
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        front_back_fingerprint: "fp1",
        status: "proposed" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
      };

      const mockFlashcard = {
        id: "card-123",
        front: candidate.front,
        back: candidate.back,
        origin: "ai-full",
        metadata: {
          accepted_from_candidate_id: candidate.id,
          generation_id: candidate.generation_id,
          candidate_fingerprint: candidate.front_back_fingerprint,
        },
        category_id: 1,
        content_source_id: null,
        owner_id: userId,
        created_at: "2025-12-01T11:00:00.000Z",
        updated_at: "2025-12-01T11:00:00.000Z",
        deleted_at: null,
        tags: [],
      };

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: { card_id: "card-123" },
        error: null,
      });

      const mockFlashcardBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockFlashcard, error: null }),
      };

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return mockFlashcardBuilder;
          case "card_tags":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          default:
            return {};
        }
      });

      const result = await acceptCandidateForOwner(mockSupabase as SupabaseClient, userId, candidate);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("accept_generation_candidate", {
        p_owner_id: userId,
        p_candidate_id: candidate.id,
        p_origin: "ai-full",
        p_category_id: 1,
        p_tag_ids: [1, 2],
        p_content_source_id: null,
        p_metadata: {
          accepted_from_candidate_id: candidate.id,
          generation_id: candidate.generation_id,
          candidate_fingerprint: candidate.front_back_fingerprint,
        },
      });

      expect(result).toEqual(mockFlashcard);
    });

    it("should accept edited candidate as ai-edited", async () => {
      const userId = "user-123";
      const candidate = {
        id: "cand-123",
        generation_id: "gen-123",
        owner_id: userId,
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        front_back_fingerprint: "fp1",
        status: "edited" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
      };

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: { id: "card-123" },
        error: null,
      });

      mockSupabase.from = vi.fn((table) => {
        switch (table) {
          case "flashcards":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: "card-123", tags: [] },
                error: null,
              }),
            };
          case "card_tags":
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          default:
            return {};
        }
      });

      await acceptCandidateForOwner(mockSupabase as SupabaseClient, userId, candidate);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "accept_generation_candidate",
        expect.objectContaining({
          p_origin: "ai-edited",
        })
      );
    });

    it("should throw error on missing generation_id", async () => {
      const userId = "user-123";
      const candidate = {
        id: "cand-123",
        generation_id: "",
        owner_id: userId,
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        front_back_fingerprint: "fp1",
        status: "proposed" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
      };

      await expect(acceptCandidateForOwner(mockSupabase as SupabaseClient, userId, candidate)).rejects.toThrow(
        "Generation candidate is missing generation reference."
      );
    });

    it("should throw error on missing fingerprint", async () => {
      const userId = "user-123";
      const candidate = {
        id: "cand-123",
        generation_id: "gen-123",
        owner_id: userId,
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        front_back_fingerprint: "",
        status: "proposed" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
      };

      await expect(acceptCandidateForOwner(mockSupabase as SupabaseClient, userId, candidate)).rejects.toThrow(
        "Generation candidate is missing fingerprint data."
      );
    });

    it("should throw error on RPC failure", async () => {
      const userId = "user-123";
      const candidate = {
        id: "cand-123",
        generation_id: "gen-123",
        owner_id: userId,
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        front_back_fingerprint: "fp1",
        status: "proposed" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
      };

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "RPC error" },
      });

      await expect(acceptCandidateForOwner(mockSupabase as SupabaseClient, userId, candidate)).rejects.toThrow();
    });

    it("should throw error when RPC returns no flashcard id", async () => {
      const userId = "user-123";
      const candidate = {
        id: "cand-123",
        generation_id: "gen-123",
        owner_id: userId,
        front: "What is TCP?",
        back: "Transmission Control Protocol",
        front_back_fingerprint: "fp1",
        status: "proposed" as const,
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [1, 2],
        created_at: "2025-12-01T10:00:00.000Z",
        updated_at: "2025-12-01T10:00:00.000Z",
      };

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      await expect(acceptCandidateForOwner(mockSupabase as SupabaseClient, userId, candidate)).rejects.toThrow(
        "accept_generation_candidate RPC returned an unexpected payload."
      );
    });
  });
});
