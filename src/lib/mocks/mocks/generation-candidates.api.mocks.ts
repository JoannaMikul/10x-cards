import type { CandidateAcceptErrorCode, CandidateErrorCode } from "../../errors.ts";
import type {
  ApiErrorResponse,
  FlashcardDTO,
  GenerationCandidateDTO,
  GenerationCandidateListResponse,
} from "../../../types";

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
          owner_id: "user-123",
          front: "How does TCP differ from UDP?",
          back: "TCP provides reliable, connection-oriented delivery; UDP is connectionless and offers no delivery guarantees.",
          front_back_fingerprint: "4e6c3cfa05404f5ea266e7f0f86b1a52",
          status: "proposed",
          accepted_card_id: null,
          suggested_category_id: 2,
          suggested_tags: [2, 5],
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
          owner_id: "user-123",
          front: "List the main stages of the TCP three-way handshake.",
          back: "SYN → SYN-ACK → ACK.",
          front_back_fingerprint: "c7c5df31f1184b6bb8b57c0f94921666",
          status: "accepted",
          accepted_card_id: "f4bb2d7d-2afe-4a98-9f53-7b1e3987c9a1",
          suggested_category_id: 2,
          suggested_tags: [2],
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

export interface AcceptGenerationCandidateApiMock {
  description: string;
  status: number;
  request: {
    method: "POST";
    url: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  response: FlashcardDTO | ApiErrorResponse<CandidateAcceptErrorCode>;
}

export const acceptGenerationCandidateApiMocks: AcceptGenerationCandidateApiMock[] = [
  {
    description: "201 Created – candidate accepted with overrides",
    status: 201,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/accept",
      headers: { "Content-Type": "application/json" },
      body: {
        category_id: 3,
        tag_ids: [2, 5],
        content_source_id: 8,
        origin: "ai-edited",
      },
    },
    response: {
      id: "b5e4a2d9-0a1b-4f2c-8a9d-3c7f1e2b4d6a",
      front: "What is TCP three-way handshake?",
      back: "SYN, SYN-ACK, ACK.",
      origin: "ai-edited",
      metadata: {
        accepted_from_candidate_id: "6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
        generation_id: "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
        candidate_fingerprint: "51b3022f1b8848fd9e430ad5a3dc1a2e",
      },
      category_id: 3,
      content_source_id: 8,
      owner_id: "user-123",
      created_at: "2025-12-03T10:20:00.000Z",
      updated_at: "2025-12-03T10:20:00.000Z",
      deleted_at: null,
      tags: [
        {
          id: 2,
          name: "networking",
          slug: "networking",
          description: "Computer networking fundamentals",
          created_at: "2025-11-30T08:00:00.000Z",
          updated_at: "2025-11-30T08:00:00.000Z",
        },
        {
          id: 5,
          name: "protocols",
          slug: "protocols",
          description: "Network protocol theory",
          created_at: "2025-11-30T08:00:00.000Z",
          updated_at: "2025-11-30T08:00:00.000Z",
        },
      ],
    },
  },
  {
    description: "400 Bad Request – schema validation failure",
    status: 400,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/accept",
      headers: { "Content-Type": "application/json" },
      body: {
        tag_ids: ["invalid"],
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Tag ids must be an array of integers.",
      },
    },
  },
  {
    description: "404 Not Found – candidate missing",
    status: 404,
    request: {
      method: "POST",
      url: "/api/generation-candidates/11111111-2222-3333-4444-555555555555/accept",
    },
    response: {
      error: {
        code: "not_found",
        message: "Generation candidate could not be found.",
      },
    },
  },
  {
    description: "409 Conflict – already accepted",
    status: 409,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/accept",
    },
    response: {
      error: {
        code: "already_accepted",
        message: "The generation candidate has already been accepted.",
      },
    },
  },
  {
    description: "422 Unprocessable Entity – fingerprint conflict",
    status: 422,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/accept",
    },
    response: {
      error: {
        code: "fingerprint_conflict",
        message: "A flashcard with the same content already exists.",
      },
    },
  },
  {
    description: "422 Unprocessable Entity – invalid references",
    status: 422,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/accept",
      headers: { "Content-Type": "application/json" },
      body: { category_id: 9999 },
    },
    response: {
      error: {
        code: "unprocessable_entity",
        message: "Referenced metadata entities are invalid or no longer exist.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure",
    status: 500,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/accept",
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while accepting the generation candidate.",
      },
    },
  },
];

export interface RejectGenerationCandidateApiMock {
  description: string;
  status: number;
  request: {
    method: "POST";
    url: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  response: { candidate: GenerationCandidateDTO } | ApiErrorResponse<CandidateErrorCode>;
}

export const rejectGenerationCandidateApiMocks: RejectGenerationCandidateApiMock[] = [
  {
    description: "200 OK – candidate rejected successfully",
    status: 200,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/reject",
    },
    response: {
      candidate: {
        id: "6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
        generation_id: "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
        owner_id: "user-123",
        front: "What is TCP three-way handshake?",
        back: "SYN → SYN-ACK → ACK.",
        front_back_fingerprint: "51b3022f1b8848fd9e430ad5a3dc1a2e",
        status: "rejected",
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [2],
        created_at: "2025-12-03T10:15:00.000Z",
        updated_at: "2025-12-03T11:00:00.000Z",
      },
    },
  },
  {
    description: "200 OK – idempotent reject on already rejected candidate",
    status: 200,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/reject",
    },
    response: {
      candidate: {
        id: "6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
        generation_id: "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
        owner_id: "user-123",
        front: "What is TCP three-way handshake?",
        back: "SYN → SYN-ACK → ACK.",
        front_back_fingerprint: "51b3022f1b8848fd9e430ad5a3dc1a2e",
        status: "rejected",
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [2],
        created_at: "2025-12-03T10:15:00.000Z",
        updated_at: "2025-12-03T11:00:00.000Z",
      },
    },
  },
  {
    description: "400 Bad Request – invalid candidate id",
    status: 400,
    request: {
      method: "POST",
      url: "/api/generation-candidates/not-a-uuid/reject",
    },
    response: {
      error: {
        code: "invalid_params",
        message: "Candidate id must be a valid UUID.",
      },
    },
  },
  {
    description: "400 Bad Request – body must be empty",
    status: 400,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/reject",
      headers: { "Content-Type": "application/json" },
      body: { reason: "spam" },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Unrecognized key(s) in object: 'reason'",
      },
    },
  },
  {
    description: "404 Not Found – candidate missing or belongs to another user",
    status: 404,
    request: {
      method: "POST",
      url: "/api/generation-candidates/11111111-2222-3333-4444-555555555555/reject",
    },
    response: {
      error: {
        code: "not_found",
        message: "Generation candidate could not be found.",
      },
    },
  },
  {
    description: "409 Conflict – candidate already accepted",
    status: 409,
    request: {
      method: "POST",
      url: "/api/generation-candidates/a0b8de45-4c63-4d17-8f9c-7a0ef6a5a9d7/reject",
    },
    response: {
      error: {
        code: "invalid_transition",
        message: "Accepted generation candidates cannot be rejected.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure",
    status: 500,
    request: {
      method: "POST",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/reject",
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while processing generation candidates.",
      },
    },
  },
];

export interface UpdateGenerationCandidateApiMock {
  description: string;
  status: number;
  request: {
    method: "PATCH";
    url: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  response: { candidate: GenerationCandidateDTO } | ApiErrorResponse<CandidateErrorCode>;
}

export const updateGenerationCandidateApiMocks: UpdateGenerationCandidateApiMock[] = [
  {
    description: "200 OK – front/back updated with implicit status change",
    status: 200,
    request: {
      method: "PATCH",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
      headers: { "Content-Type": "application/json" },
      body: {
        front: "What is TCP three-way handshake?",
        back: "SYN → SYN-ACK → ACK.",
      },
    },
    response: {
      candidate: {
        id: "6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
        generation_id: "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
        owner_id: "user-123",
        front: "What is TCP three-way handshake?",
        back: "SYN → SYN-ACK → ACK.",
        front_back_fingerprint: "51b3022f1b8848fd9e430ad5a3dc1a2e",
        status: "edited",
        accepted_card_id: null,
        suggested_category_id: 1,
        suggested_tags: [2],
        created_at: "2025-12-03T10:15:00.000Z",
        updated_at: "2025-12-03T10:30:00.000Z",
      },
    },
  },
  {
    description: "400 Bad Request – invalid path parameter",
    status: 400,
    request: {
      method: "PATCH",
      url: "/api/generation-candidates/not-a-uuid",
      headers: { "Content-Type": "application/json" },
      body: { front: "Updated front" },
    },
    response: {
      error: {
        code: "invalid_params",
        message: "Candidate id must be a valid UUID.",
      },
    },
  },
  {
    description: "400 Bad Request – empty payload",
    status: 400,
    request: {
      method: "PATCH",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
      headers: { "Content-Type": "application/json" },
      body: {},
    },
    response: {
      error: {
        code: "invalid_body",
        message: "At least one property must be provided to update the candidate.",
      },
    },
  },
  {
    description: "404 Not Found – candidate missing or not editable",
    status: 404,
    request: {
      method: "PATCH",
      url: "/api/generation-candidates/11111111-2222-3333-4444-555555555555",
      headers: { "Content-Type": "application/json" },
      body: { front: "Updated front" },
    },
    response: {
      error: {
        code: "not_found",
        message: "Generation candidate could not be found or cannot be updated.",
      },
    },
  },
  {
    description: "409 Conflict – duplicate candidate fingerprint",
    status: 409,
    request: {
      method: "PATCH",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
      headers: { "Content-Type": "application/json" },
      body: {
        front: "Duplicate content",
        back: "Already existing back",
      },
    },
    response: {
      error: {
        code: "duplicate_candidate",
        message: "A generation candidate with the same front and back already exists.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure",
    status: 500,
    request: {
      method: "PATCH",
      url: "/api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
      headers: { "Content-Type": "application/json" },
      body: { front: "Updated front" },
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while processing generation candidates.",
      },
    },
  },
];
