import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BaseApiClient, ApiClientError } from "../base-api-client";
import type { ApiErrorResponse } from "../../../types";

class TestApiClient extends BaseApiClient {
  // Expose protected methods for testing
  public testGet<T>(path: string, options?: Parameters<typeof this.get>[1]) {
    return this.get<T>(path, options);
  }

  public testPost<T, B>(path: string, body?: B, options?: Parameters<typeof this.post>[2]) {
    return this.post<T, B>(path, body, options);
  }

  public testPatch<T, B>(path: string, body?: B, options?: Parameters<typeof this.patch>[2]) {
    return this.patch<T, B>(path, body, options);
  }

  public testDelete<T>(path: string, options?: Parameters<typeof this.delete>[1]) {
    return this.delete<T>(path, options);
  }
}

describe("BaseApiClient", () => {
  let client: TestApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new TestApiClient("/api", 5000);
    mockFetch = vi.fn();
    global.fetch = mockFetch as typeof global.fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET requests", () => {
    it("should make successful GET request", async () => {
      const mockData = { id: "1", name: "Test" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Headers(),
      });

      const result = await client.testGet<typeof mockData>("/test");

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/test"),
        expect.objectContaining({
          method: "GET",
        })
      );
    });

    it("should handle query parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      });

      await client.testGet("/test", {
        params: { search: "query", limit: 10 },
      });

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("search=query"), expect.anything());
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=10"), expect.anything());
    });

    it("should handle array parameters (tag_ids[])", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      });

      await client.testGet("/test", {
        params: { tag_ids: ["1", "2", "3"] },
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(decodeURIComponent(url)).toContain("tag_ids[]=1");
      expect(decodeURIComponent(url)).toContain("tag_ids[]=2");
      expect(decodeURIComponent(url)).toContain("tag_ids[]=3");
    });
  });

  describe("POST requests", () => {
    it("should make successful POST request with body", async () => {
      const requestBody = { name: "Test", value: 123 };
      const responseData = { id: "created-id", ...requestBody };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseData,
        headers: new Headers(),
      });

      const result = await client.testPost<typeof responseData, typeof requestBody>("/test", requestBody);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/test"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestBody),
        })
      );
    });

    it("should set Content-Type header for POST with body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      });

      await client.testPost("/test", { data: "value" });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("Error handling", () => {
    it("should throw ApiClientError on 401 and redirect to login", async () => {
      // Mock window.location to track href changes
      let currentHref = "";
      const mockLocation = {
        ...window.location,
        set href(value: string) {
          currentHref = value;
        },
        get href() {
          return currentHref;
        },
        pathname: "/",
        search: "",
        origin: "http://localhost:3000",
      };

      vi.stubGlobal("location", mockLocation);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: "unauthorized", message: "Unauthorized" },
        }),
      });

      await expect(client.testGet("/test")).rejects.toThrow(ApiClientError);
      expect(currentHref).toContain("/auth/login");

      vi.restoreAllMocks();
    });

    it("should parse and throw API error response", async () => {
      const apiError: ApiErrorResponse = {
        error: {
          code: "not_found",
          message: "Resource not found",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => apiError,
        headers: new Headers(),
      });

      await expect(client.testGet("/test")).rejects.toThrow(ApiClientError);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => apiError,
        headers: new Headers(),
      });

      try {
        await client.testGet("/test");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError);
        expect((error as ApiClientError).code).toBe("not_found");
        expect((error as ApiClientError).statusCode).toBe(404);
      }
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));

      await expect(client.testGet("/test")).rejects.toThrow(ApiClientError);
      try {
        await client.testGet("/test");
      } catch (error) {
        expect((error as ApiClientError).code).toBe("network_error");
      }
    });

    it("should handle timeout errors", async () => {
      // Create an AbortController and abort it immediately to simulate timeout
      const controller = new AbortController();
      controller.abort();

      // Mock fetch to reject with AbortError (simulating timeout)
      mockFetch.mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"));

      const timeoutPromise = client.testGet("/test", { timeout: 100 });

      await expect(timeoutPromise).rejects.toThrow(ApiClientError);

      try {
        await timeoutPromise;
      } catch (error) {
        expect((error as ApiClientError).code).toBe("timeout_error");
        expect((error as ApiClientError).message).toBe("Request timeout");
      }
    });
  });

  describe("ApiClientError", () => {
    it("should create error from ApiErrorResponse", () => {
      const apiError: ApiErrorResponse = {
        error: {
          code: "validation_error",
          message: "Invalid input",
          details: { field: "email" },
        },
      };

      const error = ApiClientError.fromApiErrorResponse(apiError, 400);

      expect(error).toBeInstanceOf(ApiClientError);
      expect(error.code).toBe("validation_error");
      expect(error.message).toBe("Invalid input");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: "email" });
    });

    it("should create network error", () => {
      const error = ApiClientError.network("Connection failed");

      expect(error.code).toBe("network_error");
      expect(error.message).toBe("Connection failed");
    });

    it("should create timeout error", () => {
      const error = ApiClientError.timeout();

      expect(error.code).toBe("timeout_error");
      expect(error.message).toBe("Request timeout");
    });

    it("should convert to ApiErrorResponse", () => {
      const error = new ApiClientError("Test error", "test_code", 500, { info: "details" });
      const apiError = error.toApiErrorResponse();

      expect(apiError).toEqual({
        error: {
          code: "test_code",
          message: "Test error",
          details: { info: "details" },
        },
      });
    });
  });

  describe("Response handling", () => {
    it("should handle 204 No Content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      const result = await client.testDelete("/test");

      expect(result).toEqual({});
    });

    it("should handle empty response with Content-Length 0", async () => {
      const headers = new Headers();
      headers.set("Content-Length", "0");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
      });

      const result = await client.testPost("/test");

      expect(result).toEqual({});
    });
  });
});
