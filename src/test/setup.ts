import "@testing-library/jest-dom";
import { expect, afterEach, beforeAll, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { setupServer } from "msw/node";
import { apiMockHandlers } from "../lib/mocks/msw-handlers";

// extends Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Setup MSW server with default API mocks
// This server is automatically started for all tests and provides basic API mocking
export const server = setupServer(...apiMockHandlers);

// Start MSW server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: "warn", // Warn about unhandled requests instead of error
  });
});

// Reset handlers after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Close server after all tests
afterAll(() => {
  server.close();
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: readonly number[] = [];

  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};
