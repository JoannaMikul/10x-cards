import type { ApiErrorResponse, CreateGenerationCommand } from "../../types";
import type { GenerationErrorCode } from "../errors";

interface StartGenerationAcceptedMock {
  id: string;
  status: "pending";
  enqueued_at: string;
}

export interface GenerationApiMock {
  description: string;
  status: number;
  request: {
    headers?: Record<string, string>;
    body: Partial<CreateGenerationCommand> | Record<string, unknown>;
  };
  response: StartGenerationAcceptedMock | ApiErrorResponse<GenerationErrorCode>;
}

const VALID_INPUT_TEXT = "x".repeat(1000);

export const generationApiMocks: GenerationApiMock[] = [
  {
    description: "202 Accepted – generation enqueued (dev fallback user)",
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
];
