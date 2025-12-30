import type { GenerationRecord } from "../../services/generations.service";

/**
 * Mock data for generation projection service testing
 *
 * Contains sample GenerationRecord objects used in unit tests
 * for the projectGeneration function.
 */

export const mockGenerationRecords: GenerationRecord[] = [
  {
    id: "gen-12345678-1234-1234-1234-123456789abc",
    user_id: "user-12345678-1234-1234-1234-123456789abc",
    model: "gpt-4",
    status: "succeeded",
    temperature: 0.7,
    prompt_tokens: 150,
    sanitized_input_length: 500,
    sanitized_input_sha256: "abc123def456789012345678901234567890",
    sanitized_input_text: "Explain the concept of machine learning algorithms.",
    started_at: "2025-01-01T10:00:00.000Z",
    completed_at: "2025-01-01T10:05:00.000Z",
    created_at: "2025-01-01T09:00:00.000Z",
    updated_at: "2025-01-01T10:05:00.000Z",
    error_code: null,
    error_message: null,
  },
  {
    id: "gen-87654321-4321-4321-4321-cba987654321",
    user_id: "user-87654321-4321-4321-4321-cba987654321",
    model: "claude-3-haiku",
    status: "running",
    temperature: null,
    prompt_tokens: null,
    sanitized_input_length: 300,
    sanitized_input_sha256: "def456ghi789012345678901234567890",
    sanitized_input_text: "What are the benefits of TypeScript?",
    started_at: "2025-01-01T11:00:00.000Z",
    completed_at: null,
    created_at: "2025-01-01T10:30:00.000Z",
    updated_at: "2025-01-01T11:15:00.000Z",
    error_code: null,
    error_message: null,
  },
  {
    id: "gen-failed-1234-5678-9012-345678901234",
    user_id: "user-failed-1234-5678-9012-345678901234",
    model: "gpt-3.5-turbo",
    status: "failed",
    temperature: 0.5,
    prompt_tokens: 75,
    sanitized_input_length: 200,
    sanitized_input_sha256: "ghi789jkl012345678901234567890",
    sanitized_input_text: "Invalid input that causes failure",
    started_at: "2025-01-01T12:00:00.000Z",
    completed_at: "2025-01-01T12:01:00.000Z",
    created_at: "2025-01-01T11:45:00.000Z",
    updated_at: "2025-01-01T12:01:00.000Z",
    error_code: "INVALID_INPUT",
    error_message: "The input provided was invalid",
  },
];

/**
 * Expected projected responses for the mock generation records above
 */
export const mockProjectedGenerations = [
  {
    id: "gen-12345678-1234-1234-1234-123456789abc",
    model: "gpt-4",
    status: "succeeded",
    temperature: 0.7,
    prompt_tokens: 150,
    sanitized_input_length: 500,
    sanitized_input_text: "Explain the concept of machine learning algorithms.",
    started_at: "2025-01-01T10:00:00.000Z",
    completed_at: "2025-01-01T10:05:00.000Z",
    created_at: "2025-01-01T09:00:00.000Z",
    updated_at: "2025-01-01T10:05:00.000Z",
    error_code: null,
    error_message: null,
  },
  {
    id: "gen-87654321-4321-4321-4321-cba987654321",
    model: "claude-3-haiku",
    status: "running",
    temperature: null,
    prompt_tokens: null,
    sanitized_input_length: 300,
    sanitized_input_text: "What are the benefits of TypeScript?",
    started_at: "2025-01-01T11:00:00.000Z",
    completed_at: null,
    created_at: "2025-01-01T10:30:00.000Z",
    updated_at: "2025-01-01T11:15:00.000Z",
    error_code: null,
    error_message: null,
  },
  {
    id: "gen-failed-1234-5678-9012-345678901234",
    model: "gpt-3.5-turbo",
    status: "failed",
    temperature: 0.5,
    prompt_tokens: 75,
    sanitized_input_length: 200,
    sanitized_input_text: "Invalid input that causes failure",
    started_at: "2025-01-01T12:00:00.000Z",
    completed_at: "2025-01-01T12:01:00.000Z",
    created_at: "2025-01-01T11:45:00.000Z",
    updated_at: "2025-01-01T12:01:00.000Z",
    error_code: "INVALID_INPUT",
    error_message: "The input provided was invalid",
  },
];
