import type { ApiErrorResponse, CreateReviewSessionCommand } from "../../../types";
import type { REVIEW_ERROR_CODES } from "../../errors";

export interface ReviewSessionsApiMock {
  description: string;
  status: number;
  request: {
    method: "POST";
    url: string;
    headers?: Record<string, string>;
    body?: CreateReviewSessionCommand | Record<string, unknown>;
  };
  response: { logged: number } | ApiErrorResponse<(typeof REVIEW_ERROR_CODES)[keyof typeof REVIEW_ERROR_CODES]>;
}

export const reviewSessionsApiMocks: ReviewSessionsApiMock[] = [
  {
    description: "201 Created - successful review session with multiple cards",
    status: 201,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        session_id: "550e8400-e29b-41d4-a716-446655440000",
        started_at: "2025-12-30T10:00:00.000Z",
        completed_at: "2025-12-30T10:05:30.000Z",
        reviews: [
          {
            card_id: "550e8400-e29b-41d4-a716-446655440001",
            outcome: "good",
            response_time_ms: 1500,
            prev_interval_days: 1,
            was_learning_step: false,
            payload: { ease: 3 },
          },
          {
            card_id: "550e8400-e29b-41d4-a716-446655440002",
            outcome: "easy",
            response_time_ms: 800,
            prev_interval_days: 3,
            was_learning_step: false,
            payload: { ease: 4 },
          },
        ],
      },
    },
    response: {
      logged: 2,
    },
  },
  {
    description: "201 Created - single card review session",
    status: 201,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        session_id: "550e8400-e29b-41d4-a716-446655440003",
        started_at: "2025-12-30T11:00:00.000Z",
        completed_at: "2025-12-30T11:01:15.000Z",
        reviews: [
          {
            card_id: "550e8400-e29b-41d4-a716-446655440004",
            outcome: "fail",
            response_time_ms: 2000,
            prev_interval_days: 7,
            was_learning_step: false,
            payload: { ease: 1 },
          },
        ],
      },
    },
    response: {
      logged: 1,
    },
  },
  {
    description: "400 Bad Request - invalid request body",
    status: 400,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        invalid_field: "invalid_value",
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Request body is invalid.",
      },
    },
  },
  {
    description: "404 Not Found - card not found or not owned by user",
    status: 404,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        session_id: "550e8400-e29b-41d4-a716-446655440005",
        started_at: "2025-12-30T12:00:00.000Z",
        completed_at: "2025-12-30T12:02:00.000Z",
        reviews: [
          {
            card_id: "550e8400-e29b-41d4-a716-446655440999",
            outcome: "good",
            response_time_ms: 1200,
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
    description: "401 Unauthorized - user not authenticated",
    status: 401,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        session_id: "550e8400-e29b-41d4-a716-446655440006",
        started_at: "2025-12-30T13:00:00.000Z",
        completed_at: "2025-12-30T13:01:30.000Z",
        reviews: [
          {
            card_id: "550e8400-e29b-41d4-a716-446655440007",
            outcome: "good",
          },
        ],
      },
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authenticated.",
      },
    },
  },
  {
    description: "201 Created - empty review session",
    status: 201,
    request: {
      method: "POST",
      url: "/api/review-sessions",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        session_id: "550e8400-e29b-41d4-a716-446655440008",
        started_at: "2025-12-30T14:00:00.000Z",
        completed_at: "2025-12-30T14:00:00.000Z",
        reviews: [],
      },
    },
    response: {
      logged: 0,
    },
  },
];
