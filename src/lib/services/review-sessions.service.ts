import { supermemo } from "supermemo";

import type { Json, Tables, Enums } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { CreateReviewSessionCommand, ReviewEventListResponse, ReviewStatsListResponse } from "../../types";
import type { ReviewEventsQuery, ReviewStatsQuery } from "../validation/review-sessions.schema.ts";
import { REVIEW_ERROR_CODES } from "../errors.ts";

type ReviewEventRow = Tables<"review_events">;
type ReviewStatsRow = Tables<"review_stats">;

type ReviewOutcome = Enums<"review_outcome">;

interface ReviewStatsItem {
  interval: number;
  repetition: number;
  efactor: number;
}

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
    efactor: 2.5, // Default efactor if not stored, though it should be in aggregates
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

  // Convert array to map for easy lookup
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

  // Check if all requested cards were found
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

  // Get current SuperMemo state
  const superMemoItem = currentStats
    ? reviewStatsToSuperMemoItem(currentStats)
    : { interval: 0, repetition: 0, efactor: 2.5 };

  // Map outcome to grade and apply SuperMemo algorithm
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

  // Extract unique card IDs
  const cardIds = [...new Set(reviews.map((review) => review.card_id))];

  // Validate card ownership (fail-fast)
  await validateCardOwnership(supabase, userId, cardIds);

  // Fetch current review stats for all cards
  const statsMap = await fetchReviewStatsBatch(supabase, userId, cardIds);

  // Process each review entry
  const reviewEvents = reviews.map((review) => processReviewEntry(review.card_id, review, statsMap));

  // Insert review events (this will trigger the sync_review_stats function)
  await insertReviewEventsBatch(supabase, userId, reviewEvents);

  return { logged: reviews.length };
}

export async function getReviewEvents(
  supabase: SupabaseClient,
  userId: string,
  query: ReviewEventsQuery
): Promise<ReviewEventListResponse> {
  const { card_id, from, to, limit = 20, cursor } = query;

  // Build the base query with RLS filtering (user_id is handled by RLS)
  let dbQuery = supabase
    .from("review_events")
    .select("*", { count: "exact" })
    .eq("user_id", userId) // Explicit filter for safety, though RLS should handle this
    .order("reviewed_at", { ascending: false })
    .limit(limit + 1); // Fetch one extra to determine if there are more results

  // Apply optional filters
  if (card_id) {
    dbQuery = dbQuery.eq("card_id", card_id);
  }

  if (from) {
    dbQuery = dbQuery.gte("reviewed_at", from);
  }

  if (to) {
    dbQuery = dbQuery.lte("reviewed_at", to);
  }

  // Apply cursor-based pagination
  if (cursor) {
    // For cursor pagination, we need to use the reviewed_at from the cursor
    // Since we're ordering by reviewed_at DESC, we want events before the cursor
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

  // Check if there are more results
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  // Generate next cursor from the last item
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
  const { card_id, next_review_before, limit = 20, cursor } = query;

  // Build the base query with RLS filtering (user_id is handled by RLS)
  let dbQuery = supabase
    .from("review_stats")
    .select("*", { count: "exact" })
    .eq("user_id", userId) // Explicit filter for safety, though RLS should handle this
    .order("next_review_at", { ascending: true })
    .limit(limit + 1); // Fetch one extra to determine if there are more results

  // Apply optional filters
  if (card_id) {
    dbQuery = dbQuery.eq("card_id", card_id);
  }

  if (next_review_before) {
    dbQuery = dbQuery.lt("next_review_at", next_review_before);
  }

  // Apply cursor-based pagination
  if (cursor) {
    // For cursor pagination, we need to use the next_review_at from the cursor
    // Since we're ordering by next_review_at ASC, we want stats after the cursor
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

  // Check if there are more results
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  // Generate next cursor from the last item
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].next_review_at : null;

  return {
    data: items,
    page: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}
