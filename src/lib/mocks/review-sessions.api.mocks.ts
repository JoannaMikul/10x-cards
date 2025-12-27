import type { ApiErrorResponse } from "../../types";
import type { ReviewErrorCode } from "../errors.ts";

export interface ReviewSessionsApiMock {
  description: string;
  status: number;
  request: {
    method: "POST";
    url: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  response: { logged: number } | ApiErrorResponse<ReviewErrorCode> | null;
}

const baseReviewSessionRequest = {
  session_id: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  started_at: "2025-12-27T09:00:00.000Z",
  completed_at: "2025-12-27T09:15:00.000Z",
  reviews: [
    {
      card_id: "13f3fc0d-8236-4d36-a0b2-6b97a8e0f999",
      outcome: "good" as const,
      grade: 3,
      response_time_ms: 2500,
      prev_interval_days: 3,
      next_interval_days: 5,
      was_learning_step: false,
      payload: { deck: "networking" },
    },
    {
      card_id: "24e4fd1e-9247-4e47-b1c3-7c98b9f1g000",
      outcome: "easy" as const,
      grade: 4,
      response_time_ms: 1800,
      prev_interval_days: 5,
      next_interval_days: 12,
      was_learning_step: false,
      payload: { deck: "networking" },
    },
  ],
};

export const reviewSessionsApiMocks: ReviewSessionsApiMock[] = [
  {
    description: "201 Created – successful batch review session",
    status: 201,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: baseReviewSessionRequest,
    },
    response: { logged: 2 },
  },
  {
    description: "400 Bad Request – invalid body (missing required field)",
    status: 400,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        session_id: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
        started_at: "2025-12-27T09:00:00.000Z",
        // missing completed_at
        reviews: [],
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Completed at must be a valid ISO date string.",
      },
    },
  },
  {
    description: "400 Bad Request – invalid grade range",
    status: 400,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        ...baseReviewSessionRequest,
        reviews: [
          {
            card_id: "13f3fc0d-8236-4d36-a0b2-6b97a8e0f999",
            outcome: "good",
            grade: 6, // invalid: must be 0-5
            response_time_ms: 2500,
          },
        ],
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Grade must be at most 5.",
      },
    },
  },
  {
    description: "400 Bad Request – invalid outcome enum",
    status: 400,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        ...baseReviewSessionRequest,
        reviews: [
          {
            card_id: "13f3fc0d-8236-4d36-a0b2-6b97a8e0f999",
            outcome: "invalid_outcome", // invalid enum value
            grade: 3,
          },
        ],
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Outcome must be one of: fail, hard, good, easy, again.",
      },
    },
  },
  {
    description: "401 Unauthorized – missing authentication",
    status: 401,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        "Content-Type": "application/json",
      },
      body: baseReviewSessionRequest,
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authenticated.",
      },
    },
  },
  {
    description: "404 Not Found – card not found or not owned by user",
    status: 404,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        session_id: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
        started_at: "2025-12-27T09:00:00.000Z",
        completed_at: "2025-12-27T09:15:00.000Z",
        reviews: [
          {
            card_id: "99999999-9999-9999-9999-999999999999", // non-existent card
            outcome: "good",
            grade: 3,
          },
        ],
      },
    },
    response: {
      error: {
        code: "card_not_found",
        message: "One or more cards not found or not owned by user.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database error",
    status: 500,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: baseReviewSessionRequest,
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while processing the review session.",
      },
    },
  },
];
