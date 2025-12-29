import { http, HttpResponse, type HttpHandler } from "msw";

import { errorLogsApiMocks } from "../mocks/error-logs.api.mocks";

/**
 * MSW handlers for error logs API endpoints
 */
export const errorLogsHandlers: HttpHandler[] = [
  http.get("/api/admin/generation-errors", ({ request }) => {
    const url = new URL(request.url);

    const matchingMock = errorLogsApiMocks.find((mock) => {
      if (mock.request.method !== "GET" || !mock.request.url.startsWith("/api/admin/generation-errors")) return false;

      const mockUrl = new URL(mock.request.url, "http://localhost");

      for (const [key, expectedValue] of mockUrl.searchParams) {
        const actualValue = url.searchParams.get(key);
        if (actualValue !== expectedValue) {
          return false;
        }
      }

      if (mock.request.headers?.Authorization) {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== mock.request.headers.Authorization) {
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
