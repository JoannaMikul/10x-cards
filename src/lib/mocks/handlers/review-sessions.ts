import { http, HttpResponse, type HttpHandler } from "msw";

import { reviewSessionsApiMocks } from "../mocks/review-sessions.api.mocks";

export const reviewSessionsHandlers: HttpHandler[] = [
  http.post("/api/review-sessions", async ({ request }) => {
    const body = await request.json();

    const matchingMock = reviewSessionsApiMocks.find((mock) => {
      if (mock.request.method !== "POST" || mock.request.url !== "/api/review-sessions") return false;

      if (mock.request.body) {
        return JSON.stringify(mock.request.body) === JSON.stringify(body);
      }

      return mock.description.includes("successful") || mock.description.includes("empty");
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),
];
