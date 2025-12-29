import { describe, it, expect, vi, beforeEach } from "vitest";
import { listTags } from "../tags.service";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { TagsQuery } from "../../validation/tags.schema";

/**
 * Test-compatible Supabase client that allows method overrides
 * Extends the real SupabaseClient but makes 'from' writable for mocking
 */
type TestableSupabaseClient = Omit<SupabaseClient, "from"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
};

describe("tags.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    } as TestableSupabaseClient;
  });

  describe("listTags", () => {
    it("should list tags with default parameters", async () => {
      const mockQuery: TagsQuery = { limit: 20, sort: "name" };
      const mockResponse = {
        data: [
          {
            id: 1,
            name: "docker",
            slug: "docker",
            description: "Containers and OCI images",
            created_at: "2025-11-01T08:00:00.000Z",
            updated_at: "2025-11-01T08:00:00.000Z",
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

      const result = await listTags(mockSupabase as SupabaseClient, mockQuery);

      expect(mockSupabase.from).toHaveBeenCalledWith("tags");
      expect(mockBuilder.select).toHaveBeenCalledWith("id, name, slug, description, created_at, updated_at");
      expect(mockBuilder.order).toHaveBeenCalledWith("name", { ascending: true });
      expect(mockBuilder.order).toHaveBeenCalledWith("id", { ascending: true });
      expect(mockBuilder.limit).toHaveBeenCalledWith(21);

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursorId).toBe(null);
      expect(result.items[0]).toEqual({
        id: 1,
        name: "docker",
        slug: "docker",
        description: "Containers and OCI images",
        created_at: "2025-11-01T08:00:00.000Z",
        updated_at: "2025-11-01T08:00:00.000Z",
      });
    });

    it("should handle search filtering", async () => {
      const mockQuery: TagsQuery = { limit: 10, sort: "name", search: "docker" };
      const mockResponse = {
        data: [],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await listTags(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.or).toHaveBeenCalledWith("name.ilike.%docker%,slug.ilike.%docker%");
    });

    it("should handle cursor pagination", async () => {
      const mockQuery: TagsQuery = { limit: 5, sort: "name", cursor: 10 };
      const mockResponse = {
        data: [],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await listTags(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.gt).toHaveBeenCalledWith("id", 10);
    });

    it("should handle search and cursor together", async () => {
      const mockQuery: TagsQuery = { limit: 15, sort: "created_at", search: "k8s", cursor: 5 };
      const mockResponse = {
        data: [],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await listTags(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.order).toHaveBeenCalledWith("created_at", { ascending: true });
      expect(mockBuilder.or).toHaveBeenCalledWith("name.ilike.%k8s%,slug.ilike.%k8s%");
      expect(mockBuilder.gt).toHaveBeenCalledWith("id", 5);
    });

    it("should handle pagination with hasMore and nextCursorId", async () => {
      const mockQuery: TagsQuery = { limit: 2, sort: "name" };
      const mockResponse = {
        data: [
          {
            id: 1,
            name: "docker",
            slug: "docker",
            description: "Containers and OCI images",
            created_at: "2025-11-01T08:00:00.000Z",
            updated_at: "2025-11-01T08:00:00.000Z",
          },
          {
            id: 2,
            name: "kubernetes",
            slug: "kubernetes",
            description: "Container orchestration",
            created_at: "2025-11-01T09:00:00.000Z",
            updated_at: "2025-11-01T09:00:00.000Z",
          },
          {
            id: 3,
            name: "database",
            slug: "database",
            description: "Relational and non-relational databases",
            created_at: "2025-11-02T12:30:00.000Z",
            updated_at: "2025-11-04T10:00:00.000Z",
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

      const result = await listTags(mockSupabase as SupabaseClient, mockQuery);

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursorId).toBe(2);
    });

    it("should handle empty results", async () => {
      const mockQuery: TagsQuery = { limit: 10, sort: "name" };
      const mockResponse = {
        data: [],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await listTags(mockSupabase as SupabaseClient, mockQuery);

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursorId).toBe(null);
    });

    it("should throw error when Supabase returns error", async () => {
      const mockQuery: TagsQuery = { limit: 20, sort: "name" };
      const mockError = new Error("Database connection failed");

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(listTags(mockSupabase as SupabaseClient, mockQuery)).rejects.toThrow("Database connection failed");
    });

    it("should handle null data gracefully", async () => {
      const mockQuery: TagsQuery = { limit: 20, sort: "name" };
      const mockResponse = {
        data: null,
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await listTags(mockSupabase as SupabaseClient, mockQuery);

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursorId).toBe(null);
    });
  });
});
