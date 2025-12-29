import { describe, it, expect } from "vitest";
import {
  categoriesQuerySchema,
  decodeCategoryCursor,
  buildCategoriesQuery,
  createCategoryBodySchema,
  updateCategoryBodySchema,
  categoryIdParamSchema,
  InvalidCategoryCursorError,
  type CategoriesQuerySchema,
} from "../categories.schema";

describe("categoriesQuerySchema", () => {
  describe("search validation", () => {
    it("accepts valid search string", () => {
      const result = categoriesQuerySchema.safeParse({
        search: "test query",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBe("test query");
    });

    it("trims whitespace from search string", () => {
      const result = categoriesQuerySchema.safeParse({
        search: "  test query  ",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBe("test query");
    });

    it("accepts empty search string as undefined", () => {
      const result = categoriesQuerySchema.safeParse({
        search: "",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBeUndefined();
    });

    it("accepts whitespace-only search string as undefined", () => {
      const result = categoriesQuerySchema.safeParse({
        search: "   ",
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBeUndefined();
    });

    it("rejects search string exceeding 200 characters", () => {
      const longSearch = "a".repeat(201);
      const result = categoriesQuerySchema.safeParse({
        search: longSearch,
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Search query cannot exceed 200 characters.");
    });

    it("accepts undefined search", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.search).toBeUndefined();
    });
  });

  describe("limit validation", () => {
    it("accepts valid numeric limit", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 50,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it("accepts valid string limit", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: "30",
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(30);
    });

    it("defaults to 20 when limit is not provided", () => {
      const result = categoriesQuerySchema.safeParse({
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });

    it("defaults to 20 for empty string limit", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: "",
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });

    it("defaults to 20 for whitespace-only string limit", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: "   ",
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });

    it("rejects limit below minimum", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 0,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be at least 1.");
    });

    it("rejects limit above maximum", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 101,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit cannot exceed 100.");
    });

    it("rejects non-integer limit", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 10.5,
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be a valid integer.");
    });

    it("rejects invalid string limit", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: "invalid",
        sort: "name",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be a valid integer.");
    });
  });

  describe("sort validation", () => {
    it("accepts valid sort fields", () => {
      const validSorts = ["name", "created_at"];

      validSorts.forEach((sort) => {
        const result = categoriesQuerySchema.safeParse({
          limit: 20,
          sort,
        });
        expect(result.success).toBe(true);
        expect(result.data?.sort).toBe(sort);
      });
    });

    it("defaults to 'name' when sort is not provided", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("name");
    });

    it("defaults to 'name' for invalid string sort", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "invalid",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Sort must be one of: name, created_at.");
    });

    it("normalizes sort field to lowercase", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "NAME",
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("name");
    });

    it("trims whitespace from sort field", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "  name  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("name");
    });

    it("defaults to 'name' for empty sort string", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "",
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("name");
    });

    it("defaults to 'name' for whitespace-only sort string", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "   ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.sort).toBe("name");
    });
  });

  describe("cursor validation", () => {
    it("accepts valid cursor string", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "name",
        cursor: "valid-cursor",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("valid-cursor");
    });

    it("trims whitespace from cursor", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "name",
        cursor: "  valid-cursor  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("valid-cursor");
    });

    it("rejects empty cursor string", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "name",
        cursor: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Cursor cannot be empty.");
    });

    it("accepts undefined cursor", () => {
      const result = categoriesQuerySchema.safeParse({
        limit: 20,
        sort: "name",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBeUndefined();
    });
  });
});

describe("decodeCategoryCursor", () => {
  it("decodes valid base64 cursor to positive integer", () => {
    const result = decodeCategoryCursor("MTIz"); // base64 for "123"
    expect(result).toBe(123);
  });

  it("decodes base64 cursor with whitespace", () => {
    const result = decodeCategoryCursor("IDEyMyA="); // base64 for " 123 "
    expect(result).toBe(123);
  });

  it("throws InvalidCategoryCursorError for invalid base64", () => {
    expect(() => decodeCategoryCursor("invalid-base64!")).toThrow(InvalidCategoryCursorError);
    expect(() => decodeCategoryCursor("invalid-base64!")).toThrow("Cursor must be a valid Base64 string.");
  });

  it("throws InvalidCategoryCursorError for non-integer decoded value", () => {
    expect(() => decodeCategoryCursor("bm90LW51bWJlcg==")).toThrow(InvalidCategoryCursorError); // base64 for "not-number"
    expect(() => decodeCategoryCursor("bm90LW51bWJlcg==")).toThrow(
      "Cursor must decode to a positive integer identifier."
    );
  });

  it("throws InvalidCategoryCursorError for zero decoded value", () => {
    expect(() => decodeCategoryCursor("MA==")).toThrow(InvalidCategoryCursorError); // base64 for "0"
    expect(() => decodeCategoryCursor("MA==")).toThrow("Cursor must decode to a positive integer identifier.");
  });

  it("throws InvalidCategoryCursorError for negative decoded value", () => {
    expect(() => decodeCategoryCursor("LTU=")).toThrow(InvalidCategoryCursorError); // base64 for "-5"
    expect(() => decodeCategoryCursor("LTU=")).toThrow("Cursor must decode to a positive integer identifier.");
  });

  it("throws InvalidCategoryCursorError for float decoded value", () => {
    expect(() => decodeCategoryCursor("MTIzLjQ1")).toThrow(InvalidCategoryCursorError); // base64 for "123.45"
    expect(() => decodeCategoryCursor("MTIzLjQ1")).toThrow("Cursor must decode to a positive integer identifier.");
  });

  it("accepts valid integer string that was decoded", () => {
    const result = decodeCategoryCursor("MTIz"); // base64 for "123"
    expect(result).toBe(123);
  });
});

describe("buildCategoriesQuery", () => {
  it("builds query without cursor", () => {
    const payload: CategoriesQuerySchema = {
      search: "test",
      limit: 50,
      sort: "created_at",
    };

    const result = buildCategoriesQuery(payload);
    expect(result).toEqual({
      search: "test",
      limit: 50,
      sort: "created_at",
    });
  });

  it("builds query with valid cursor", () => {
    const payload: CategoriesQuerySchema = {
      search: "test",
      limit: 50,
      sort: "created_at",
      cursor: "MTIz", // base64 for "123"
    };

    const result = buildCategoriesQuery(payload);
    expect(result).toEqual({
      search: "test",
      limit: 50,
      sort: "created_at",
      cursor: 123,
    });
  });

  it("throws InvalidCategoryCursorError for invalid cursor in payload", () => {
    const payload: CategoriesQuerySchema = {
      search: "test",
      limit: 50,
      sort: "created_at",
      cursor: "invalid-base64!",
    };

    expect(() => buildCategoriesQuery(payload)).toThrow(InvalidCategoryCursorError);
    expect(() => buildCategoriesQuery(payload)).toThrow("Cursor must be a valid Base64 string.");
  });
});

describe("createCategoryBodySchema", () => {
  describe("name validation", () => {
    it("accepts valid name", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
      });
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("Test Category");
    });

    it("trims whitespace from name", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "  Test Category  ",
        slug: "test-category",
      });
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("Test Category");
    });

    it("rejects empty name", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "",
        slug: "test-category",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Category name cannot be empty.");
    });

    it("rejects whitespace-only name", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "   ",
        slug: "test-category",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Category name cannot be empty.");
    });

    it("accepts name with only whitespace trimmed", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "test",
        slug: "test-category",
      });
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("test");
    });

    it("rejects name exceeding 255 characters", () => {
      const longName = "a".repeat(256);
      const result = createCategoryBodySchema.safeParse({
        name: longName,
        slug: "test-category",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Category name cannot exceed 255 characters.");
    });
  });

  describe("slug validation", () => {
    it("accepts valid slug", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category-123",
      });
      expect(result.success).toBe(true);
      expect(result.data?.slug).toBe("test-category-123");
    });

    it("rejects empty slug", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Category slug cannot be empty.");
    });

    it("rejects slug with uppercase letters", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "Test-Category",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "Category slug must contain only lowercase letters, numbers, and hyphens."
      );
    });

    it("rejects slug with invalid characters", () => {
      const invalidSlugs = ["test_category", "test.category", "test category", "test@category"];

      invalidSlugs.forEach((slug) => {
        const result = createCategoryBodySchema.safeParse({
          name: "Test Category",
          slug,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Category slug must contain only lowercase letters, numbers, and hyphens."
        );
      });
    });

    it("rejects slug exceeding 255 characters", () => {
      const longSlug = "a".repeat(256);
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: longSlug,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Category slug cannot exceed 255 characters.");
    });
  });

  describe("description validation", () => {
    it("accepts valid description", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
        description: "Test description",
      });
      expect(result.success).toBe(true);
      expect(result.data?.description).toBe("Test description");
    });

    it("trims whitespace from description", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
        description: "  Test description  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.description).toBe("Test description");
    });

    it("converts empty description to undefined", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
        description: "",
      });
      expect(result.success).toBe(true);
      expect(result.data?.description).toBeUndefined();
    });

    it("converts whitespace-only description to undefined", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
        description: "   ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.description).toBeUndefined();
    });

    it("accepts description with content after trimming", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
        description: "  test description  ",
      });
      expect(result.success).toBe(true);
      expect(result.data?.description).toBe("test description");
    });

    it("accepts undefined description", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
      });
      expect(result.success).toBe(true);
      expect(result.data?.description).toBeUndefined();
    });
  });

  describe("color validation", () => {
    it("accepts valid hex color", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
        color: "#FF0000",
      });
      expect(result.success).toBe(true);
      expect(result.data?.color).toBe("#FF0000");
    });

    it("accepts lowercase hex color", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
        color: "#ff0000",
      });
      expect(result.success).toBe(true);
      expect(result.data?.color).toBe("#ff0000");
    });

    it("rejects invalid hex color", () => {
      const invalidColors = ["#FF00", "#GGG000", "FF0000", "#FF00000", "red"];

      invalidColors.forEach((color) => {
        const result = createCategoryBodySchema.safeParse({
          name: "Test Category",
          slug: "test-category",
          color,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Category color must be a valid hex color (e.g., #FF0000).");
      });
    });

    it("accepts undefined color", () => {
      const result = createCategoryBodySchema.safeParse({
        name: "Test Category",
        slug: "test-category",
      });
      expect(result.success).toBe(true);
      expect(result.data?.color).toBeUndefined();
    });
  });
});

describe("updateCategoryBodySchema", () => {
  it("accepts valid partial update with name", () => {
    const result = updateCategoryBodySchema.safeParse({
      name: "Updated Category",
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Updated Category");
  });

  it("accepts valid partial update with slug", () => {
    const result = updateCategoryBodySchema.safeParse({
      slug: "updated-category",
    });
    expect(result.success).toBe(true);
    expect(result.data?.slug).toBe("updated-category");
  });

  it("accepts valid partial update with description", () => {
    const result = updateCategoryBodySchema.safeParse({
      description: "Updated description",
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe("Updated description");
  });

  it("accepts valid partial update with color", () => {
    const result = updateCategoryBodySchema.safeParse({
      color: "#00FF00",
    });
    expect(result.success).toBe(true);
    expect(result.data?.color).toBe("#00FF00");
  });

  it("accepts null color to remove color", () => {
    const result = updateCategoryBodySchema.safeParse({
      color: null,
    });
    expect(result.success).toBe(true);
    expect(result.data?.color).toBe(null);
  });

  it("accepts multiple fields in update", () => {
    const result = updateCategoryBodySchema.safeParse({
      name: "Updated Category",
      description: "Updated description",
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Updated Category");
    expect(result.data?.description).toBe("Updated description");
  });

  it("rejects empty update object", () => {
    const result = updateCategoryBodySchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("At least one field must be provided for update.");
  });

  it("rejects update with undefined values only", () => {
    const result = updateCategoryBodySchema.safeParse({
      name: undefined,
      slug: undefined,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("At least one field must be provided for update.");
  });
});

describe("categoryIdParamSchema", () => {
  it("accepts valid positive integer id", () => {
    const result = categoryIdParamSchema.safeParse({
      id: "123",
    });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(123);
  });

  it("rejects non-numeric id", () => {
    const result = categoryIdParamSchema.safeParse({
      id: "abc",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Category ID must be a valid positive integer.");
  });

  it("rejects zero id", () => {
    const result = categoryIdParamSchema.safeParse({
      id: "0",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Category ID must be a positive integer.");
  });

  it("rejects negative id", () => {
    const result = categoryIdParamSchema.safeParse({
      id: "-1",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Category ID must be a valid positive integer.");
  });

  it("rejects float id", () => {
    const result = categoryIdParamSchema.safeParse({
      id: "123.45",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Category ID must be a valid positive integer.");
  });

  it("rejects empty id", () => {
    const result = categoryIdParamSchema.safeParse({
      id: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Category ID must be a valid positive integer.");
  });
});
