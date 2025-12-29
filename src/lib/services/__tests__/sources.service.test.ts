import { describe, it, expect, vi, beforeEach } from "vitest";
import { listSources } from "../sources.service";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { SourcesQuery } from "../../validation/sources.schema";

/**
 * Test-compatible Supabase client that allows method overrides
 * Extends the real SupabaseClient but makes 'from' writable for mocking
 */
type TestableSupabaseClient = Omit<SupabaseClient, "from"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
};

describe("sources.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    } as TestableSupabaseClient;
  });

  describe("listSources", () => {
    it("should list sources with default parameters", async () => {
      const mockQuery: SourcesQuery = { limit: 20, sort: "name" };
      const mockResponse = {
        data: [
          {
            id: 1,
            name: "Docker Documentation",
            slug: "docker-documentation",
            description: "Official Docker documentation and guides",
            kind: "documentation",
            url: "https://docs.docker.com",
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

      const result = await listSources(mockSupabase as SupabaseClient, mockQuery);

      expect(mockSupabase.from).toHaveBeenCalledWith("sources");
      expect(mockBuilder.select).toHaveBeenCalledWith("id, name, slug, description, kind, url, created_at, updated_at");
      expect(mockBuilder.order).toHaveBeenCalledWith("name", { ascending: true });
      expect(mockBuilder.order).toHaveBeenCalledWith("id", { ascending: true });
      expect(mockBuilder.limit).toHaveBeenCalledWith(21);

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursorId).toBeNull();
    });

    it("should handle kind filter", async () => {
      const mockQuery: SourcesQuery = { limit: 10, sort: "name", kind: "book" };
      const mockResponse = {
        data: [
          {
            id: 2,
            name: "Kubernetes in Action",
            slug: "kubernetes-in-action",
            description: "Comprehensive guide to Kubernetes",
            kind: "book",
            url: "https://www.manning.com/books/kubernetes-in-action",
            created_at: "2025-11-01T09:00:00.000Z",
            updated_at: "2025-11-01T09:00:00.000Z",
          },
        ],
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await listSources(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.eq).toHaveBeenCalledWith("kind", "book");
      expect(result.items).toHaveLength(1);
    });

    it("should handle search filter", async () => {
      const mockQuery: SourcesQuery = { limit: 10, sort: "name", search: "kubernetes" };
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

      await listSources(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.or).toHaveBeenCalledWith("name.ilike.%kubernetes%,slug.ilike.%kubernetes%");
    });

    it("should handle cursor pagination", async () => {
      const mockQuery: SourcesQuery = { limit: 5, sort: "name", cursor: 10 };
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

      await listSources(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.gt).toHaveBeenCalledWith("id", 10);
    });

    it("should handle pagination with hasMore", async () => {
      const mockQuery: SourcesQuery = { limit: 2, sort: "name" };
      const mockResponse = {
        data: [
          {
            id: 1,
            name: "Docker Documentation",
            slug: "docker-documentation",
            description: "Official Docker documentation and guides",
            kind: "documentation",
            url: "https://docs.docker.com",
            created_at: "2025-11-01T08:00:00.000Z",
            updated_at: "2025-11-01T08:00:00.000Z",
          },
          {
            id: 2,
            name: "Kubernetes in Action",
            slug: "kubernetes-in-action",
            description: "Comprehensive guide to Kubernetes",
            kind: "book",
            url: "https://www.manning.com/books/kubernetes-in-action",
            created_at: "2025-11-01T09:00:00.000Z",
            updated_at: "2025-11-01T09:00:00.000Z",
          },
          {
            id: 3,
            name: "React Official Docs",
            slug: "react-official-docs",
            description: "Official React documentation",
            kind: "documentation",
            url: "https://react.dev",
            created_at: "2025-11-02T10:00:00.000Z",
            updated_at: "2025-11-02T10:00:00.000Z",
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

      const result = await listSources(mockSupabase as SupabaseClient, mockQuery);

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursorId).toBe(2);
    });

    it("should handle empty results", async () => {
      const mockQuery: SourcesQuery = { limit: 10, sort: "name" };
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

      const result = await listSources(mockSupabase as SupabaseClient, mockQuery);

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursorId).toBeNull();
    });

    it("should throw error for invalid query parameters", async () => {
      await expect(listSources(mockSupabase as SupabaseClient, null as never)).rejects.toThrow(
        "Invalid query parameters: query must be an object"
      );
    });

    it("should throw error for invalid limit", async () => {
      const mockQuery: SourcesQuery = { limit: 0, sort: "name" };

      await expect(listSources(mockSupabase as SupabaseClient, mockQuery)).rejects.toThrow(
        "Invalid limit: must be between 1 and 1000"
      );
    });

    it("should throw error for invalid cursor", async () => {
      const mockQuery: SourcesQuery = { limit: 10, sort: "name", cursor: -1 };

      await expect(listSources(mockSupabase as SupabaseClient, mockQuery)).rejects.toThrow(
        "Invalid cursor: must be a positive number"
      );
    });

    it("should throw error for invalid search type", async () => {
      const mockQuery: SourcesQuery = { limit: 10, sort: "name", search: 123 as never };

      await expect(listSources(mockSupabase as SupabaseClient, mockQuery)).rejects.toThrow(
        "Invalid search: must be a string"
      );
    });

    it("should throw error for database failure", async () => {
      const mockQuery: SourcesQuery = { limit: 10, sort: "name" };
      const mockError = new Error("Database connection failed");

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(listSources(mockSupabase as SupabaseClient, mockQuery)).rejects.toThrow(
        "Failed to fetch sources: Database connection failed"
      );
    });

    it("should throw error for invalid response data", async () => {
      const mockQuery: SourcesQuery = { limit: 10, sort: "name" };
      const mockResponse = {
        data: "invalid data",
        error: null,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(listSources(mockSupabase as SupabaseClient, mockQuery)).rejects.toThrow(
        "Invalid response: data must be an array"
      );
    });

    it("should handle sorting by created_at", async () => {
      const mockQuery: SourcesQuery = { limit: 10, sort: "created_at" };
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

      await listSources(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    });
  });
});
