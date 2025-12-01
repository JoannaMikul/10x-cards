import type { ApiErrorResponse, SourceListResponse } from "../../types";
import type { SourceErrorCode } from "../errors.ts";

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
    description: "200 OK – default listing",
    status: 200,
    request: {
      method: "GET",
      url: "/api/sources",
    },
    response: {
      data: [
        {
          id: 1,
          name: "React – Official Docs",
          slug: "react-official-docs",
          description: "React core documentation at react.dev",
          kind: "documentation",
          url: "https://react.dev/",
          created_at: "2025-11-30T10:00:00.000Z",
          updated_at: "2025-11-30T10:00:00.000Z",
        },
        {
          id: 2,
          name: "Kubernetes Docs",
          slug: "kubernetes-docs",
          description: "Official documentation",
          kind: "url",
          url: "https://kubernetes.io/docs/home/",
          created_at: "2025-11-29T12:00:00.000Z",
          updated_at: "2025-11-29T12:00:00.000Z",
        },
      ],
      page: {
        has_more: true,
        next_cursor: "Mg==",
      },
    },
  },
  {
    description: "200 OK – filtered by kind and search with cursor",
    status: 200,
    request: {
      method: "GET",
      url: "/api/sources?kind=article&search=ai&sort=created_at&limit=1&cursor=MQ==",
    },
    response: {
      data: [
        {
          id: 3,
          name: "Personal Notes",
          slug: "personal-notes",
          description: "Internal study notes",
          kind: "notes",
          url: null,
          created_at: "2025-12-01T08:30:00.000Z",
          updated_at: "2025-12-01T09:00:00.000Z",
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
      url: "/api/sources?cursor=not-base64",
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
      url: "/api/sources?limit=20",
    },
    response: {
      error: {
        code: "db_error",
        message: "Failed to query sources from the database.",
        details: {
          code: "XX000",
          message: 'duplicate key value violates unique constraint "sources_pkey"',
        },
      },
    },
  },
];
