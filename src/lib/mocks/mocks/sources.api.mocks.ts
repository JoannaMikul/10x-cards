import type { ApiErrorResponse, SourceListResponse } from "../../../types";
import type { SourceErrorCode } from "../../errors";

export interface SourcesApiMock {
  description: string;
  status: number;
  request: {
    method: "GET";
    url: string;
    headers?: Record<string, string>;
  };
  response: SourceListResponse | ApiErrorResponse<SourceErrorCode>;
}

export const sourcesApiMocks: SourcesApiMock[] = [
  {
    description: "200 OK – first page without filters",
    status: 200,
    request: {
      method: "GET",
      url: "/api/sources",
    },
    response: {
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
      ],
      page: {
        has_more: true,
        next_cursor: "Mg==",
      },
    },
  },
  {
    description: "200 OK – search with kind filter",
    status: 200,
    request: {
      method: "GET",
      url: "/api/sources?search=kubernetes&kind=book&limit=10",
    },
    response: {
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
      page: {
        has_more: false,
        next_cursor: null,
      },
    },
  },
  {
    description: "200 OK – pagination with cursor",
    status: 200,
    request: {
      method: "GET",
      url: "/api/sources?cursor=Mg==&limit=5",
    },
    response: {
      data: [
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
        {
          id: 4,
          name: "TypeScript Handbook",
          slug: "typescript-handbook",
          description: "Official TypeScript documentation",
          kind: "documentation",
          url: "https://www.typescriptlang.org/docs/",
          created_at: "2025-11-02T11:00:00.000Z",
          updated_at: "2025-11-02T11:00:00.000Z",
        },
      ],
      page: {
        has_more: false,
        next_cursor: null,
      },
    },
  },
  {
    description: "200 OK – search with no results",
    status: 200,
    request: {
      method: "GET",
      url: "/api/sources?search=nonexistent",
    },
    response: {
      data: [],
      page: {
        has_more: false,
        next_cursor: null,
      },
    },
  },
  {
    description: "400 Bad Request – invalid limit",
    status: 400,
    request: {
      method: "GET",
      url: "/api/sources?limit=0",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Limit must be at least 1.",
      },
    },
  },
  {
    description: "400 Bad Request – invalid cursor",
    status: 400,
    request: {
      method: "GET",
      url: "/api/sources?cursor=invalid",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Cursor must be a valid Base64 string.",
      },
    },
  },
  {
    description: "400 Bad Request – invalid sort field",
    status: 400,
    request: {
      method: "GET",
      url: "/api/sources?sort=invalid",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Sort must be one of: name, created_at.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure",
    status: 500,
    request: {
      method: "GET",
      url: "/api/sources?limit=20",
    },
    response: {
      error: {
        code: "db_error",
        message: "Failed to query sources from the database.",
        details: {
          code: "XX000",
          message: 'connection to server at "localhost" (::1), port 5432 failed: Connection refused',
        },
      },
    },
  },
];
