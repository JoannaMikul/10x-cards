import type { CategoryErrorCode } from "../errors.ts";
import type { ApiErrorResponse, CategoryListResponse } from "../../types";

export interface CategoriesApiMock {
  description: string;
  status: number;
  request: {
    method: "GET";
    url: string;
    headers?: Record<string, string>;
  };
  response: CategoryListResponse | ApiErrorResponse<CategoryErrorCode>;
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
];
