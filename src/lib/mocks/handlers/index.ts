import { http, HttpResponse, type HttpHandler } from "msw";

import { adminKpiHandlers } from "./admin-kpi";
import { categoriesHandlers } from "./categories";
import { errorLogsHandlers } from "./error-logs";
import { flashcardsHandlers } from "./flashcards";
import { tagsHandlers } from "./tags";
import { userRolesHandlers } from "./user-roles";

/**
 * All MSW handlers for API mocking in tests
 * Import specific handlers as needed for selective mocking
 */
export const apiMockHandlers: HttpHandler[] = [
  ...adminKpiHandlers,
  ...categoriesHandlers,
  ...errorLogsHandlers,
  ...flashcardsHandlers,
  ...tagsHandlers,
  ...userRolesHandlers,

  // Catch-all handlers for unhandled requests - return 404 (must be last)
  http.get("*", ({ request }) => {
    if (!request.url.includes("/api/")) {
      return; // Let the request pass through for non-API calls
    }
    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.post("*", ({ request }) => {
    if (!request.url.includes("/api/")) {
      return;
    }
    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.put("*", ({ request }) => {
    if (!request.url.includes("/api/")) {
      return;
    }
    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  http.delete("*", ({ request }) => {
    if (!request.url.includes("/api/")) {
      return;
    }
    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),
];

/**
 * Helper function to get handlers for specific API mocks
 * Currently returns basic handlers - can be extended when detailed mocks are needed
 */
export function getApiMockHandlers(): HttpHandler[] {
  // For now, return basic handlers
  // TODO: Implement selective mocking when detailed mocks are refactored
  return apiMockHandlers;
}
