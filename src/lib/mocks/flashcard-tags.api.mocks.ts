import type { ApiErrorResponse, TagDTO } from "../../types";
import type { FlashcardErrorCode } from "../errors.ts";

export interface FlashcardTagsApiMock {
  description: string;
  status: number;
  request: {
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  response: TagDTO[] | ApiErrorResponse<FlashcardErrorCode>;
}

const baseTags: TagDTO[] = [
  {
    id: 3,
    name: "Networking",
    slug: "networking",
    description: "OSI, TCP/IP and related topics.",
    created_at: "2025-11-28T12:00:00.000Z",
    updated_at: "2025-12-20T09:00:00.000Z",
  },
  {
    id: 7,
    name: "Security",
    slug: "security",
    description: "Offensive and defensive security concepts.",
    created_at: "2025-11-29T12:00:00.000Z",
    updated_at: "2025-12-18T15:30:00.000Z",
  },
];

export const flashcardTagsApiMocks: FlashcardTagsApiMock[] = [
  {
    description: "200 OK – replace tags with a new set",
    status: 200,
    request: {
      method: "PUT",
      url: "/api/flashcards/13f3fc0d-8236-4d36-a0b2-6b97a8e0f999/tags",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        tag_ids: baseTags.map((tag) => tag.id),
      },
    },
    response: baseTags,
  },
  {
    description: "200 OK – clear tags with an empty array",
    status: 200,
    request: {
      method: "PUT",
      url: "/api/flashcards/13f3fc0d-8236-4d36-a0b2-6b97a8e0f999/tags",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        tag_ids: [],
      },
    },
    response: [],
  },
  {
    description: "400 Bad Request – invalid body (duplicate tag IDs)",
    status: 400,
    request: {
      method: "PUT",
      url: "/api/flashcards/13f3fc0d-8236-4d36-a0b2-6b97a8e0f999/tags",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        tag_ids: [3, 3],
      },
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Tag IDs must be unique.",
      },
    },
  },
  {
    description: "401 Unauthorized – user not authenticated",
    status: 401,
    request: {
      method: "PUT",
      url: "/api/flashcards/13f3fc0d-8236-4d36-a0b2-6b97a8e0f999/tags",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        tag_ids: [3],
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
    description: "404 Not Found – flashcard does not belong to user",
    status: 404,
    request: {
      method: "PUT",
      url: "/api/flashcards/99999999-9999-9999-9999-999999999999/tags",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        tag_ids: [3],
      },
    },
    response: {
      error: {
        code: "not_found",
        message: "Flashcard not found.",
        details: { card_id: "99999999-9999-9999-9999-999999999999" },
      },
    },
  },
  {
    description: "404 Not Found – at least one tag does not exist",
    status: 404,
    request: {
      method: "PUT",
      url: "/api/flashcards/13f3fc0d-8236-4d36-a0b2-6b97a8e0f999/tags",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        tag_ids: [3, 999],
      },
    },
    response: {
      error: {
        code: "tag_not_found",
        message: "One or more tags do not exist.",
        details: { missing_tag_ids: [999] },
      },
    },
  },
  {
    description: "500 Internal Server Error – PostgREST failure surfaced",
    status: 500,
    request: {
      method: "PUT",
      url: "/api/flashcards/13f3fc0d-8236-4d36-a0b2-6b97a8e0f999/tags",
      headers: {
        Authorization: "Bearer <jwt>",
        "Content-Type": "application/json",
      },
      body: {
        tag_ids: [3],
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while updating flashcard tags.",
        details: { db_code: "XX000" },
      },
    },
  },
];
