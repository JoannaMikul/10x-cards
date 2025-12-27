import type { CategoryErrorCode } from "../errors.ts";
import type { ApiErrorResponse, CategoryDTO, CategoryListResponse, CreateCategoryCommand } from "../../types";

export interface CategoriesApiMock {
  description: string;
  status: number;
  request: {
    method: "GET" | "POST";
    url: string;
    headers?: Record<string, string>;
    body?: CreateCategoryCommand;
  };
  response: CategoryListResponse | CategoryDTO | ApiErrorResponse<CategoryErrorCode>;
}

export const categoriesApiMocks: CategoriesApiMock[] = [
  {
    description: "200 OK – default listing first page",
    status: 200,
    request: {
      method: "GET",
      url: "/api/categories",
    },
    response: {
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
        {
          id: 2,
          name: "Networking",
          slug: "networking",
          description: "OSI, routing, protocols",
          color: "#2563EB",
          created_at: "2025-10-30T10:00:00.000Z",
          updated_at: "2025-11-01T11:00:00.000Z",
        },
      ],
      page: {
        has_more: true,
        next_cursor: "Mg==",
      },
    },
  },
  {
    description: "200 OK – filtered by search & sort with cursor",
    status: 200,
    request: {
      method: "GET",
      url: "/api/categories?search=db&sort=created_at&limit=1&cursor=MQ==",
    },
    response: {
      data: [
        {
          id: 3,
          name: "Databases",
          slug: "databases",
          description: "SQL, NoSQL, tuning",
          color: "#059669",
          created_at: "2025-11-02T08:15:00.000Z",
          updated_at: "2025-11-05T12:00:00.000Z",
        },
      ],
      page: {
        has_more: false,
        next_cursor: null,
      },
    },
  },
  {
    description: "400 Bad Request – malformed cursor",
    status: 400,
    request: {
      method: "GET",
      url: "/api/categories?cursor=not-base64",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Cursor must be a valid Base64 string.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure",
    status: 500,
    request: {
      method: "GET",
      url: "/api/categories?limit=20",
    },
    response: {
      error: {
        code: "db_error",
        message: "Failed to query categories from the database.",
        details: {
          code: "XX000",
          message: 'duplicate key value violates unique constraint "categories_pkey"',
        },
      },
    },
  },
  {
    description: "201 Created – successful category creation",
    status: 201,
    request: {
      method: "POST",
      url: "/api/categories",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: {
        name: "System Design",
        slug: "system-design",
        description: "Distributed systems and architecture patterns",
        color: "#10B981",
      },
    },
    response: {
      id: 4,
      name: "System Design",
      slug: "system-design",
      description: "Distributed systems and architecture patterns",
      color: "#10B981",
      created_at: "2025-12-27T12:00:00.000Z",
      updated_at: "2025-12-27T12:00:00.000Z",
    },
  },
  {
    description: "400 Bad Request – invalid body (empty name)",
    status: 400,
    request: {
      method: "POST",
      url: "/api/categories",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: {
        name: "",
        slug: "invalid-slug",
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Request body validation failed.",
        details: {
          issues: [
            {
              message: "Category name cannot be empty.",
              path: ["name"],
            },
          ],
        },
      },
    },
  },
  {
    description: "400 Bad Request – invalid slug format",
    status: 400,
    request: {
      method: "POST",
      url: "/api/categories",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: {
        name: "Test Category",
        slug: "Invalid Slug With Spaces",
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Request body validation failed.",
        details: {
          issues: [
            {
              message: "Category slug must contain only lowercase letters, numbers, and hyphens.",
              path: ["slug"],
            },
          ],
        },
      },
    },
  },
  {
    description: "400 Bad Request – invalid color format",
    status: 400,
    request: {
      method: "POST",
      url: "/api/categories",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: {
        name: "Test Category",
        slug: "test-category",
        color: "#ZZZ",
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Request body validation failed.",
        details: {
          issues: [
            {
              message: "Category color must be a valid hex color (e.g., #FF0000).",
              path: ["color"],
            },
          ],
        },
      },
    },
  },
  {
    description: "401 Unauthorized – user not authenticated",
    status: 401,
    request: {
      method: "POST",
      url: "/api/categories",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        name: "Test Category",
        slug: "test-category",
      },
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authenticated.",
      },
    },
  },
  {
    description: "403 Forbidden – user not admin",
    status: 403,
    request: {
      method: "POST",
      url: "/api/categories",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer regular-user-token",
      },
      body: {
        name: "Test Category",
        slug: "test-category",
      },
    },
    response: {
      error: {
        code: "forbidden",
        message: "Admin privileges required.",
      },
    },
  },
  {
    description: "409 Conflict – slug already taken",
    status: 409,
    request: {
      method: "POST",
      url: "/api/categories",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: {
        name: "Duplicate Category",
        slug: "networking", // This slug already exists from GET mock
      },
    },
    response: {
      error: {
        code: "slug_taken",
        message: "A category with this slug already exists.",
      },
    },
  },
  {
    description: "409 Conflict – name already taken",
    status: 409,
    request: {
      method: "POST",
      url: "/api/categories",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: {
        name: "Networking", // This name already exists from GET mock
        slug: "networking-new",
      },
    },
    response: {
      error: {
        code: "name_taken",
        message: "A category with this name already exists.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database error during creation",
    status: 500,
    request: {
      method: "POST",
      url: "/api/categories",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: {
        name: "Database Error Test",
        slug: "db-error-test",
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while creating the category.",
      },
    },
  },
];
