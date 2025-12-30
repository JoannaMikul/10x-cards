import { describe, it, expect } from "vitest";
import { projectGeneration } from "../generation-projection.service";
import type { GenerationRecord } from "../generations.service";

describe("generation-projection.service", () => {
  describe("projectGeneration", () => {
    it("should project all required fields from GenerationRecord", () => {
      const mockGeneration: GenerationRecord = {
        id: "test-generation-id",
        user_id: "test-user-id",
        model: "gpt-4",
        status: "succeeded",
        temperature: 0.7,
        prompt_tokens: 150,
        sanitized_input_length: 500,
        sanitized_input_sha256: "abc123hash",
        sanitized_input_text: "Test input text",
        started_at: "2025-01-01T10:00:00Z",
        completed_at: "2025-01-01T10:05:00Z",
        created_at: "2025-01-01T09:00:00Z",
        updated_at: "2025-01-01T10:05:00Z",
        error_code: null,
        error_message: null,
      };

      const result = projectGeneration(mockGeneration);

      expect(result).toEqual({
        id: "test-generation-id",
        model: "gpt-4",
        status: "succeeded",
        temperature: 0.7,
        prompt_tokens: 150,
        sanitized_input_length: 500,
        sanitized_input_text: "Test input text",
        started_at: "2025-01-01T10:00:00Z",
        completed_at: "2025-01-01T10:05:00Z",
        created_at: "2025-01-01T09:00:00Z",
        updated_at: "2025-01-01T10:05:00Z",
        error_code: null,
        error_message: null,
      });
    });

    it("should handle null values correctly", () => {
      const mockGeneration: GenerationRecord = {
        id: "test-generation-id",
        user_id: "test-user-id",
        model: "gpt-4",
        status: "running",
        temperature: null,
        prompt_tokens: null,
        sanitized_input_length: 300,
        sanitized_input_sha256: "def456hash",
        sanitized_input_text: "Another test input",
        started_at: "2025-01-01T11:00:00Z",
        completed_at: null,
        created_at: "2025-01-01T10:30:00Z",
        updated_at: "2025-01-01T11:15:00Z",
        error_code: null,
        error_message: null,
      };

      const result = projectGeneration(mockGeneration);

      expect(result).toEqual({
        id: "test-generation-id",
        model: "gpt-4",
        status: "running",
        temperature: null,
        prompt_tokens: null,
        sanitized_input_length: 300,
        sanitized_input_text: "Another test input",
        started_at: "2025-01-01T11:00:00Z",
        completed_at: null,
        created_at: "2025-01-01T10:30:00Z",
        updated_at: "2025-01-01T11:15:00Z",
        error_code: null,
        error_message: null,
      });
    });

    it("should handle error states correctly", () => {
      const mockGeneration: GenerationRecord = {
        id: "test-generation-id",
        user_id: "test-user-id",
        model: "claude-3",
        status: "failed",
        temperature: 0.5,
        prompt_tokens: 75,
        sanitized_input_length: 200,
        sanitized_input_sha256: "ghi789hash",
        sanitized_input_text: "Error test input",
        started_at: "2025-01-01T12:00:00Z",
        completed_at: "2025-01-01T12:01:00Z",
        created_at: "2025-01-01T11:45:00Z",
        updated_at: "2025-01-01T12:01:00Z",
        error_code: "INVALID_INPUT",
        error_message: "The input provided was invalid",
      };

      const result = projectGeneration(mockGeneration);

      expect(result).toEqual({
        id: "test-generation-id",
        model: "claude-3",
        status: "failed",
        temperature: 0.5,
        prompt_tokens: 75,
        sanitized_input_length: 200,
        sanitized_input_text: "Error test input",
        started_at: "2025-01-01T12:00:00Z",
        completed_at: "2025-01-01T12:01:00Z",
        created_at: "2025-01-01T11:45:00Z",
        updated_at: "2025-01-01T12:01:00Z",
        error_code: "INVALID_INPUT",
        error_message: "The input provided was invalid",
      });
    });

    it("should exclude sensitive fields from the projection", () => {
      const mockGeneration: GenerationRecord = {
        id: "test-generation-id",
        user_id: "sensitive-user-id",
        model: "gpt-3.5-turbo",
        status: "pending",
        temperature: 0.8,
        prompt_tokens: 50,
        sanitized_input_length: 100,
        sanitized_input_sha256: "sensitive-hash",
        sanitized_input_text: "Test content",
        started_at: null,
        completed_at: null,
        created_at: "2025-01-01T13:00:00Z",
        updated_at: "2025-01-01T13:00:00Z",
        error_code: null,
        error_message: null,
      };

      const result = projectGeneration(mockGeneration);

      expect(result).not.toHaveProperty("user_id");
      expect(result).not.toHaveProperty("sanitized_input_sha256");

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("temperature");
      expect(result).toHaveProperty("prompt_tokens");
      expect(result).toHaveProperty("sanitized_input_length");
      expect(result).toHaveProperty("sanitized_input_text");
      expect(result).toHaveProperty("started_at");
      expect(result).toHaveProperty("completed_at");
      expect(result).toHaveProperty("created_at");
      expect(result).toHaveProperty("updated_at");
      expect(result).toHaveProperty("error_code");
      expect(result).toHaveProperty("error_message");
    });
  });
});
