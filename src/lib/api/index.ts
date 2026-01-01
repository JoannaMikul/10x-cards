/**
 * API Clients for frontend HTTP communication
 *
 * This module provides type-safe HTTP clients for interacting with backend API endpoints.
 * All clients extend BaseApiClient which provides:
 * - Centralized error handling
 * - Automatic authentication redirects
 * - Request timeout management
 * - Response parsing and validation
 */

export { BaseApiClient, ApiClientError } from "./base-api-client";
export type { ApiRequestOptions } from "./base-api-client";

export { FlashcardsApiClient, flashcardsApiClient } from "./flashcards-api-client";
export { GenerationsApiClient, generationsApiClient } from "./generations-api-client";
export { GenerationCandidatesApiClient, generationCandidatesApiClient } from "./generation-candidates-api-client";
