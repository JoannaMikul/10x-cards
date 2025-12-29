import { http, HttpResponse, type HttpHandler } from "msw";

import { adminKpiApiMocks } from "../mocks/admin-kpi.api.mocks";

/**
 * MSW handlers for admin KPI API endpoints
 */
export const adminKpiHandlers: HttpHandler[] = [
  http.get("/api/admin/kpi*", ({ request }) => {
    const url = new URL(request.url);

    // Find matching mock based on query parameters
    const matchingMock = adminKpiApiMocks.find((mock) => {
      if (mock.request.method !== "GET") return false;

      const mockUrl = new URL(mock.request.url, "http://localhost");

      // Check if all mock query params match request
      for (const [key, expectedValue] of mockUrl.searchParams) {
        const actualValue = url.searchParams.get(key);
        if (actualValue !== expectedValue) {
          return false;
        }
      }

      return true;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),
];
