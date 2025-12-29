import "@testing-library/jest-dom";
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// extends Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
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
