import type { FlashcardErrorCode } from "../../errors.ts";
import type {
  ApiErrorResponse,
  FlashcardDTO,
  FlashcardListResponse,
  CreateFlashcardCommand,
  UpdateFlashcardCommand,
  SetFlashcardTagsCommand,
  TagDTO,
} from "../../../types";

export interface FlashcardsApiMock {
  description: string;
  status: number;
  request: {
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    url: string;
    headers?: Record<string, string>;
    body?: CreateFlashcardCommand | UpdateFlashcardCommand | SetFlashcardTagsCommand;
  };
  response: FlashcardListResponse | FlashcardDTO | TagDTO[] | ApiErrorResponse<FlashcardErrorCode> | null;
}

export const flashcardsApiMocks: FlashcardsApiMock[] = [
  {
    description: "200 OK – list flashcards default first page",
    status: 200,
    request: {
      method: "GET",
      url: "/api/flashcards",
    },
    response: {
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          front: "What is React?",
          back: "A JavaScript library for building user interfaces",
          origin: "manual",
          metadata: null,
          category_id: 1,
          content_source_id: null,
          owner_id: "user-123",
          created_at: "2025-12-01T10:00:00.000Z",
          updated_at: "2025-12-01T10:00:00.000Z",
          deleted_at: null,
          tags: [
            {
              id: 1,
              name: "React",
              slug: "react",
              description: "JavaScript library",
              created_at: "2025-11-30T09:00:00.000Z",
              updated_at: "2025-11-30T09:00:00.000Z",
            },
          ],
          review_stats: {
            card_id: "550e8400-e29b-41d4-a716-446655440000",
            user_id: "user-123",
            total_reviews: 5,
            successes: 4,
            consecutive_successes: 2,
            last_outcome: "good",
            last_interval_days: 3,
            next_review_at: "2025-12-04T10:00:00.000Z",
            last_reviewed_at: "2025-12-01T10:00:00.000Z",
            aggregates: null,
          },
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          front: "What is TypeScript?",
          back: "A superset of JavaScript that adds static typing",
          origin: "ai-full",
          metadata: { model: "gpt-4", temperature: 0.7 },
          category_id: 1,
          content_source_id: 1,
          owner_id: "user-123",
          created_at: "2025-12-01T11:00:00.000Z",
          updated_at: "2025-12-01T11:00:00.000Z",
          deleted_at: null,
          tags: [
            {
              id: 2,
              name: "TypeScript",
              slug: "typescript",
              description: "Typed JavaScript",
              created_at: "2025-11-30T10:00:00.000Z",
              updated_at: "2025-11-30T10:00:00.000Z",
            },
          ],
          review_stats: undefined,
        },
      ],
      page: {
        next_cursor: "MjAyNS0xMi0wMVQxMTowMDowMC4wMDBaIzU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMQ==",
        has_more: true,
      },
      aggregates: {
        total: 15,
        by_origin: {
          manual: 5,
          "ai-full": 7,
          "ai-edited": 3,
        },
      },
    },
  },
  {
    description: "200 OK – list flashcards with search filter",
    status: 200,
    request: {
      method: "GET",
      url: "/api/flashcards?search=react&limit=10",
    },
    response: {
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          front: "What is React?",
          back: "A JavaScript library for building user interfaces",
          origin: "manual",
          metadata: null,
          category_id: 1,
          content_source_id: null,
          owner_id: "user-123",
          created_at: "2025-12-01T10:00:00.000Z",
          updated_at: "2025-12-01T10:00:00.000Z",
          deleted_at: null,
          tags: [
            {
              id: 1,
              name: "React",
              slug: "react",
              description: "JavaScript library",
              created_at: "2025-11-30T09:00:00.000Z",
              updated_at: "2025-11-30T09:00:00.000Z",
            },
          ],
          review_stats: undefined,
        },
      ],
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
    description: "200 OK – list flashcards filtered by category",
    status: 200,
    request: {
      method: "GET",
      url: "/api/flashcards?category_id=2&limit=5",
    },
    response: {
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          front: "What is Docker?",
          back: "A platform for developing, shipping, and running applications in containers",
          origin: "ai-edited",
          metadata: { model: "gpt-3.5", temperature: 0.5 },
          category_id: 2,
          content_source_id: 2,
          owner_id: "user-123",
          created_at: "2025-12-01T12:00:00.000Z",
          updated_at: "2025-12-01T12:00:00.000Z",
          deleted_at: null,
          tags: [
            {
              id: 3,
              name: "Docker",
              slug: "docker",
              description: "Containerization",
              created_at: "2025-11-30T11:00:00.000Z",
              updated_at: "2025-11-30T11:00:00.000Z",
            },
          ],
          review_stats: undefined,
        },
      ],
      page: {
        next_cursor: null,
        has_more: false,
      },
      aggregates: {
        total: 8,
        by_origin: {
          "ai-edited": 8,
        },
      },
    },
  },
  {
    description: "200 OK – list flashcards filtered by tags",
    status: 200,
    request: {
      method: "GET",
      url: "/api/flashcards?tag_ids[]=1&tag_ids[]=2&limit=10",
    },
    response: {
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          front: "What is React?",
          back: "A JavaScript library for building user interfaces",
          origin: "manual",
          metadata: null,
          category_id: 1,
          content_source_id: null,
          owner_id: "user-123",
          created_at: "2025-12-01T10:00:00.000Z",
          updated_at: "2025-12-01T10:00:00.000Z",
          deleted_at: null,
          tags: [
            {
              id: 1,
              name: "React",
              slug: "react",
              description: "JavaScript library",
              created_at: "2025-11-30T09:00:00.000Z",
              updated_at: "2025-11-30T09:00:00.000Z",
            },
          ],
          review_stats: undefined,
        },
      ],
      page: {
        next_cursor: null,
        has_more: false,
      },
      aggregates: {
        total: 2,
        by_origin: {
          manual: 1,
          "ai-full": 1,
        },
      },
    },
  },
  {
    description: "400 Bad Request – invalid query parameters",
    status: 400,
    request: {
      method: "GET",
      url: "/api/flashcards?limit=invalid",
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Query parameters are invalid.",
      },
    },
  },
  {
    description: "401 Unauthorized – user not authenticated",
    status: 401,
    request: {
      method: "GET",
      url: "/api/flashcards",
      headers: {},
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authenticated.",
      },
    },
  },
  {
    description: "201 Created – create flashcard successfully",
    status: 201,
    request: {
      method: "POST",
      url: "/api/flashcards",
      body: {
        front: "What is Node.js?",
        back: "A JavaScript runtime built on Chrome's V8 JavaScript engine",
        origin: "manual",
        category_id: 1,
        tag_ids: [4],
      },
    },
    response: {
      id: "550e8400-e29b-41d4-a716-446655440003",
      front: "What is Node.js?",
      back: "A JavaScript runtime built on Chrome's V8 JavaScript engine",
      origin: "manual",
      metadata: null,
      category_id: 1,
      content_source_id: null,
      owner_id: "user-123",
      created_at: "2025-12-01T13:00:00.000Z",
      updated_at: "2025-12-01T13:00:00.000Z",
      deleted_at: null,
      tags: [
        {
          id: 4,
          name: "Node.js",
          slug: "nodejs",
          description: "JavaScript runtime",
          created_at: "2025-11-30T12:00:00.000Z",
          updated_at: "2025-11-30T12:00:00.000Z",
        },
      ],
    },
  },
  {
    description: "400 Bad Request – invalid create flashcard body",
    status: 400,
    request: {
      method: "POST",
      url: "/api/flashcards",
      body: {
        front: "",
        back: "Valid back",
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
    description: "404 Not Found – category not found during creation",
    status: 404,
    request: {
      method: "POST",
      url: "/api/flashcards",
      body: {
        front: "Valid front",
        back: "Valid back",
        origin: "manual",
        category_id: 999,
      },
    },
    response: {
      error: {
        code: "category_not_found",
        message: "Category 999 does not exist.",
        details: {
          category_id: 999,
        },
      },
    },
  },
  {
    description: "200 OK – get single flashcard by ID",
    status: 200,
    request: {
      method: "GET",
      url: "/api/flashcards/550e8400-e29b-41d4-a716-446655440000",
    },
    response: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      front: "What is React?",
      back: "A JavaScript library for building user interfaces",
      origin: "manual",
      metadata: null,
      category_id: 1,
      content_source_id: null,
      owner_id: "user-123",
      created_at: "2025-12-01T10:00:00.000Z",
      updated_at: "2025-12-01T10:00:00.000Z",
      deleted_at: null,
      tags: [
        {
          id: 1,
          name: "React",
          slug: "react",
          description: "JavaScript library",
          created_at: "2025-11-30T09:00:00.000Z",
          updated_at: "2025-11-30T09:00:00.000Z",
        },
      ],
      review_stats: {
        card_id: "550e8400-e29b-41d4-a716-446655440000",
        user_id: "user-123",
        total_reviews: 5,
        successes: 4,
        consecutive_successes: 2,
        last_outcome: "good",
        last_interval_days: 3,
        next_review_at: "2025-12-04T10:00:00.000Z",
        last_reviewed_at: "2025-12-01T10:00:00.000Z",
        aggregates: null,
      },
    },
  },
  {
    description: "404 Not Found – flashcard not found",
    status: 404,
    request: {
      method: "GET",
      url: "/api/flashcards/550e8400-e29b-41d4-a716-446655440999",
    },
    response: {
      error: {
        code: "not_found",
        message: "Flashcard not found.",
      },
    },
  },
  {
    description: "200 OK – update flashcard successfully",
    status: 200,
    request: {
      method: "PATCH",
      url: "/api/flashcards/550e8400-e29b-41d4-a716-446655440000",
      body: {
        back: "Updated: A JavaScript library for building user interfaces with components",
      },
    },
    response: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      front: "What is React?",
      back: "Updated: A JavaScript library for building user interfaces with components",
      origin: "manual",
      metadata: null,
      category_id: 1,
      content_source_id: null,
      owner_id: "user-123",
      created_at: "2025-12-01T10:00:00.000Z",
      updated_at: "2025-12-01T14:00:00.000Z",
      deleted_at: null,
      tags: [
        {
          id: 1,
          name: "React",
          slug: "react",
          description: "JavaScript library",
          created_at: "2025-11-30T09:00:00.000Z",
          updated_at: "2025-11-30T09:00:00.000Z",
        },
      ],
    },
  },
  {
    description: "404 Not Found – update non-existent flashcard",
    status: 404,
    request: {
      method: "PATCH",
      url: "/api/flashcards/550e8400-e29b-41d4-a716-446655449999",
      body: {
        back: "Updated back",
      },
    },
    response: {
      error: {
        code: "not_found",
        message: "Flashcard not found.",
      },
    },
  },
  {
    description: "204 No Content – soft delete flashcard",
    status: 204,
    request: {
      method: "DELETE",
      url: "/api/flashcards/550e8400-e29b-41d4-a716-446655440000",
    },
    response: null,
  },
  {
    description: "200 OK – set flashcard tags successfully",
    status: 200,
    request: {
      method: "PUT",
      url: "/api/flashcards/550e8400-e29b-41d4-a716-446655440000/tags",
      body: {
        tag_ids: [1, 5],
      },
    },
    response: [
      {
        id: 1,
        name: "React",
        slug: "react",
        description: "JavaScript library",
        created_at: "2025-11-30T09:00:00.000Z",
        updated_at: "2025-11-30T09:00:00.000Z",
      },
      {
        id: 5,
        name: "Frontend",
        slug: "frontend",
        description: "Frontend development",
        created_at: "2025-11-30T13:00:00.000Z",
        updated_at: "2025-11-30T13:00:00.000Z",
      },
    ],
  },
  {
    description: "404 Not Found – set tags for non-existent flashcard",
    status: 404,
    request: {
      method: "PUT",
      url: "/api/flashcards/550e8400-e29b-41d4-a716-446655449999/tags",
      body: {
        tag_ids: [1],
      },
    },
    response: {
      error: {
        code: "not_found",
        message: "Flashcard not found.",
        details: {
          card_id: "550e8400-e29b-41d4-a716-446655449999",
        },
      },
    },
  },
  {
    description: "200 OK – restore flashcard successfully",
    status: 200,
    request: {
      method: "POST",
      url: "/api/flashcards/550e8400-e29b-41d4-a716-446655440000/restore",
    },
    response: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      front: "What is React?",
      back: "A JavaScript library for building user interfaces",
      origin: "manual",
      metadata: null,
      category_id: 1,
      content_source_id: null,
      owner_id: "user-123",
      created_at: "2025-12-01T10:00:00.000Z",
      updated_at: "2025-12-01T14:00:00.000Z",
      deleted_at: null,
      tags: [],
      review_stats: undefined,
    },
  },
  {
    description: "401 Unauthorized – restore without admin privileges",
    status: 401,
    request: {
      method: "POST",
      url: "/api/flashcards/550e8400-e29b-41d4-a716-446655440000/restore",
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authorized to restore cards.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database failure",
    status: 500,
    request: {
      method: "GET",
      url: "/api/flashcards",
    },
    response: {
      error: {
        code: "db_error",
        message: "A database error occurred while listing flashcards.",
      },
    },
  },
];
