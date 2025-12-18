import type { ApiErrorResponse, FlashcardDTO, FlashcardListResponse } from "../../types";
import type { FlashcardErrorCode } from "../errors.ts";

export interface FlashcardsApiMock {
  description: string;
  status: number;
  request: {
    method: "GET" | "POST";
    url: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  response: FlashcardDTO | FlashcardListResponse | ApiErrorResponse<FlashcardErrorCode>;
}

const baseCard: FlashcardDTO = {
  id: "13f3fc0d-8236-4d36-a0b2-6b97a8e0f999",
  front: "Explain TCP handshake",
  back: "SYN -> SYN/ACK -> ACK completes the three-way handshake.",
  origin: "manual",
  metadata: { language: "PL" },
  category_id: 1,
  content_source_id: 5,
  owner_id: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  created_at: "2025-12-02T10:00:00.000Z",
  updated_at: "2025-12-02T10:00:00.000Z",
  deleted_at: null,
  tags: [
    {
      id: 3,
      name: "Networking",
      slug: "networking",
      description: "OSI, TCP/IP and related topics.",
      created_at: "2025-11-28T12:00:00.000Z",
      updated_at: "2025-11-28T12:00:00.000Z",
    },
  ],
};

export const flashcardsApiMocks: FlashcardsApiMock[] = [
  {
    description: "201 Created – manual card with metadata and tags",
    status: 201,
    request: {
      method: "POST",
      url: "/api/flashcards",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        front: baseCard.front,
        back: baseCard.back,
        category_id: 1,
        content_source_id: 5,
        tag_ids: [3],
        origin: "manual",
        metadata: { language: "PL" },
      },
    },
    response: baseCard,
  },
  {
    description: "400 Bad Request – schema validation error",
    status: 400,
    request: {
      method: "POST",
      url: "/api/flashcards",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        front: "",
        back: "Answer",
        origin: "manual",
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Front text cannot be empty.",
      },
    },
  },
  {
    description: "401 Unauthorized – missing bearer token",
    status: 401,
    request: {
      method: "POST",
      url: "/api/flashcards",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        front: baseCard.front,
        back: baseCard.back,
        origin: "manual",
      },
    },
    response: {
      error: {
        code: "unauthorized",
        message: "Authorization header is required.",
      },
    },
  },
  {
    description: "404 Not Found – category missing",
    status: 404,
    request: {
      method: "POST",
      url: "/api/flashcards",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        front: baseCard.front,
        back: baseCard.back,
        category_id: 999,
        origin: "manual",
      },
    },
    response: {
      error: {
        code: "category_not_found",
        message: "Category 999 does not exist.",
        details: { category_id: 999 },
      },
    },
  },
  {
    description: "409 Conflict – duplicate flashcard fingerprint",
    status: 409,
    request: {
      method: "POST",
      url: "/api/flashcards",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        front: baseCard.front,
        back: baseCard.back,
        origin: "manual",
      },
    },
    response: {
      error: {
        code: "duplicate_flashcard",
        message: "A flashcard with the same front and back already exists.",
      },
    },
  },
  {
    description: "422 Unprocessable Entity – FK violation surfaced from DB",
    status: 422,
    request: {
      method: "POST",
      url: "/api/flashcards",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        front: baseCard.front,
        back: baseCard.back,
        origin: "manual",
        content_source_id: 42,
      },
    },
    response: {
      error: {
        code: "unprocessable_entity",
        message: "Referenced entities are invalid or no longer exist.",
      },
    },
  },
  {
    description: "500 Internal Server Error – PostgREST failure",
    status: 500,
    request: {
      method: "POST",
      url: "/api/flashcards",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        front: baseCard.front,
        back: baseCard.back,
        origin: "manual",
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while creating the flashcard.",
        details: {
          code: "XX000",
          message: "unexpected db failure",
        },
      },
    },
  },
  {
    description: "200 OK – first page of flashcards",
    status: 200,
    request: {
      method: "GET",
      url: "/api/flashcards",
      headers: {
        Authorization: "Bearer <jwt>",
      },
    },
    response: {
      data: [baseCard],
      page: {
        next_cursor: "MjAyNS0xMi0wMlQxMDowMDowMC4wMDBaIzEzZjNmYzBkLTgyMzYtNGQzNi1hMGIyLTZiOTdhOGUwZjk5OQ==",
        has_more: true,
      },
      aggregates: {
        total: 25,
        by_origin: {
          "ai-full": 12,
          "ai-edited": 8,
          manual: 5,
        },
      },
    },
  },
  {
    description: "200 OK – paginated results with filters",
    status: 200,
    request: {
      method: "GET",
      url: "/api/flashcards?limit=5&category_id=1&origin=manual&search=handshake&sort=-created_at",
      headers: {
        Authorization: "Bearer <jwt>",
      },
    },
    response: {
      data: [baseCard],
      page: {
        next_cursor: null,
        has_more: false,
      },
      aggregates: {
        total: 1,
        by_origin: {
          manual: 1,
        },
      },
    },
  },
  {
    description: "400 Bad Request – invalid query parameters",
    status: 400,
    request: {
      method: "GET",
      url: "/api/flashcards?limit=150&sort=invalid_sort",
      headers: {
        Authorization: "Bearer <jwt>",
      },
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Limit must be between 1 and 100.; Sort must be one of: created_at, -created_at, updated_at, next_review_at.",
      },
    },
  },
  {
    description: "401 Unauthorized – missing authentication",
    status: 401,
    request: {
      method: "GET",
      url: "/api/flashcards",
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authenticated.",
      },
    },
  },
];
