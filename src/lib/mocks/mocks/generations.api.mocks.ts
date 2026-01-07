import type { Enums } from "../../../db/database.types";
import type { ApiErrorResponse, CreateGenerationCommand } from "../../../types";
import type { GenerationErrorCode } from "../../errors";

type HttpMethod = "GET" | "POST" | "PATCH";
type CandidateStatusKey = Enums<"candidate_status">;

interface StartGenerationAcceptedMock {
  id: string;
  status: "pending";
  enqueued_at: string;
}

interface GenerationDetailMock {
  generation: {
    id: string;
    model: string;
    status: string;
    temperature: number | null;
    prompt_tokens: number | null;
    sanitized_input_length: number;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    error_code: string | null;
    error_message: string | null;
  };
  candidates_summary: {
    total: number;
    by_status: Record<CandidateStatusKey, number>;
  };
}

interface UpdateGenerationMock {
  generation: {
    id: string;
    status: "cancelled";
    completed_at: string;
    updated_at: string;
  };
}

interface GenerationApiMockRequest {
  headers?: Record<string, string>;
  body?: Partial<CreateGenerationCommand> | Record<string, unknown>;
  params?: Record<string, string>;
}

export interface GenerationApiMock {
  description: string;
  method: HttpMethod;
  path: string;
  status: number;
  request?: GenerationApiMockRequest;
  response:
    | StartGenerationAcceptedMock
    | GenerationDetailMock
    | UpdateGenerationMock
    | ApiErrorResponse<GenerationErrorCode>;
}

const VALID_INPUT_TEXT = "x".repeat(1000);
const SAMPLE_GENERATION_ID = "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac";

export const generationApiMocks: GenerationApiMock[] = [
  {
    description: "202 Accepted – generation enqueued (dev fallback user)",
    method: "POST",
    path: "/api/generations",
    status: 202,
    request: {
      headers: { "Content-Type": "application/json" },
      body: {
        model: "openrouter/gpt-4.1-mini",
        sanitized_input_text: VALID_INPUT_TEXT,
        temperature: 0.7,
      },
    },
    response: {
      id: "e8d7f06a-f1e4-4db0-b139-f60f6ac73a55",
      status: "pending",
      enqueued_at: "2025-11-30T12:34:56.000Z",
    },
  },
  {
    description: "400 Bad Request – invalid payload shape",
    method: "POST",
    path: "/api/generations",
    status: 400,
    request: {
      headers: { "Content-Type": "application/json" },
      body: {
        model: "",
        sanitized_input_text: "too short",
      },
    },
    response: {
      error: {
        code: "invalid_payload",
        message: "sanitized_input_text must be at least 1000 characters long; Model cannot be empty",
      },
    },
  },
  {
    description: "409 Conflict – user already has an active generation",
    method: "POST",
    path: "/api/generations",
    status: 409,
    request: {
      headers: { "Content-Type": "application/json" },
      body: {
        model: "openrouter/gpt-4.1-mini",
        sanitized_input_text: VALID_INPUT_TEXT,
      },
    },
    response: {
      error: {
        code: "active_request_exists",
        message: "An active generation request is already in progress.",
      },
    },
  },
  {
    description: "429 Too Many Requests – hourly quota reached",
    method: "POST",
    path: "/api/generations",
    status: 429,
    request: {
      headers: { "Content-Type": "application/json" },
      body: {
        model: "openrouter/gpt-4.1-mini",
        sanitized_input_text: VALID_INPUT_TEXT,
      },
    },
    response: {
      error: {
        code: "hourly_quota_reached",
        message: "Hourly generation limit (5 requests) has been exceeded.",
      },
    },
  },
  {
    description: "500 Internal Server Error – unexpected failure",
    method: "POST",
    path: "/api/generations",
    status: 500,
    request: {
      headers: { "Content-Type": "application/json" },
      body: {
        model: "openrouter/gpt-4.1-mini",
        sanitized_input_text: VALID_INPUT_TEXT,
      },
    },
    response: {
      error: {
        code: "unexpected_error",
        message: "Unexpected error while starting the generation.",
      },
    },
  },
  {
    description: "200 OK – generation status summary with candidates split",
    method: "GET",
    path: `/api/generations/${SAMPLE_GENERATION_ID}`,
    status: 200,
    request: {
      headers: { Accept: "application/json" },
      params: { id: SAMPLE_GENERATION_ID },
    },
    response: {
      generation: {
        id: SAMPLE_GENERATION_ID,
        model: "openrouter/gpt-4.1-mini",
        status: "running",
        temperature: 0.7,
        prompt_tokens: 1280,
        sanitized_input_length: 5600,
        started_at: "2025-12-01T12:00:00.000Z",
        completed_at: null,
        created_at: "2025-12-01T11:58:00.000Z",
        updated_at: "2025-12-01T12:00:30.000Z",
        error_code: null,
        error_message: null,
      },
      candidates_summary: {
        total: 8,
        by_status: {
          proposed: 6,
          edited: 1,
          accepted: 1,
          rejected: 0,
        },
      },
    },
  },
  {
    description: "400 Bad Request – malformed generation id",
    method: "GET",
    path: "/api/generations/not-a-uuid",
    status: 400,
    request: {
      headers: { Accept: "application/json" },
      params: { id: "not-a-uuid" },
    },
    response: {
      error: {
        code: "invalid_params",
        message: "Invalid generation id",
      },
    },
  },
  {
    description: "404 Not Found – generation does not belong to user",
    method: "GET",
    path: `/api/generations/${SAMPLE_GENERATION_ID}`,
    status: 404,
    request: {
      headers: { Accept: "application/json" },
      params: { id: SAMPLE_GENERATION_ID },
    },
    response: {
      error: {
        code: "generation_not_found",
        message: "Generation could not be found.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure while reading generation",
    method: "GET",
    path: `/api/generations/${SAMPLE_GENERATION_ID}`,
    status: 500,
    request: {
      headers: { Accept: "application/json" },
      params: { id: SAMPLE_GENERATION_ID },
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while retrieving the generation.",
      },
    },
  },
  {
    description: "200 OK – generation successfully cancelled",
    method: "PATCH",
    path: `/api/generations/${SAMPLE_GENERATION_ID}`,
    status: 200,
    request: {
      headers: { "Content-Type": "application/json" },
      params: { id: SAMPLE_GENERATION_ID },
      body: { status: "cancelled" },
    },
    response: {
      generation: {
        id: SAMPLE_GENERATION_ID,
        status: "cancelled",
        completed_at: "2025-12-01T12:05:30.000Z",
        updated_at: "2025-12-01T12:05:30.000Z",
      },
    },
  },
  {
    description: "400 Bad Request – malformed generation id",
    method: "PATCH",
    path: "/api/generations/not-a-uuid",
    status: 400,
    request: {
      headers: { "Content-Type": "application/json" },
      params: { id: "not-a-uuid" },
      body: { status: "cancelled" },
    },
    response: {
      error: {
        code: "invalid_params",
        message: "Invalid generation id",
      },
    },
  },
  {
    description: "400 Bad Request – invalid request body",
    method: "PATCH",
    path: `/api/generations/${SAMPLE_GENERATION_ID}`,
    status: 400,
    request: {
      headers: { "Content-Type": "application/json" },
      params: { id: SAMPLE_GENERATION_ID },
      body: { status: "invalid" },
    },
    response: {
      error: {
        code: "invalid_payload",
        message: "Status must be 'cancelled'",
      },
    },
  },
  {
    description: "404 Not Found – generation does not exist or belongs to different user",
    method: "PATCH",
    path: `/api/generations/${SAMPLE_GENERATION_ID}`,
    status: 404,
    request: {
      headers: { "Content-Type": "application/json" },
      params: { id: SAMPLE_GENERATION_ID },
      body: { status: "cancelled" },
    },
    response: {
      error: {
        code: "generation_not_found",
        message: "Generation could not be found.",
      },
    },
  },
  {
    description: "409 Conflict – generation cannot be cancelled as it is not in active state",
    method: "PATCH",
    path: `/api/generations/${SAMPLE_GENERATION_ID}`,
    status: 409,
    request: {
      headers: { "Content-Type": "application/json" },
      params: { id: SAMPLE_GENERATION_ID },
      body: { status: "cancelled" },
    },
    response: {
      error: {
        code: "invalid_transition",
        message: "Generation cannot be cancelled as it is not in an active state.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure during cancellation",
    method: "PATCH",
    path: `/api/generations/${SAMPLE_GENERATION_ID}`,
    status: 500,
    request: {
      headers: { "Content-Type": "application/json" },
      params: { id: SAMPLE_GENERATION_ID },
      body: { status: "cancelled" },
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while cancelling the generation.",
      },
    },
  },
];
