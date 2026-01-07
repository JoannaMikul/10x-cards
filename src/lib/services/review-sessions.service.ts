import { supermemo } from "supermemo";

import type { Json, Tables, Enums } from "../../db/database.types";
import type { SupabaseClient } from "../../db/supabase.client";
import type {
  CreateReviewSessionCommand,
  ReviewEventListResponse,
  ReviewStatsListResponse,
  FlashcardDTO,
  ReviewSessionConfig,
  FlashcardSelectionState,
} from "../../types";
import type { ReviewEventsQuery, ReviewStatsQuery } from "../validation/review-sessions.schema";
import { REVIEW_ERROR_CODES } from "../errors";

type ReviewEventRow = Tables<"review_events">;
type ReviewStatsRow = Tables<"review_stats">;

type ReviewOutcome = Enums<"review_outcome">;

interface ReviewStatsItem {
  interval: number;
  repetition: number;
  efactor: number;
}

const DEFAULT_EFACTOR = 2.5;
const DEFAULT_PAGINATION_LIMIT = 20;
const SUPERMEMO_DEFAULT_ITEM = { interval: 0, repetition: 0, efactor: DEFAULT_EFACTOR } as const;
const PAGINATION_OVERFETCH = 1;

export class ReviewCardNotFoundError extends Error {
  readonly code = REVIEW_ERROR_CODES.CARD_NOT_FOUND;

  constructor(message = "One or more cards not found or not owned by user.") {
    super(message);
    this.name = "ReviewCardNotFoundError";
  }
}

export class ReviewUnauthorizedError extends Error {
  readonly code = REVIEW_ERROR_CODES.UNAUTHORIZED;

  constructor(message = "Unauthorized to review cards.") {
    super(message);
    this.name = "ReviewUnauthorizedError";
  }
}

/**
 * Maps review outcome to SuperMemo grade (0-5 scale)
 */
function mapOutcomeToGrade(outcome: ReviewOutcome): number {
  switch (outcome) {
    case "again":
      return 0; // Complete blackout
    case "fail":
      return 1; // Incorrect response; the correct one remembered
    case "hard":
      return 2; // Incorrect response; where the correct one seemed easy to recall
    case "good":
      return 3; // Correct response recalled with serious difficulty
    case "easy":
      return 4; // Correct response after a hesitation
    default:
      throw new Error(`Unknown review outcome: ${outcome}`);
  }
}

/**
 * Converts review stats row to SuperMemo item format
 */
function reviewStatsToSuperMemoItem(stats: ReviewStatsRow): ReviewStatsItem {
  return {
    interval: stats.last_interval_days ?? 0,
    repetition: stats.consecutive_successes,
    efactor: DEFAULT_EFACTOR,
  };
}

/**
 * Fetches current review stats for all cards in the session
 */
async function fetchReviewStatsBatch(
  supabase: SupabaseClient,
  userId: string,
  cardIds: string[]
): Promise<Record<string, ReviewStatsRow>> {
  const { data, error } = await supabase.from("review_stats").select("*").eq("user_id", userId).in("card_id", cardIds);

  if (error) {
    throw error;
  }

  const statsMap: Record<string, ReviewStatsRow> = {};
  for (const stat of data) {
    statsMap[stat.card_id] = stat;
  }

  return statsMap;
}

/**
 * Validates that all cards in the session belong to the user
 */
async function validateCardOwnership(supabase: SupabaseClient, userId: string, cardIds: string[]): Promise<void> {
  const { data, error } = await supabase
    .from("flashcards")
    .select("id")
    .eq("owner_id", userId)
    .in("id", cardIds)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const foundCardIds = new Set(data.map((card) => card.id));
  const missingCards = cardIds.filter((id) => !foundCardIds.has(id));

  if (missingCards.length > 0) {
    throw new ReviewCardNotFoundError(`Cards not found or not owned by user: ${missingCards.join(", ")}`);
  }
}

/**
 * Processes a single review entry and returns the review event data
 */
function processReviewEntry(
  cardId: string,
  reviewEntry: CreateReviewSessionCommand["reviews"][0],
  statsMap: Record<string, ReviewStatsRow>
): Omit<ReviewEventRow, "id" | "user_id" | "reviewed_at"> {
  const currentStats = statsMap[cardId];

  const superMemoItem = currentStats ? reviewStatsToSuperMemoItem(currentStats) : SUPERMEMO_DEFAULT_ITEM;

  const grade = mapOutcomeToGrade(reviewEntry.outcome);
  const updatedItem = supermemo(superMemoItem, grade as 0 | 1 | 2 | 3 | 4 | 5);

  return {
    card_id: cardId,
    outcome: reviewEntry.outcome,
    response_time_ms: reviewEntry.response_time_ms ?? null,
    prev_interval_days: reviewEntry.prev_interval_days ?? currentStats?.last_interval_days ?? null,
    next_interval_days: updatedItem.interval,
    was_learning_step: reviewEntry.was_learning_step ?? false,
    payload: reviewEntry.payload as Json,
  };
}

/**
 * Inserts review events in batch
 */
async function insertReviewEventsBatch(
  supabase: SupabaseClient,
  userId: string,
  reviewEvents: Omit<ReviewEventRow, "id" | "user_id" | "reviewed_at">[]
): Promise<void> {
  const eventsToInsert = reviewEvents.map((event) => ({
    ...event,
    user_id: userId,
    reviewed_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("review_events").insert(eventsToInsert);

  if (error) {
    throw error;
  }
}

export async function createReviewSession(
  supabase: SupabaseClient,
  userId: string,
  command: CreateReviewSessionCommand
): Promise<{ logged: number }> {
  const { reviews } = command;

  if (reviews.length === 0) {
    return { logged: 0 };
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  const cardIds = [...new Set(reviews.map((review) => review.card_id))];

  await validateCardOwnership(supabase, userId, cardIds);

  for (const review of reviews) {
    if (!review.card_id || !review.outcome) {
      throw new Error(`Invalid review entry: missing card_id or outcome`);
    }
    if (!["again", "fail", "hard", "good", "easy"].includes(review.outcome)) {
      throw new Error(`Invalid review outcome: ${review.outcome}`);
    }
  }

  try {
    const statsMap = await fetchReviewStatsBatch(supabase, userId, cardIds);
    const reviewEvents = reviews.map((review) => processReviewEntry(review.card_id, review, statsMap));

    await insertReviewEventsBatch(supabase, userId, reviewEvents);

    return { logged: reviews.length };
  } catch (error) {
    // Log error for debugging (in production you'd use a proper logging service)
    // eslint-disable-next-line no-console
    console.error("Failed to create review session:", error);
    throw error;
  }
}

export async function getReviewEvents(
  supabase: SupabaseClient,
  userId: string,
  query: ReviewEventsQuery
): Promise<ReviewEventListResponse> {
  const { card_id, from, to, limit = DEFAULT_PAGINATION_LIMIT, cursor } = query;

  let dbQuery = supabase
    .from("review_events")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(limit + PAGINATION_OVERFETCH);

  if (card_id) {
    dbQuery = dbQuery.eq("card_id", card_id);
  }

  if (from) {
    dbQuery = dbQuery.gte("reviewed_at", from);
  }

  if (to) {
    dbQuery = dbQuery.lte("reviewed_at", to);
  }

  if (cursor) {
    dbQuery = dbQuery.lt("reviewed_at", cursor);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      data: [],
      page: {
        next_cursor: null,
        has_more: false,
      },
    };
  }

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].reviewed_at : null;

  return {
    data: items,
    page: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

export async function getReviewStats(
  supabase: SupabaseClient,
  userId: string,
  query: ReviewStatsQuery
): Promise<ReviewStatsListResponse> {
  const { card_id, next_review_before, limit = DEFAULT_PAGINATION_LIMIT, cursor } = query;

  let dbQuery = supabase
    .from("review_stats")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("next_review_at", { ascending: true })
    .limit(limit + PAGINATION_OVERFETCH);

  if (card_id) {
    dbQuery = dbQuery.eq("card_id", card_id);
  }

  if (next_review_before) {
    dbQuery = dbQuery.lt("next_review_at", next_review_before);
  }

  if (cursor) {
    dbQuery = dbQuery.gt("next_review_at", cursor);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      data: [],
      page: {
        next_cursor: null,
        has_more: false,
      },
    };
  }

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].next_review_at : null;

  return {
    data: items,
    page: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

interface ReviewSessionParams {
  cardIds?: string;
  mode?: "all" | string;
  q?: string;
  categoryId?: string;
  sourceId?: string;
  tagIds?: string;
  origin?: "manual" | "ai-full" | "ai-edited" | string;
  showDeleted?: "true" | "false" | string;
  sort?: string;
}

interface FilteredCardsQuery {
  supabase: SupabaseClient;
  userId: string;
  params: ReviewSessionParams;
  cardIds?: string[];
  showDeleted?: boolean;
}

/**
 * Validates review session parameters
 */
function validateReviewSessionParams(params: ReviewSessionParams): void {
  // Validate cardIds format
  if (params.cardIds) {
    const cardIds = params.cardIds.split(",").filter((id) => id.trim().length > 0);
    if (cardIds.length === 0) {
      throw new Error("cardIds parameter cannot be empty when provided");
    }
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of cardIds) {
      if (!uuidRegex.test(id.trim())) {
        throw new Error(`Invalid card ID format: ${id}`);
      }
    }
  }

  // Validate numeric parameters
  if (params.categoryId && isNaN(parseInt(params.categoryId))) {
    throw new Error("categoryId must be a valid number");
  }

  if (params.sourceId && isNaN(parseInt(params.sourceId))) {
    throw new Error("sourceId must be a valid number");
  }

  // Validate tagIds format
  if (params.tagIds) {
    const tagIds = params.tagIds.split(",").filter((id) => id.trim().length > 0);
    for (const id of tagIds) {
      if (isNaN(parseInt(id.trim()))) {
        throw new Error(`Invalid tag ID format: ${id}`);
      }
    }
  }

  // Validate origin
  if (params.origin && !["manual", "ai-full", "ai-edited"].includes(params.origin)) {
    throw new Error(`Invalid origin value: ${params.origin}`);
  }
}

/**
 * Applies common filtering logic to flashcards query
 */
function applyFlashcardFilters(
  query: ReturnType<SupabaseClient["from"]>,
  params: ReviewSessionParams,
  cardIds?: string[],
  showDeleted = false
): ReturnType<SupabaseClient["from"]> {
  if (cardIds && cardIds.length > 0) {
    query = query.in("id", cardIds);
  }

  const searchQuery = params.q?.trim();
  if (searchQuery) {
    query = query.or(`front.ilike.%${searchQuery}%,back.ilike.%${searchQuery}%`);
  }

  const categoryId = params.categoryId;
  if (categoryId) {
    query = query.eq("category_id", parseInt(categoryId));
  }

  const sourceId = params.sourceId;
  if (sourceId) {
    query = query.eq("content_source_id", parseInt(sourceId));
  }

  const tagIdsParam = params.tagIds;
  if (tagIdsParam && cardIds) {
    const tagIds = tagIdsParam
      .split(",")
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));

    if (tagIds.length > 0) {
      query = query.in("id", cardIds); // This will be filtered later with tag intersection
    }
  }

  const origin = params.origin;
  if (origin && ["manual", "ai-full", "ai-edited"].includes(origin)) {
    query = query.eq("origin", origin as "manual" | "ai-full" | "ai-edited");
  }

  if (showDeleted) {
    query = query.neq("deleted_at", null);
  } else {
    query = query.is("deleted_at", null);
  }

  const sort = params.sort || "-created_at";
  const [column, direction] = sort.startsWith("-") ? [sort.slice(1), "desc" as const] : [sort, "asc" as const];
  query = query.order(column, { ascending: direction === "asc" });

  return query;
}

/**
 * Fetches filtered flashcards with common filtering logic
 */
async function fetchFilteredFlashcards({
  supabase,
  userId,
  params,
  cardIds,
  showDeleted = false,
}: FilteredCardsQuery): Promise<FlashcardDTO[]> {
  let query = supabase
    .from("flashcards")
    .select(
      "id, front, back, origin, metadata, category_id, content_source_id, owner_id, created_at, updated_at, deleted_at"
    )
    .eq("owner_id", userId);

  // Apply tag filtering separately if needed
  let finalCardIds = cardIds;
  const tagIdsParam = params.tagIds;
  if (tagIdsParam && cardIds) {
    const tagIds = tagIdsParam
      .split(",")
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));

    if (tagIds.length > 0) {
      const { data: cardTagData } = await supabase.from("card_tags").select("card_id").in("tag_id", tagIds);

      const filteredCardIds = cardTagData?.map((row) => row.card_id) ?? [];
      finalCardIds = cardIds.filter((id) => filteredCardIds.includes(id));
    }
  }

  query = applyFlashcardFilters(query, params, finalCardIds, showDeleted);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapToFlashcardDTO);
}

interface FlashcardRow {
  id: string;
  front: string;
  back: string;
  origin: string;
  metadata: Json;
  category_id: number | null;
  content_source_id: number | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapToFlashcardDTO(row: FlashcardRow): FlashcardDTO {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    origin: row.origin as FlashcardDTO["origin"],
    metadata: row.metadata,
    category_id: row.category_id,
    content_source_id: row.content_source_id,
    owner_id: row.owner_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    tags: [],
  };
}

export async function prepareReviewSession(
  supabase: SupabaseClient,
  userId: string,
  params: ReviewSessionParams
): Promise<ReviewSessionConfig> {
  validateReviewSessionParams(params);

  const cardIdsParam = params.cardIds;

  if (cardIdsParam) {
    const cardIds = cardIdsParam.split(",").filter((id) => id.trim().length > 0);
    if (cardIds.length === 0) {
      return { cards: [] };
    }

    const cards = await fetchFilteredFlashcards({
      supabase,
      userId,
      params,
      cardIds,
      showDeleted: false,
    });

    if (cards.length === 0) {
      throw new Error(
        "No flashcards found with the provided IDs. They may have been deleted or you don't have access to them."
      );
    }

    const selection: FlashcardSelectionState = {
      mode: "manual",
      selectedIds: cardIds,
    };

    return { cards, selection };
  } else {
    const showAllCards = params.mode === "all";

    const { data: reviewStatsData, error: reviewStatsError } = await supabase
      .from("review_stats")
      .select("card_id")
      .eq("user_id", userId)
      .lte("next_review_at", new Date().toISOString());

    if (reviewStatsError) {
      throw reviewStatsError;
    }

    const cardIdsForReview = (reviewStatsData ?? []).map((stat) => stat.card_id);

    if (cardIdsForReview.length > 0 && !showAllCards) {
      const showDeleted = params.showDeleted === "true";
      const cards = await fetchFilteredFlashcards({
        supabase,
        userId,
        params,
        cardIds: cardIdsForReview,
        showDeleted,
      });

      const selection: FlashcardSelectionState = {
        mode: "due-for-review",
        selectedIds: [],
      };

      return { cards, selection };
    } else {
      const showDeleted = params.showDeleted === "true";
      const cards = await fetchFilteredFlashcards({
        supabase,
        userId,
        params,
        showDeleted,
      });

      const selection: FlashcardSelectionState = {
        mode: showAllCards ? "all-cards" : "due-for-review-fallback",
        selectedIds: [],
      };

      return { cards, selection };
    }
  }
}
