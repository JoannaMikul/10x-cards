import type { GenerationErrorLogListResponse, ApiErrorResponse } from "../../../types";

export interface ErrorLogsApiMock {
  description: string;
  status: number;
  request: {
    method: "GET";
    url: string;
    headers?: Record<string, string>;
  };
  response: GenerationErrorLogListResponse | ApiErrorResponse;
}

export const errorLogsApiMocks: ErrorLogsApiMock[] = [
  {
    description: "200 OK – default listing first page",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors",
    },
    response: {
      data: [
        {
          id: 1,
          user_id: "123e4567-e89b-12d3-a456-426614174000",
          model: "gpt-4",
          error_code: "API_RATE_LIMIT",
          error_message: "Rate limit exceeded for OpenRouter API",
          source_text_hash: "abc123def456",
          source_text_length: 1500,
          created_at: "2025-12-27T10:30:00.000Z",
        },
        {
          id: 2,
          user_id: "123e4567-e89b-12d3-a456-426614174001",
          model: "claude-3-haiku",
          error_code: "API_TIMEOUT",
          error_message: "Request timeout after 30 seconds",
          source_text_hash: "def456ghi789",
          source_text_length: 800,
          created_at: "2025-12-27T09:15:00.000Z",
        },
      ],
      page: {
        has_more: true,
        next_cursor: "MjAyNS0xMi0yN1QxMDozMDowMC4wMDBa",
      },
    },
  },
  {
    description: "200 OK – filtered by user_id",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors?user_id=123e4567-e89b-12d3-a456-426614174000",
    },
    response: {
      data: [
        {
          id: 1,
          user_id: "123e4567-e89b-12d3-a456-426614174000",
          model: "gpt-4",
          error_code: "API_RATE_LIMIT",
          error_message: "Rate limit exceeded for OpenRouter API",
          source_text_hash: "abc123def456",
          source_text_length: 1500,
          created_at: "2025-12-27T10:30:00.000Z",
        },
      ],
      page: {
        has_more: false,
        next_cursor: null,
      },
    },
  },
  {
    description: "200 OK – filtered by model",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors?model=gpt-4",
    },
    response: {
      data: [
        {
          id: 1,
          user_id: "123e4567-e89b-12d3-a456-426614174000",
          model: "gpt-4",
          error_code: "API_RATE_LIMIT",
          error_message: "Rate limit exceeded for OpenRouter API",
          source_text_hash: "abc123def456",
          source_text_length: 1500,
          created_at: "2025-12-27T10:30:00.000Z",
        },
      ],
      page: {
        has_more: false,
        next_cursor: null,
      },
    },
  },
  {
    description: "200 OK – filtered by date range",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors?from=2025-12-27&to=2025-12-27",
    },
    response: {
      data: [
        {
          id: 1,
          user_id: "123e4567-e89b-12d3-a456-426614174000",
          model: "gpt-4",
          error_code: "API_RATE_LIMIT",
          error_message: "Rate limit exceeded for OpenRouter API",
          source_text_hash: "abc123def456",
          source_text_length: 1500,
          created_at: "2025-12-27T10:30:00.000Z",
        },
        {
          id: 2,
          user_id: "123e4567-e89b-12d3-a456-426614174001",
          model: "claude-3-haiku",
          error_code: "API_TIMEOUT",
          error_message: "Request timeout after 30 seconds",
          source_text_hash: "def456ghi789",
          source_text_length: 800,
          created_at: "2025-12-27T09:15:00.000Z",
        },
      ],
      page: {
        has_more: false,
        next_cursor: null,
      },
    },
  },
  {
    description: "200 OK – with cursor pagination",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors?cursor=MjAyNS0xMi0yN1QxMDozMDowMC4wMDBa&limit=1",
    },
    response: {
      data: [
        {
          id: 2,
          user_id: "123e4567-e89b-12d3-a456-426614174001",
          model: "claude-3-haiku",
          error_code: "API_TIMEOUT",
          error_message: "Request timeout after 30 seconds",
          source_text_hash: "def456ghi789",
          source_text_length: 800,
          created_at: "2025-12-27T09:15:00.000Z",
        },
      ],
      page: {
        has_more: false,
        next_cursor: null,
      },
    },
  },
  {
    description: "200 OK – empty results",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors?model=nonexistent-model",
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
    description: "400 Bad Request – invalid user_id format",
    status: 400,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors?user_id=invalid-uuid",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "User ID must be a valid UUID",
      },
    },
  },
  {
    description: "400 Bad Request – invalid date format",
    status: 400,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors?from=2025/12/27",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "From date must be in YYYY-MM-DD format",
      },
    },
  },
  {
    description: "400 Bad Request – invalid limit",
    status: 400,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors?limit=not-a-number",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Limit must be a valid number",
      },
    },
  },
  {
    description: "400 Bad Request – limit too high",
    status: 400,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors?limit=200",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Limit cannot exceed 100",
      },
    },
  },
  {
    description: "401 Unauthorized – missing auth header",
    status: 401,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors",
    },
    response: {
      error: {
        code: "unauthorized",
        message: "Authentication required",
      },
    },
  },
  {
    description: "403 Forbidden – insufficient permissions",
    status: 403,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors",
      headers: {
        Authorization: "Bearer user-token",
      },
    },
    response: {
      error: {
        code: "forbidden",
        message: "Admin privileges required",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure",
    status: 500,
    request: {
      method: "GET",
      url: "/api/admin/generation-errors",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "Failed to query generation error logs from database",
      },
    },
  },
];
