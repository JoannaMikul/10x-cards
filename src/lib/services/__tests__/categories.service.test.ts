import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCategories, createCategory, updateCategoryById, deleteCategoryById } from "../categories.service";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { CategoriesQuery } from "../../validation/categories.schema";
import type { CreateCategoryCommand, UpdateCategoryCommand } from "../../../types";

/**
 * Test-compatible Supabase client that allows method overrides
 * Extends the real SupabaseClient but makes 'from' writable for mocking
 */
type TestableSupabaseClient = Omit<SupabaseClient, "from"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
};

describe("categories.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    } as TestableSupabaseClient;
  });

  describe("listCategories", () => {
    it("should list categories with default parameters", async () => {
      const mockQuery: CategoriesQuery = { limit: 20, sort: "name" };
      const mockResponse = {
        data: [
          {
            id: 1,
            name: "AI Fundamentals",
            slug: "ai-fundamentals",
            description: "Core AI/ML concepts",
            color: "#6D28D9",
            created_at: "2025-10-30T09:00:00.000Z",
            updated_at: "2025-11-01T10:00:00.000Z",
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

      const result = await listCategories(mockSupabase as SupabaseClient, mockQuery);

      expect(mockSupabase.from).toHaveBeenCalledWith("categories");
      expect(mockBuilder.select).toHaveBeenCalledWith("id, name, slug, description, color, created_at, updated_at");
      expect(mockBuilder.order).toHaveBeenCalledWith("name", { ascending: true });
      expect(mockBuilder.order).toHaveBeenCalledWith("id", { ascending: true });
      expect(mockBuilder.limit).toHaveBeenCalledWith(21);

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursorId).toBe(null);
      expect(result.items[0]).toEqual({
        id: 1,
        name: "AI Fundamentals",
        slug: "ai-fundamentals",
        description: "Core AI/ML concepts",
        color: "#6D28D9",
        created_at: "2025-10-30T09:00:00.000Z",
        updated_at: "2025-11-01T10:00:00.000Z",
      });
    });

    it("should handle search filtering", async () => {
      const mockQuery: CategoriesQuery = { limit: 10, sort: "name", search: "ai" };
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

      await listCategories(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.or).toHaveBeenCalledWith("name.ilike.%ai%,slug.ilike.%ai%");
    });

    it("should handle cursor pagination", async () => {
      const mockQuery: CategoriesQuery = { limit: 5, sort: "name", cursor: 10 };
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

      await listCategories(mockSupabase as SupabaseClient, mockQuery);

      expect(mockBuilder.gt).toHaveBeenCalledWith("id", 10);
    });

    it("should detect hasMore when limit + 1 items returned", async () => {
      const mockQuery: CategoriesQuery = { limit: 2, sort: "name" };
      const mockResponse = {
        data: [
          {
            id: 1,
            name: "Cat1",
            slug: "cat1",
            description: null,
            color: null,
            created_at: "2025-01-01T00:00:00.000Z",
            updated_at: "2025-01-01T00:00:00.000Z",
          },
          {
            id: 2,
            name: "Cat2",
            slug: "cat2",
            description: null,
            color: null,
            created_at: "2025-01-01T00:00:00.000Z",
            updated_at: "2025-01-01T00:00:00.000Z",
          },
          {
            id: 3,
            name: "Cat3",
            slug: "cat3",
            description: null,
            color: null,
            created_at: "2025-01-01T00:00:00.000Z",
            updated_at: "2025-01-01T00:00:00.000Z",
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

      const result = await listCategories(mockSupabase as SupabaseClient, mockQuery);

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursorId).toBe(2);
    });

    it("should throw error on database failure", async () => {
      const mockQuery: CategoriesQuery = { limit: 20, sort: "name" };
      const mockError = new Error("Database connection failed");

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(listCategories(mockSupabase as SupabaseClient, mockQuery)).rejects.toThrow(mockError);
    });
  });

  describe("createCategory", () => {
    it("should create category successfully", async () => {
      const command: CreateCategoryCommand = {
        name: "New Category",
        slug: "new-category",
        description: "Description",
        color: "#FF0000",
      };

      const mockResponse = {
        data: {
          id: 1,
          name: "New Category",
          slug: "new-category",
          description: "Description",
          color: "#FF0000",
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
        error: null,
      };

      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await createCategory(mockSupabase as SupabaseClient, command);

      expect(mockSupabase.from).toHaveBeenCalledWith("categories");
      expect(mockBuilder.insert).toHaveBeenCalledWith({
        name: "New Category",
        slug: "new-category",
        description: "Description",
        color: "#FF0000",
      });
      expect(mockBuilder.select).toHaveBeenCalledWith("id, name, slug, description, color, created_at, updated_at");
      expect(result).toEqual(mockResponse.data);
    });

    it("should throw error on database failure", async () => {
      const command: CreateCategoryCommand = {
        name: "Test",
        slug: "test",
      };

      const mockError = new Error("Insert failed");

      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(createCategory(mockSupabase as SupabaseClient, command)).rejects.toThrow(mockError);
    });

    it("should throw error when no data returned", async () => {
      const command: CreateCategoryCommand = {
        name: "Test",
        slug: "test",
      };

      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(createCategory(mockSupabase as SupabaseClient, command)).rejects.toThrow(
        "Failed to create category: no data returned from database"
      );
    });
  });

  describe("updateCategoryById", () => {
    it("should update category successfully", async () => {
      const patch: UpdateCategoryCommand = {
        name: "Updated Name",
        description: "Updated description",
      };

      const mockResponse = {
        data: {
          id: 1,
          name: "Updated Name",
          slug: "original-slug",
          description: "Updated description",
          color: "#000000",
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-02T00:00:00.000Z",
        },
        error: null,
      };

      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await updateCategoryById(mockSupabase as SupabaseClient, 1, patch);

      expect(mockSupabase.from).toHaveBeenCalledWith("categories");
      expect(mockBuilder.update).toHaveBeenCalledWith(patch);
      expect(mockBuilder.eq).toHaveBeenCalledWith("id", 1);
      expect(result).toEqual(mockResponse.data);
    });

    it("should throw error when category not found", async () => {
      const patch: UpdateCategoryCommand = { name: "New Name" };

      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(updateCategoryById(mockSupabase as SupabaseClient, 999, patch)).rejects.toThrow(
        "Category with id 999 not found"
      );
    });

    it("should throw error on database failure", async () => {
      const patch: UpdateCategoryCommand = { name: "New Name" };
      const mockError = new Error("Update failed");

      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(updateCategoryById(mockSupabase as SupabaseClient, 1, patch)).rejects.toThrow(mockError);
    });
  });

  describe("deleteCategoryById", () => {
    it("should delete category successfully", async () => {
      const mockResponse = {
        data: { id: 1 },
        error: null,
      };

      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(deleteCategoryById(mockSupabase as SupabaseClient, 1)).resolves.toBeUndefined();

      expect(mockSupabase.from).toHaveBeenCalledWith("categories");
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenCalledWith("id", 1);
    });

    it("should throw error when category not found", async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(deleteCategoryById(mockSupabase as SupabaseClient, 999)).rejects.toThrow(
        "Category with id 999 not found"
      );
    });

    it("should throw error on database failure", async () => {
      const mockError = new Error("Delete failed");

      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(deleteCategoryById(mockSupabase as SupabaseClient, 1)).rejects.toThrow(mockError);
    });
  });
});
