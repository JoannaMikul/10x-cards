import type { ApiErrorResponse, TagListResponse } from "../../../types";
import type { TagErrorCode } from "../../errors";

export interface TagsApiMock {
  description: string;
  status: number;
  request: {
    method: "GET";
    url: string;
    headers?: Record<string, string>;
  };
  response: TagListResponse | ApiErrorResponse<TagErrorCode>;
}

export const tagsApiMocks: TagsApiMock[] = [
  {
    description: "200 OK – first page without filters",
    status: 200,
    request: {
      method: "GET",
      url: "/api/tags",
    },
    response: {
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
      ],
      page: {
        has_more: true,
        next_cursor: "Mg==",
      },
    },
  },
  {
    description: "200 OK – search and sort with cursor",
    status: 200,
    request: {
      method: "GET",
      url: "/api/tags?search=db&sort=created_at&limit=1&cursor=MQ==",
    },
    response: {
      data: [
        {
          id: 3,
          name: "database",
          slug: "database",
          description: "Relational and non-relational databases",
          created_at: "2025-11-02T12:30:00.000Z",
          updated_at: "2025-11-04T10:00:00.000Z",
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
      url: "/api/tags?cursor=invalid",
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
      url: "/api/tags?limit=20",
    },
    response: {
      error: {
        code: "db_error",
        message: "Failed to query tags from the database.",
        details: {
          code: "XX000",
          message: 'duplicate key value violates unique constraint "tags_pkey"',
        },
      },
    },
  },
];
