import type { Tables } from "../../db/database.types";

export type FlashcardRow = Tables<"flashcards">;
export type GenerationCandidateRow = Tables<"generation_candidates">;

/**
 * Mock data for flashcards table used in analytics calculations
 */
export const analyticsFlashcardsMocks: FlashcardRow[] = [
  {
    id: "card-1",
    owner_id: "user-1",
    front: "What is TCP?",
    back: "Transmission Control Protocol",
    origin: "ai-full",
    category_id: 1,
    content_source_id: 1,
    metadata: { language: "EN" },
    created_at: "2024-12-20T10:00:00.000Z",
    updated_at: "2024-12-20T10:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "card-2",
    owner_id: "user-1",
    front: "What is HTTP?",
    back: "HyperText Transfer Protocol",
    origin: "ai-edited",
    category_id: 1,
    content_source_id: 1,
    metadata: { language: "EN" },
    created_at: "2024-12-20T11:00:00.000Z",
    updated_at: "2024-12-20T11:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "card-3",
    owner_id: "user-1",
    front: "What is DNS?",
    back: "Domain Name System",
    origin: "manual",
    category_id: 1,
    content_source_id: 1,
    metadata: { language: "EN" },
    created_at: "2024-12-20T12:00:00.000Z",
    updated_at: "2024-12-20T12:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "card-4",
    owner_id: "user-1",
    front: "What is UDP?",
    back: "User Datagram Protocol",
    origin: "manual",
    category_id: 1,
    content_source_id: 1,
    metadata: { language: "EN" },
    created_at: "2024-12-21T10:00:00.000Z",
    updated_at: "2024-12-21T10:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "card-5",
    owner_id: "user-1",
    front: "What is FTP?",
    back: "File Transfer Protocol",
    origin: "ai-full",
    category_id: 1,
    content_source_id: 1,
    metadata: { language: "EN" },
    created_at: "2024-12-21T11:00:00.000Z",
    updated_at: "2024-12-21T11:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "card-6",
    owner_id: "user-1",
    front: "What is SMTP?",
    back: "Simple Mail Transfer Protocol",
    origin: "ai-edited",
    category_id: 1,
    content_source_id: 1,
    metadata: { language: "EN" },
    created_at: "2024-12-22T10:00:00.000Z",
    updated_at: "2024-12-22T10:00:00.000Z",
    deleted_at: null,
  },
];

/**
 * Mock data for generation_candidates table used in AI acceptance rate calculations
 */
export const analyticsGenerationCandidatesMocks: GenerationCandidateRow[] = [
  {
    id: "candidate-1",
    generation_id: "gen-1",
    owner_id: "user-1",
    status: "accepted",
    front: "What is TCP?",
    back: "Transmission Control Protocol",
    front_back_fingerprint: "fingerprint-1",
    suggested_category_id: 1,
    suggested_tags: ["networking"],
    accepted_card_id: "card-1",
    created_at: "2024-12-20T09:00:00.000Z",
    updated_at: "2024-12-20T09:30:00.000Z",
  },
  {
    id: "candidate-2",
    generation_id: "gen-2",
    owner_id: "user-1",
    status: "accepted",
    front: "What is HTTP?",
    back: "HyperText Transfer Protocol",
    front_back_fingerprint: "fingerprint-2",
    suggested_category_id: 1,
    suggested_tags: ["networking"],
    accepted_card_id: "card-2",
    created_at: "2024-12-20T10:30:00.000Z",
    updated_at: "2024-12-20T11:00:00.000Z",
  },
  {
    id: "candidate-3",
    generation_id: "gen-3",
    owner_id: "user-1",
    status: "proposed",
    front: "What is UDP?",
    back: "User Datagram Protocol",
    front_back_fingerprint: "fingerprint-3",
    suggested_category_id: 1,
    suggested_tags: ["networking"],
    accepted_card_id: null,
    created_at: "2024-12-21T09:00:00.000Z",
    updated_at: "2024-12-21T09:00:00.000Z",
  },
  {
    id: "candidate-4",
    generation_id: "gen-4",
    owner_id: "user-1",
    status: "accepted",
    front: "What is FTP?",
    back: "File Transfer Protocol",
    front_back_fingerprint: "fingerprint-4",
    suggested_category_id: 1,
    suggested_tags: ["networking"],
    accepted_card_id: "card-5",
    created_at: "2024-12-21T10:30:00.000Z",
    updated_at: "2024-12-21T11:00:00.000Z",
  },
  {
    id: "candidate-5",
    generation_id: "gen-5",
    owner_id: "user-1",
    status: "accepted",
    front: "What is SMTP?",
    back: "Simple Mail Transfer Protocol",
    front_back_fingerprint: "fingerprint-5",
    suggested_category_id: 1,
    suggested_tags: ["networking"],
    accepted_card_id: "card-6",
    created_at: "2024-12-22T09:30:00.000Z",
    updated_at: "2024-12-22T10:00:00.000Z",
  },
];

/**
 * Mock data for empty scenarios (no data)
 */
export const analyticsEmptyMocks = {
  flashcards: [] as FlashcardRow[],
  generationCandidates: [] as GenerationCandidateRow[],
};

/**
 * Mock data for error scenarios
 */
export const analyticsErrorMocks = {
  dbError: { message: "Database connection failed" },
  invalidDateError: { message: "Invalid date format" },
};
