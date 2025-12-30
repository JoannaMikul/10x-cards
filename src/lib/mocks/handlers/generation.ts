import { http, HttpResponse, type HttpHandler } from "msw";
import type { CreateGenerationCommand } from "../../../types";

import { generationApiMocks } from "../mocks/generations.api.mocks";

export const generationHandlers: HttpHandler[] = [
  http.post("/api/generations", async ({ request }) => {
    const body = (await request.json()) as Partial<CreateGenerationCommand>;

    const matchingMock = generationApiMocks.find((mock) => {
      if (mock.method !== "POST" || !mock.path.includes("/api/generations")) return false;
      if (!mock.request?.body) return false;

      const mockBody = mock.request.body as Partial<CreateGenerationCommand>;

      if (mockBody.model && body.model !== mockBody.model) return false;
      if (mockBody.sanitized_input_text && body.sanitized_input_text !== mockBody.sanitized_input_text) return false;
      if (mockBody.temperature !== undefined && body.temperature !== mockBody.temperature) return false;

      return true;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.get("/api/generations/:id", ({ params }) => {
    const { id } = params;

    const matchingMock = generationApiMocks.find((mock) => {
      if (mock.method !== "GET") return false;

      const mockId = mock.path.split("/").pop();
      return mockId === id;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.patch("/api/generations/:id", async ({ request, params }) => {
    const { id } = params;
    const body = (await request.json()) as Record<string, unknown>;

    const matchingMock = generationApiMocks.find((mock) => {
      if (mock.method !== "PATCH") return false;

      const mockId = mock.path.split("/").pop();
      if (mockId !== id) return false;
      if (!mock.request?.body) return false;

      const mockBody = mock.request.body as Record<string, unknown>;
      if (mockBody.status && body.status !== mockBody.status) return false;

      return true;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),
];
