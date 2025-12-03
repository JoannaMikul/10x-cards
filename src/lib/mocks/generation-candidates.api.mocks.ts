import { DEFAULT_USER_ID } from "../../db/supabase.client.ts";
import type { CandidateErrorCode } from "../errors.ts";
import type { ApiErrorResponse, GenerationCandidateListResponse } from "../../types";

export interface GenerationCandidatesApiMock {
  description: string;
  status: number;
  request: {
    method: "GET";
    url: string;
    headers?: Record<string, string>;
  };
  response: GenerationCandidateListResponse | ApiErrorResponse<CandidateErrorCode>;
}

export const generationCandidatesApiMocks: GenerationCandidatesApiMock[] = [
  {
    description: "200 OK – first page without filters",
    status: 200,
    request: {
      method: "GET",
      url: "/api/generation-candidates?generation_id=794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
    },
    response: {
      data: [
        {
          id: "c1b38d86-d0a5-4e2d-a70b-02f4b0071b4a",
          generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          owner_id: DEFAULT_USER_ID,
          front: "How does TCP differ from UDP?",
          back: "TCP provides reliable, connection-oriented delivery; UDP is connectionless and offers no delivery guarantees.",
          front_back_fingerprint: "4e6c3cfa05404f5ea266e7f0f86b1a52",
          status: "proposed",
          accepted_card_id: null,
          suggested_category_id: 2,
          suggested_tags: ["networking", "transport-layer"],
          created_at: "2025-12-01T10:00:00.000Z",
          updated_at: "2025-12-01T10:00:00.000Z",
        },
      ],
      page: {
        has_more: true,
        next_cursor: "YzFiMzhkODYtZDBhNS00ZTJkLWE3MGItMDJmNGIwMDcxYjRh",
      },
    },
  },
  {
    description: "200 OK – filtered by statuses and cursor",
    status: 200,
    request: {
      method: "GET",
      url: "/api/generation-candidates?generation_id=794d9f4a-3b8f-482f-a61c-0b4cce9b2f95&status[]=accepted&limit=1&cursor=YzFiMzhkODYtZDBhNS00ZTJkLWE3MGItMDJmNGIwMDcxYjRh",
    },
    response: {
      data: [
        {
          id: "a0b8de45-4c63-4d17-8f9c-7a0ef6a5a9d7",
          generation_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          owner_id: DEFAULT_USER_ID,
          front: "List the main stages of the TCP three-way handshake.",
          back: "SYN → SYN-ACK → ACK.",
          front_back_fingerprint: "c7c5df31f1184b6bb8b57c0f94921666",
          status: "accepted",
          accepted_card_id: 42,
          suggested_category_id: 2,
          suggested_tags: ["networking"],
          created_at: "2025-12-01T10:05:00.000Z",
          updated_at: "2025-12-01T10:10:00.000Z",
        },
      ],
      page: {
        has_more: false,
        next_cursor: null,
      },
    },
  },
  {
    description: "400 Bad Request – invalid cursor",
    status: 400,
    request: {
      method: "GET",
      url: "/api/generation-candidates?generation_id=794d9f4a-3b8f-482f-a61c-0b4cce9b2f95&cursor=invalid",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Cursor must be a valid Base64 string.",
      },
    },
  },
  {
    description: "404 Not Found – generation not found",
    status: 404,
    request: {
      method: "GET",
      url: "/api/generation-candidates?generation_id=2ceba35c-06cf-4af6-9fb2-2e34a59bd02a",
    },
    response: {
      error: {
        code: "not_found",
        message: "Generation could not be found.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure",
    status: 500,
    request: {
      method: "GET",
      url: "/api/generation-candidates?generation_id=794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while fetching generation candidates.",
      },
    },
  },
];
