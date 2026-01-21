import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GenerationsApiClient } from "../generations-api-client";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/setup";

describe("GenerationsApiClient", () => {
  let client: GenerationsApiClient;

  beforeEach(() => {
    client = new GenerationsApiClient();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe("create", () => {
    it("should create a generation", async () => {
      const mockResponse = {
        id: "gen-123",
        status: "pending" as const,
        enqueued_at: "2025-01-21T12:00:00Z",
      };

      server.use(
        http.post("/api/generations", () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const command = {
        model: "openai/gpt-4o",
        sanitized_input_text: "Test input",
        temperature: 0.3,
      };

      const result = await client.create(command);

      expect(result).toEqual(mockResponse);
      expect(result.id).toBe("gen-123");
      expect(result.status).toBe("pending");
    });
  });

  describe("getById", () => {
    it("should get generation details", async () => {
      const mockResponse = {
        generation: {
          id: "gen-123",
          user_id: "user-123",
          model: "openai/gpt-4o",
          status: "succeeded" as const,
          created_at: "2025-01-21T12:00:00Z",
          updated_at: "2025-01-21T12:05:00Z",
        },
        candidates_summary: {
          total: 5,
          by_status: {
            proposed: 3,
            edited: 1,
            accepted: 1,
            rejected: 0,
          },
        },
      };

      server.use(
        http.get("/api/generations/gen-123", () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await client.getById("gen-123");

      expect(result.generation.id).toBe("gen-123");
      expect(result.candidates_summary.total).toBe(5);
    });
  });

  describe("update", () => {
    it("should update generation status", async () => {
      const mockResponse = {
        id: "gen-123",
        user_id: "user-123",
        model: "openai/gpt-4o",
        status: "cancelled" as const,
        created_at: "2025-01-21T12:00:00Z",
        updated_at: "2025-01-21T12:05:00Z",
      };

      server.use(
        http.patch("/api/generations/gen-123", () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const command = { status: "cancelled" as const };
      const result = await client.update("gen-123", command);

      expect(result.status).toBe("cancelled");
    });
  });

  describe("process", () => {
    it("should trigger generation processing", async () => {
      server.use(
        http.post("/api/generations/process", () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      await expect(client.process()).resolves.toBeUndefined();
    });

    it("should use extended timeout for processing", async () => {
      // Mock the internal post method to verify timeout parameter
      interface ClientWithPost {
        post: (...args: unknown[]) => Promise<unknown>;
      }
      const postSpy = vi.spyOn(client as unknown as ClientWithPost, "post");
      postSpy.mockResolvedValue(undefined);

      await client.process();

      // Verify that the extended timeout is passed
      expect(postSpy).toHaveBeenCalledWith("/generations/process", undefined, {
        timeout: 240000, // 4 minutes (240 seconds)
      });

      postSpy.mockRestore();
    });

    it("should handle processing errors", async () => {
      server.use(
        http.post("/api/generations/process", () => {
          return HttpResponse.json(
            {
              error: {
                code: "processing_failed",
                message: "Failed to process generation",
              },
            },
            { status: 500 }
          );
        })
      );

      await expect(client.process()).rejects.toThrow();
    });
  });
});
