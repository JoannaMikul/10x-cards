import type { ApiErrorResponse, ReviewStatsListResponse } from "../../types";
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

export interface ReviewStatsApiMock {
  description: string;
  status: number;
  request: {
    method: "GET";
    url: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  };
  response: ReviewStatsListResponse | ApiErrorResponse<ReviewErrorCode> | null;
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

// Review Events API Mocks

export interface ReviewEventsApiMock {
  description: string;
  status: number;
  request: {
    method: "GET";
    url: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  };
  response:
    | { data: unknown[]; page: { next_cursor: string | null; has_more: boolean } }
    | ApiErrorResponse<ReviewErrorCode>
    | null;
}

const baseReviewEvent = {
  id: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  card_id: "13f3fc0d-8236-4d36-a0b2-6b97a8e0f999",
  user_id: "user-123",
  outcome: "good" as const,
  payload: { deck: "networking" },
  prev_interval_days: 3,
  next_interval_days: 5,
  response_time_ms: 2500,
  reviewed_at: "2025-12-27T09:00:00.000Z",
  was_learning_step: false,
};

export const reviewEventsApiMocks: ReviewEventsApiMock[] = [
  {
    description: "200 OK – successful review events list",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
    },
    response: {
      data: [
        baseReviewEvent,
        {
          ...baseReviewEvent,
          id: "b2c3d4e5-6789-01bc-def0-1234567890bc",
          outcome: "easy",
          reviewed_at: "2025-12-27T08:45:00.000Z",
        },
      ],
      page: {
        next_cursor: null,
        has_more: false,
      },
    },
  },
  {
    description: "200 OK – review events with card filter",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        card_id: "13f3fc0d-8236-4d36-a0b2-6b97a8e0f999",
      },
    },
    response: {
      data: [baseReviewEvent],
      page: {
        next_cursor: null,
        has_more: false,
      },
    },
  },
  {
    description: "200 OK – review events with date range",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        from: "2025-12-27T00:00:00.000Z",
        to: "2025-12-27T23:59:59.999Z",
      },
    },
    response: {
      data: [baseReviewEvent],
      page: {
        next_cursor: null,
        has_more: false,
      },
    },
  },
  {
    description: "200 OK – review events with limit",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        limit: "5",
      },
    },
    response: {
      data: [baseReviewEvent],
      page: {
        next_cursor: "2025-12-27T09:00:00.000Z",
        has_more: true,
      },
    },
  },
  {
    description: "200 OK – review events with pagination",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        cursor: "2025-12-27T09:00:00.000Z",
        limit: "10",
      },
    },
    response: {
      data: [
        {
          ...baseReviewEvent,
          id: "c3d4e5f6-7890-12cd-ef01-234567890cde",
          reviewed_at: "2025-12-27T08:30:00.000Z",
        },
      ],
      page: {
        next_cursor: null,
        has_more: false,
      },
    },
  },
  {
    description: "200 OK – empty results",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        card_id: "99999999-9999-9999-9999-999999999999", // non-existent card
      },
    },
    response: {
      data: [],
      page: {
        next_cursor: null,
        has_more: false,
      },
    },
  },
  {
    description: "400 Bad Request – invalid card_id UUID",
    status: 400,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        card_id: "invalid-uuid",
      },
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Card ID must be a valid UUID.",
      },
    },
  },
  {
    description: "400 Bad Request – invalid date format",
    status: 400,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        from: "invalid-date",
      },
    },
    response: {
      error: {
        code: "invalid_query",
        message: "From date must be a valid ISO date string.",
      },
    },
  },
  {
    description: "400 Bad Request – invalid limit",
    status: 400,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        limit: "200", // exceeds max 100
      },
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Limit cannot exceed 100.",
      },
    },
  },
  {
    description: "401 Unauthorized – missing authentication",
    status: 401,
    request: {
      method: "GET",
      url: "/api/review-events",
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authenticated.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database error",
    status: 500,
    request: {
      method: "GET",
      url: "/api/review-events",
      headers: {
        Authorization: "Bearer <jwt>",
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while processing the review session.",
      },
    },
  },
];

// Review Stats API Mocks
const baseReviewStatsResponse: ReviewStatsListResponse = {
  data: [
    {
      card_id: "13f3fc0d-8236-4d36-a0b2-6b97a8e0f999",
      user_id: "user-123",
      total_reviews: 15,
      successes: 12,
      consecutive_successes: 3,
      last_outcome: "good",
      last_interval_days: 5,
      next_review_at: "2025-12-28T10:00:00.000Z",
      last_reviewed_at: "2025-12-27T09:30:00.000Z",
      aggregates: {
        average_interval: 3.5,
        success_rate: 0.8,
        current_streak: 3,
      },
    },
    {
      card_id: "24e4fd1e-9247-4e47-b1c3-7c98b9f1g000",
      user_id: "user-123",
      total_reviews: 8,
      successes: 6,
      consecutive_successes: 2,
      last_outcome: "easy",
      last_interval_days: 12,
      next_review_at: "2026-01-02T14:00:00.000Z",
      last_reviewed_at: "2025-12-27T09:35:00.000Z",
      aggregates: {
        average_interval: 4.2,
        success_rate: 0.75,
        current_streak: 2,
      },
    },
  ],
  page: {
    next_cursor: "2025-12-28T10:00:00.000Z",
    has_more: true,
  },
};

const reviewStatsResponseWithCursor: ReviewStatsListResponse = {
  data: [
    {
      card_id: "35f5fe2f-a258-5f58-c2d4-8da9c2g2h111",
      user_id: "user-123",
      total_reviews: 22,
      successes: 18,
      consecutive_successes: 5,
      last_outcome: "easy",
      last_interval_days: 8,
      next_review_at: "2025-12-30T11:00:00.000Z",
      last_reviewed_at: "2025-12-27T10:00:00.000Z",
      aggregates: {
        average_interval: 6.1,
        success_rate: 0.82,
        current_streak: 5,
      },
    },
  ],
  page: {
    next_cursor: null,
    has_more: false,
  },
};

export const reviewStatsApiMocks: ReviewStatsApiMock[] = [
  {
    description: "200 OK – successful review stats fetch with default pagination",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
    },
    response: baseReviewStatsResponse,
  },
  {
    description: "200 OK – review stats filtered by card_id",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        card_id: "13f3fc0d-8236-4d36-a0b2-6b97a8e0f999",
      },
    },
    response: {
      data: [baseReviewStatsResponse.data[0]],
      page: {
        next_cursor: null,
        has_more: false,
      },
    },
  },
  {
    description: "200 OK – review stats with custom limit",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        limit: "5",
      },
    },
    response: baseReviewStatsResponse,
  },
  {
    description: "200 OK – review stats with cursor pagination",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        cursor: "2025-12-28T10:00:00.000Z",
      },
    },
    response: reviewStatsResponseWithCursor,
  },
  {
    description: "200 OK – review stats filtered by next_review_before",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        next_review_before: "2025-12-30T00:00:00.000Z",
      },
    },
    response: baseReviewStatsResponse,
  },
  {
    description: "200 OK – empty review stats response",
    status: 200,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
    },
    response: {
      data: [],
      page: {
        next_cursor: null,
        has_more: false,
      },
    },
  },
  {
    description: "400 Bad Request – invalid card_id format",
    status: 400,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        card_id: "invalid-uuid",
      },
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Card ID must be a valid UUID.",
      },
    },
  },
  {
    description: "400 Bad Request – invalid next_review_before date",
    status: 400,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        next_review_before: "invalid-date",
      },
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Next review before must be a valid ISO date string.",
      },
    },
  },
  {
    description: "400 Bad Request – limit too high",
    status: 400,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
      query: {
        limit: "150",
      },
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Limit cannot exceed 100.",
      },
    },
  },
  {
    description: "401 Unauthorized – missing authentication",
    status: 401,
    request: {
      method: "GET",
      url: "/api/review-stats",
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authenticated.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database error",
    status: 500,
    request: {
      method: "GET",
      url: "/api/review-stats",
      headers: {
        Authorization: "Bearer <jwt>",
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while processing the review session.",
      },
    },
  },
];
