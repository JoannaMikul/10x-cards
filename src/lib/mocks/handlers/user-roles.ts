import { http, HttpResponse, type HttpHandler } from "msw";

import { userRolesApiMocks } from "../mocks/user-roles.api.mocks";

/**
 * MSW handlers for user roles API endpoints
 */
export const userRolesHandlers: HttpHandler[] = [
  http.get("/api/admin/user-roles", ({ request }) => {
    const url = new URL(request.url);

    const matchingMock = userRolesApiMocks.find((mock) => {
      if (mock.request.method !== "GET" || !mock.request.url.startsWith("/api/admin/user-roles")) return false;

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

  http.post("/api/admin/user-roles", async ({ request }) => {
    const body = await request.json();

    const matchingMock = userRolesApiMocks.find((mock) => {
      if (mock.request.method !== "POST") return false;

      if (mock.request.body) {
        return JSON.stringify(mock.request.body) === JSON.stringify(body);
      }

      return false;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.delete("/api/admin/user-roles/:userId/:role", ({ params }) => {
    const { userId, role } = params;

    const matchingMock = userRolesApiMocks.find((mock) => {
      if (mock.request.method !== "DELETE") return false;

      const urlParts = mock.request.url.split("/");
      const mockUserId = urlParts[urlParts.length - 2];
      const mockRole = urlParts[urlParts.length - 1];

      return mockUserId === userId && mockRole === role;
    });

    if (matchingMock) {
      return HttpResponse.json(matchingMock.response, { status: matchingMock.status });
    }

    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),
];
