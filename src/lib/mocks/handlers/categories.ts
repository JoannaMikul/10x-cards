import { http, HttpResponse, type HttpHandler } from "msw";

import { categoriesApiMocks } from "../mocks/categories.api.mocks";

/**
 * MSW handlers for categories API endpoints
 */
export const categoriesHandlers: HttpHandler[] = [
  // GET /api/categories - List categories with optional query parameters
  http.get("/api/categories", ({ request }) => {
    const url = new URL(request.url);

    // Find matching mock based on query parameters
    const matchingMock = categoriesApiMocks.find((mock) => {
      if (mock.request.method !== "GET" || !mock.request.url.startsWith("/api/categories")) return false;

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

  // POST /api/categories - Create new category
  http.post("/api/categories", async ({ request }) => {
    const body = await request.json();

    // Find matching mock based on request body
    const matchingMock = categoriesApiMocks.find((mock) => {
      if (mock.request.method !== "POST") return false;

      // For POST requests, we match based on the body content
      if (mock.request.body && body) {
        return JSON.stringify(mock.request.body) === JSON.stringify(body);
      }

      return false;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  // PATCH /api/categories/:id - Update category by ID
  http.patch("/api/categories/:id", async ({ request, params }) => {
    const { id } = params;
    const body = await request.json();

    // Find matching mock based on ID and body
    const matchingMock = categoriesApiMocks.find((mock) => {
      if (mock.request.method !== "PATCH") return false;

      // Check if URL matches the pattern /api/categories/:id
      const urlPattern = `/api/categories/${id}`;
      if (mock.request.url !== urlPattern) return false;

      // Match based on request body
      if (mock.request.body && body) {
        return JSON.stringify(mock.request.body) === JSON.stringify(body);
      }

      return false;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  // DELETE /api/categories/:id - Delete category by ID
  http.delete("/api/categories/:id", ({ params }) => {
    const { id } = params;

    // Find matching mock based on ID
    const matchingMock = categoriesApiMocks.find((mock) => {
      if (mock.request.method !== "DELETE") return false;

      // Check if URL matches the pattern /api/categories/:id
      const urlPattern = `/api/categories/${id}`;
      return mock.request.url === urlPattern;
    });

    if (matchingMock) {
      if (matchingMock.response === null) {
        return new HttpResponse(null, { status: matchingMock.status });
      }
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),
];
