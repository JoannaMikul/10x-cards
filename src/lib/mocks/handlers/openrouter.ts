import { http, HttpResponse, type HttpHandler } from "msw";

import { openRouterApiMocks } from "../mocks/openrouter.api.mocks";

export const openRouterHandlers: HttpHandler[] = [
  http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
    const body = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return HttpResponse.json({ error: { message: "Invalid request body format" } }, { status: 400 });
    }

    const requestBody = body as Record<string, unknown>;

    const matchingMock = openRouterApiMocks.find((mock) => {
      if (mock.request.method !== "POST" || mock.request.url !== "https://openrouter.ai/api/v1/chat/completions") {
        return false;
      }

      if (mock.request.body.model !== requestBody.model) {
        return false;
      }

      if (mock.request.body.temperature !== undefined && mock.request.body.temperature !== requestBody.temperature) {
        return false;
      }

      if (!Array.isArray(requestBody.messages) || requestBody.messages.length !== mock.request.body.messages.length) {
        return false;
      }

      if (mock.request.body.response_format && requestBody.response_format) {
        const mockResponseFormat = mock.request.body.response_format;
        const requestResponseFormat = requestBody.response_format as { type?: string };

        if (mockResponseFormat.type !== requestResponseFormat.type) {
          return false;
        }
      }

      const authHeader = request.headers.get("Authorization");
      if (mock.request.headers?.Authorization && authHeader !== mock.request.headers.Authorization) {
        return false;
      }

      return true;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: { message: "Mock not found for this OpenRouter request" } }, { status: 404 });
  }),
];
