import { http, HttpResponse, type HttpHandler } from "msw";
import type { CreateFlashcardCommand, UpdateFlashcardCommand, SetFlashcardTagsCommand } from "../../../types";

import { flashcardsApiMocks } from "../mocks/flashcards.api.mocks";

/**
 * MSW handlers for flashcards API endpoints
 */
export const flashcardsHandlers: HttpHandler[] = [
  http.get("/api/flashcards", ({ request }) => {
    const url = new URL(request.url);

    // Find matching mock based on query parameters
    const matchingMock = flashcardsApiMocks.find((mock) => {
      if (mock.request.method !== "GET" || !mock.request.url.startsWith("/api/flashcards")) return false;

      const mockUrl = new URL(mock.request.url, "http://localhost");

      // Check if all mock query params match request
      for (const [key, expectedValue] of mockUrl.searchParams) {
        const actualValue = url.searchParams.get(key);
        if (actualValue !== expectedValue) {
          return false;
        }
      }

      // If mock has no query params but request has some, don't match
      if (mockUrl.searchParams.toString() === "" && url.searchParams.toString() !== "") {
        return false;
      }

      return true;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.post("/api/flashcards", async ({ request }) => {
    const body = await request.json();

    // Find matching mock based on request body
    const matchingMock = flashcardsApiMocks.find((mock) => {
      if (mock.request.method !== "POST") return false;

      // For POST requests, we match based on the body content
      if (!mock.request.body) return false;

      // Simple body matching - in a real implementation, you'd do deeper comparison
      const mockBody = mock.request.body as CreateFlashcardCommand;
      const requestBody = body as CreateFlashcardCommand;

      if (mockBody.front && requestBody.front !== mockBody.front) return false;
      if (mockBody.back && requestBody.back !== mockBody.back) return false;
      if (mockBody.origin && requestBody.origin !== mockBody.origin) return false;
      if (mockBody.category_id && requestBody.category_id !== mockBody.category_id) return false;

      return true;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.get("/api/flashcards/:id", ({ params }) => {
    const { id } = params;

    // Find matching mock based on ID
    const matchingMock = flashcardsApiMocks.find((mock) => {
      if (mock.request.method !== "GET") return false;

      // Extract ID from mock URL
      const mockUrl = mock.request.url;
      const mockId = mockUrl.split("/").pop();

      return mockId === id;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.patch("/api/flashcards/:id", async ({ request, params }) => {
    const { id } = params;
    const body = await request.json();

    // Find matching mock based on ID and body
    const matchingMock = flashcardsApiMocks.find((mock) => {
      if (mock.request.method !== "PATCH") return false;

      // Extract ID from mock URL
      const mockUrl = mock.request.url;
      const mockId = mockUrl.split("/").pop();

      if (mockId !== id) return false;

      // Match based on body content
      if (!mock.request.body) return false;

      const mockBody = mock.request.body as UpdateFlashcardCommand;
      const requestBody = body as UpdateFlashcardCommand;

      if (mockBody.back && requestBody.back !== mockBody.back) return false;

      return true;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.delete("/api/flashcards/:id", ({ params }) => {
    const { id } = params;

    // Find matching mock based on ID
    const matchingMock = flashcardsApiMocks.find((mock) => {
      if (mock.request.method !== "DELETE") return false;

      // Extract ID from mock URL
      const mockUrl = mock.request.url;
      const mockId = mockUrl.split("/").pop();

      return mockId === id;
    });

    if (matchingMock) {
      return new HttpResponse(null, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.put("/api/flashcards/:id/tags", async ({ request, params }) => {
    const { id } = params;
    const body = await request.json();

    // Find matching mock based on ID and body
    const matchingMock = flashcardsApiMocks.find((mock) => {
      if (mock.request.method !== "PUT") return false;

      // Check if URL ends with /tags and matches ID
      if (!mock.request.url.includes(`/flashcards/${id}/tags`)) return false;

      // Match based on body content
      if (!mock.request.body) return false;

      const mockBody = mock.request.body as SetFlashcardTagsCommand;
      const requestBody = body as SetFlashcardTagsCommand;

      if (mockBody.tag_ids && JSON.stringify(mockBody.tag_ids) !== JSON.stringify(requestBody.tag_ids)) return false;

      return true;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.post("/api/flashcards/:id/restore", ({ params }) => {
    const { id } = params;

    // Find matching mock based on ID
    const matchingMock = flashcardsApiMocks.find((mock) => {
      if (mock.request.method !== "POST") return false;

      // Check if URL ends with /restore and matches ID
      return mock.request.url.includes(`/flashcards/${id}/restore`);
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),
];
