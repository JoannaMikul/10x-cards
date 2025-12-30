# MSW (Mock Service Worker) Integration

This directory contains MSW handlers and API mocks for testing. MSW provides realistic HTTP mocking by intercepting requests at the network level.

## Directory Structure

```text
src/lib/mocks/
├── handlers/           # MSW handlers organized by service
│   ├── index.ts        # Main file exporting all handlers
│   ├── admin-kpi.ts    # Admin KPI handlers
│   ├── categories.ts   # Categories CRUD handlers
│   ├── flashcards.ts   # Flashcards CRUD handlers
│   ├── generation-processor.ts  # Generation processor dependencies
│   ├── openrouter.ts   # OpenRouter API handlers
│   ├── tags.ts         # Tags handlers
│   ├── user-roles.ts   # User roles CRUD handlers
│   └── ...             # Other handlers (to be added)
├── mocks/              # API mock data
│   ├── admin-kpi.api.mocks.ts
│   ├── analytics.api.mocks.ts
│   ├── categories.api.mocks.ts
│   ├── flashcards.api.mocks.ts
│   ├── openrouter.api.mocks.ts     # OpenRouter API mock data
│   └── ...             # All .api.mocks.ts files
├── msw-handlers.ts     # Backward compatibility (redirects to handlers/)
└── README.md           # This documentation
```

## Setup

MSW is automatically configured in `src/test/setup.ts` with a global server that provides basic API handlers. The server starts before all tests and resets handlers after each test.

## Basic Usage

### Using Default Handlers

Most tests will work out-of-the-box with the default MSW setup. The global server provides basic responses for common API endpoints:

```typescript
// This will work without any additional setup
it("should fetch data", async () => {
  const result = await someApiCall();
  expect(result).toBeDefined();
});
```

### Overriding Handlers for Specific Tests

For custom responses or specific test scenarios, override handlers using `server.use()`:

```typescript
import { server } from "../../../test/setup";
import { http, HttpResponse } from "msw";

it("should handle custom response", () => {
  // Override the default handler
  server.use(
    http.get("/api/custom-endpoint", () => {
      return HttpResponse.json({ custom: "data" }, { status: 200 });
    })
  );

  // Your test code
  const result = await fetchCustomData();
  expect(result.custom).toBe("data");
});
```

### Error Scenarios

Test error handling by mocking failed responses:

```typescript
server.use(
  http.get("/api/data", () => {
    return HttpResponse.json({ error: "Internal Server Error" }, { status: 500 });
  })
);
```

## Available Mock Data

Detailed API mocks are available in `.api.mocks.ts` files and contain comprehensive request/response examples for different scenarios:

### API Mock Files

- `admin-kpi.api.mocks.ts` - Admin KPI analytics endpoints ✅ (integrated with MSW)
- `analytics.api.mocks.ts` - Database mock data for AnalyticsService unit tests 🔧 (database tables)
- `categories.api.mocks.ts` - Category CRUD operations ✅ (integrated with MSW handlers, unit tests available)
- `error-logs.api.mocks.ts` - Error logs listing operations ✅ (integrated with MSW handlers, unit tests available)
- `flashcards.api.mocks.ts` - Flashcard CRUD operations ✅ (integrated with MSW handlers, unit tests available)
- `tags.api.mocks.ts` - Tag listing operations ✅ (integrated with MSW handlers, unit tests available)
- `flashcard-tags.api.mocks.ts` - Flashcard tag operations 🔄 (requires MSW integration)
- `user-roles.api.mocks.ts` - User role management ✅ (integrated with MSW handlers, unit tests available)
- `review-sessions.api.mocks.ts` - Review session handling 🔄 (requires MSW integration)
- `generation-candidates.api.mocks.ts` - AI generation candidates ✅ (integrated with MSW handlers, unit tests available)
- `generation-processor.service.test.ts` - Generation processor service ✅ (comprehensive unit tests with MSW integration)
- `generations.api.mocks.ts` - AI generation requests 🔄 (requires MSW integration)
- `openrouter.api.mocks.ts` - OpenRouter AI API mock data ✅ (integrated with MSW handlers for unit tests)
- `review-sessions.api.mocks.ts` - Review session handling ✅ (integrated with MSW handlers, unit tests available)
- `sources.api.mocks.ts` - Source management ✅ (integrated with MSW handlers, unit tests available)
- `tags.api.mocks.ts` - Tag operations 🔄 (requires MSW integration)

### Integration Status

- ✅ **Admin KPI mocks**: Integrated with MSW handlers for unit tests
- ✅ **Categories mocks**: MSW handlers integrated for full CRUD operations (`/api/categories/*`) + unit tests available
- ✅ **Error Logs mocks**: MSW handlers integrated for error logs listing (`/api/admin/generation-errors`) + unit tests available
- ✅ **Flashcards mocks**: MSW handlers integrated for full CRUD operations (`/api/flashcards/*`) + unit tests available
- ✅ **Sources mocks**: MSW handlers integrated for source listing operations (`/api/sources`) + unit tests available
- ✅ **Tags mocks**: MSW handlers integrated for tag listing operations (`/api/tags`) + unit tests available
- ✅ **User Roles mocks**: MSW handlers integrated for user role management (`/api/admin/user-roles`) + unit tests available
- ✅ **Review Sessions mocks**: MSW handlers integrated for review session creation (`/api/review-sessions`) + unit tests available
- ✅ **Generation Candidates mocks**: MSW handlers integrated for generation candidate operations (`/api/generation-candidates/*`) + unit tests available
- ✅ **Generation Processor mocks**: MSW handlers for generation processor service dependencies (tags, error logs) + comprehensive unit tests
- ✅ **OpenRouter mocks**: MSW handlers for OpenRouter AI API endpoints (`https://openrouter.ai/api/v1/chat/completions`) + unit tests
- 🔄 **Other API mocks**: Available for reference but require refactoring for full MSW integration
- 📋 **MSW handlers**: `msw-handlers.ts` provides basic handlers and can be extended

### Using Mock Data in Tests

For unit tests, you can either:

1. Use MSW handlers (recommended for integration-style tests)
2. Import mock data directly and use with fetch mocking (current approach for admin-kpi tests)

Example of direct mock usage:

```typescript
import { adminKpiApiMocks } from "../../mocks/mocks/admin-kpi.api.mocks";

// Find specific mock scenario
const mockData = adminKpiApiMocks.find((mock) => mock.description.includes("7 day range"));

// Use in test
fetchSpy.mockResolvedValueOnce({
  ok: true,
  json: vi.fn().mockResolvedValueOnce(mockData.response),
});
```

### Generation Processor Service Testing

The generation processor service has comprehensive unit tests that demonstrate advanced MSW usage patterns:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processGeneration } from "../generation-processor.service";
import { server } from "../../../test/setup";
import { openRouterHandlers } from "../../mocks/handlers/openrouter";

describe("generation-processor.service", () => {
  beforeEach(() => {
    server.use(...openRouterHandlers);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle OpenRouter rate limit with retry", async () => {
    // Mock OpenRouter service to simulate rate limiting and recovery
    const mockService = vi.mocked(openRouterService);
    mockService.completeStructuredChat.mockRejectedValueOnce(new Error("Rate limit exceeded")).mockResolvedValueOnce({
      cards: [
        /* valid cards */
      ],
    });

    const result = await processGeneration(mockSupabase, generation);
    expect(result.success).toBe(true);
  });
});
```

Key testing patterns covered:

- **Resilience testing**: Circuit breaker, retry logic, timeout handling
- **Error scenarios**: Rate limits, server errors, network failures
- **Data validation**: Flashcard sanitization, tag ID filtering
- **Batch processing**: Multiple generation handling
- **External API mocking**: OpenRouter AI service simulation

## Best Practices

1. **Use specific handlers**: Override only the endpoints you need for each test
2. **Reset after tests**: Handlers are automatically reset via `src/test/setup.ts`
3. **Test realistic scenarios**: Mock responses that match real API behavior
4. **Avoid global state**: Don't rely on handler state between tests

## Example Test Structure

```typescript
import { describe, it, expect } from "vitest";
import { server } from "../../../test/setup";
import { http, HttpResponse } from "msw";

describe("API Service", () => {
  it("should handle success response", async () => {
    server.use(
      http.get("/api/test", () => {
        return HttpResponse.json({ success: true });
      })
    );

    const result = await apiCall();
    expect(result.success).toBe(true);
  });

  it("should handle error response", async () => {
    server.use(
      http.get("/api/test", () => {
        return HttpResponse.json({ error: "Not found" }, { status: 404 });
      })
    );

    await expect(apiCall()).rejects.toThrow();
  });
});
```

## Troubleshooting

- **Unhandled requests**: MSW warns about requests without handlers. Add handlers or use `server.listen({ onUnhandledRequest: 'bypass' })`
- **Handler conflicts**: Later handlers override earlier ones. Order matters in `server.use()`
- **Async issues**: Ensure handlers return proper Response objects

## Future Improvements

- Refactor `.api.mocks.ts` files to remove Supabase type dependencies
- Create MSW handler factories for common response patterns
- Add selective mock loading for better performance
- Expand OpenRouter mock scenarios for more comprehensive AI service testing
