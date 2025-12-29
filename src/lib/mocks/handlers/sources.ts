import { http, HttpResponse, type HttpHandler } from "msw";

import { sourcesApiMocks } from "../mocks/sources.api.mocks";

export const sourcesHandlers: HttpHandler[] = [
  http.get("/api/sources", ({ request }) => {
    const url = new URL(request.url);

    const matchingMock = sourcesApiMocks.find((mock) => {
      if (mock.request.method !== "GET" || !mock.request.url.startsWith("/api/sources")) return false;

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
];
