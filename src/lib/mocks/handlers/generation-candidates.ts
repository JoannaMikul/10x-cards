import { http, HttpResponse, type HttpHandler } from "msw";

import {
  generationCandidatesApiMocks,
  acceptGenerationCandidateApiMocks,
  rejectGenerationCandidateApiMocks,
  updateGenerationCandidateApiMocks,
} from "../mocks/generation-candidates.api.mocks";

/**
 * MSW handlers for generation candidates API endpoints
 */
export const generationCandidatesHandlers: HttpHandler[] = [
  http.get("/api/generation-candidates", ({ request }) => {
    const url = new URL(request.url);

    const matchingMock = generationCandidatesApiMocks.find((mock) => {
      if (mock.request.method !== "GET" || !mock.request.url.startsWith("/api/generation-candidates")) return false;

      const mockUrl = new URL(mock.request.url, "http://localhost");

      for (const [key, expectedValue] of mockUrl.searchParams) {
        const actualValue = url.searchParams.get(key);
        if (actualValue !== expectedValue) {
          return false;
        }
      }

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

  http.post("/api/generation-candidates/:id/accept", async ({ request, params }) => {
    const { id } = params;
    const body = await request.json();

    const matchingMock = acceptGenerationCandidateApiMocks.find((mock) => {
      if (mock.request.method !== "POST") return false;

      const urlPattern = `/api/generation-candidates/${id}/accept`;
      if (mock.request.url !== urlPattern) return false;

      if (mock.request.body && body) {
        return JSON.stringify(mock.request.body) === JSON.stringify(body);
      }

      return !mock.request.body;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.post("/api/generation-candidates/:id/reject", async ({ request, params }) => {
    const { id } = params;
    const body = await request.json();

    const matchingMock = rejectGenerationCandidateApiMocks.find((mock) => {
      if (mock.request.method !== "POST") return false;

      const urlPattern = `/api/generation-candidates/${id}/reject`;
      if (mock.request.url !== urlPattern) return false;

      if (mock.request.body && body) {
        return JSON.stringify(mock.request.body) === JSON.stringify(body);
      }

      return !mock.request.body;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.patch("/api/generation-candidates/:id", async ({ request, params }) => {
    const { id } = params;
    const body = await request.json();

    const matchingMock = updateGenerationCandidateApiMocks.find((mock) => {
      if (mock.request.method !== "PATCH") return false;

      const urlPattern = `/api/generation-candidates/${id}`;
      if (mock.request.url !== urlPattern) return false;

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
];
