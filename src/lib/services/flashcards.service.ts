import type { PostgrestError } from "@supabase/supabase-js";

import type { Json, Tables, TablesInsert, TablesUpdate, Enums } from "../../db/database.types";
import type { SupabaseClient } from "../../db/supabase.client";

type SupabaseQueryBuilder = ReturnType<SupabaseClient["from"]>;
import type {
  CreateFlashcardCommand,
  UpdateFlashcardCommand,
  FlashcardDTO,
  TagDTO,
  FlashcardAggregatesDTO,
  ReviewStatsSnapshotDTO,
  SetFlashcardTagsCommand,
} from "../../types";
import { FLASHCARD_ERROR_CODES } from "../errors";
import type { FlashcardsQuery } from "../validation/flashcards.schema";
import { encodeBase64 } from "../utils/base64";

type FlashcardReferenceErrorCode =
  | typeof FLASHCARD_ERROR_CODES.CATEGORY_NOT_FOUND
  | typeof FLASHCARD_ERROR_CODES.SOURCE_NOT_FOUND
  | typeof FLASHCARD_ERROR_CODES.TAG_NOT_FOUND
  | typeof FLASHCARD_ERROR_CODES.NOT_FOUND;

type FlashcardRow = Tables<"flashcards">;
type TagRow = Tables<"tags">;
const FLASHCARD_COLUMNS =
  "id, front, back, origin, metadata, category_id, content_source_id, owner_id, created_at, updated_at, deleted_at, front_back_fingerprint";
const SOFT_DELETE_FLASHCARD_RPC = "soft_delete_flashcard";
const RESTORE_FLASHCARD_RPC = "restore_flashcard";
const SET_FLASHCARD_TAGS_RPC = "set_flashcard_tags";
type RpcInvoker = (
  fn: string,
  params?: Record<string, unknown>
) => Promise<{ data: unknown; error: PostgrestError | null }>;

interface FlashcardInsertResult {
  id: FlashcardRow["id"];
}

export class FlashcardReferenceError extends Error {
  readonly code: FlashcardReferenceErrorCode;
  readonly details?: Json;

  constructor(code: FlashcardReferenceErrorCode, message: string, details?: Json) {
    super(message);
    this.name = "FlashcardReferenceError";
    this.code = code;
    this.details = details;
  }
}

export class FlashcardNotFoundError extends Error {
  constructor(message = "Flashcard not found.") {
    super(message);
    this.name = "FlashcardNotFoundError";
  }
}

export class FlashcardUnauthorizedError extends Error {
  constructor(message = "Not authorized to restore flashcards.") {
    super(message);
    this.name = "FlashcardUnauthorizedError";
  }
}

export async function createFlashcard(
  supabase: SupabaseClient,
  userId: string,
  payload: CreateFlashcardCommand
): Promise<FlashcardDTO> {
  await validateReferences(supabase, payload);

  const insertResult = await insertFlashcard(supabase, userId, payload);

  try {
    if (payload.tag_ids && payload.tag_ids.length > 0) {
      await upsertCardTags(supabase, insertResult.id, payload.tag_ids);
    }
  } catch (error) {
    await cleanupFailedInsert(supabase, insertResult.id);
    throw error;
  }

  const tags = await fetchTagsForCard(supabase, insertResult.id);
  const row = await fetchFlashcardRow(supabase, insertResult.id);

  return mapFlashcardRowToDto(row, tags);
}

async function validateReferences(supabase: SupabaseClient, payload: CreateFlashcardCommand): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (payload.category_id) {
    tasks.push(ensureCategoryExists(supabase, payload.category_id));
  }

  if (payload.content_source_id) {
    tasks.push(ensureContentSourceExists(supabase, payload.content_source_id));
  }

  const tagIds = payload.tag_ids ?? [];
  if (tagIds.length > 0) {
    tasks.push(ensureTagsExist(supabase, tagIds));
  }

  await Promise.all(tasks);
}

async function ensureCategoryExists(supabase: SupabaseClient, categoryId: number): Promise<void> {
  const { count, error } = await supabase
    .from("categories")
    .select("id", { head: true, count: "exact" })
    .eq("id", categoryId);

  if (error) {
    throw error;
  }

  if (!count) {
    throw new FlashcardReferenceError(
      FLASHCARD_ERROR_CODES.CATEGORY_NOT_FOUND,
      `Category ${categoryId} does not exist.`,
      {
        category_id: categoryId,
      }
    );
  }
}

async function ensureContentSourceExists(supabase: SupabaseClient, sourceId: number): Promise<void> {
  const { count, error } = await supabase
    .from("sources")
    .select("id", { head: true, count: "exact" })
    .eq("id", sourceId);

  if (error) {
    throw error;
  }

  if (!count) {
    throw new FlashcardReferenceError(
      FLASHCARD_ERROR_CODES.SOURCE_NOT_FOUND,
      `Content source ${sourceId} does not exist.`,
      {
        content_source_id: sourceId,
      }
    );
  }
}

async function ensureFlashcardAccessible(supabase: SupabaseClient, userId: string, cardId: string): Promise<void> {
  const { count, error } = await supabase
    .from("flashcards")
    .select("id", { head: true, count: "exact" })
    .eq("id", cardId)
    .eq("owner_id", userId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  if (!count) {
    throw new FlashcardReferenceError(FLASHCARD_ERROR_CODES.NOT_FOUND, "Flashcard not found.", {
      card_id: cardId,
    });
  }
}

async function ensureTagsExist(supabase: SupabaseClient, tagIds: number[]): Promise<void> {
  const { data, error } = await supabase.from("tags").select("id").in("id", tagIds).order("id", { ascending: true });

  if (error) {
    throw error;
  }

  const foundIds = new Set((data ?? []).map((row) => row.id));
  const missing = tagIds.filter((tagId) => !foundIds.has(tagId));

  if (missing.length > 0) {
    throw new FlashcardReferenceError(FLASHCARD_ERROR_CODES.TAG_NOT_FOUND, "One or more tags do not exist.", {
      missing_tag_ids: missing,
    });
  }
}

async function insertFlashcard(
  supabase: SupabaseClient,
  userId: string,
  payload: CreateFlashcardCommand
): Promise<FlashcardInsertResult> {
  const insertPayload: TablesInsert<"flashcards"> = {
    owner_id: userId,
    front: payload.front,
    back: payload.back,
    origin: payload.origin,
    metadata: payload.metadata ?? null,
    category_id: payload.category_id ?? null,
    content_source_id: payload.content_source_id ?? null,
  };

  const { data, error } = await supabase.from("flashcards").insert(insertPayload).select("id").single();

  if (error || !data) {
    throw error ?? new Error("Failed to insert flashcard.");
  }

  return { id: data.id };
}

async function upsertCardTags(supabase: SupabaseClient, cardId: string, tagIds: number[]): Promise<void> {
  const payload: TablesInsert<"card_tags">[] = tagIds.map((tagId) => ({
    card_id: cardId,
    tag_id: tagId,
  }));

  const { error } = await supabase.from("card_tags").insert(payload);

  if (error) {
    throw error;
  }
}

async function cleanupFailedInsert(supabase: SupabaseClient, cardId: string): Promise<void> {
  await supabase.from("flashcards").delete().eq("id", cardId);
}

async function fetchFlashcardRow(supabase: SupabaseClient, cardId: string): Promise<FlashcardRow> {
  const { data, error } = await supabase
    .from("flashcards")
    .select(FLASHCARD_COLUMNS)
    .eq("id", cardId)
    .single<FlashcardRow>();

  if (error || !data) {
    throw error ?? new Error("Flashcard not found after insertion.");
  }

  return data;
}

async function fetchTagsForCard(supabase: SupabaseClient, cardId: string): Promise<TagDTO[]> {
  type CardTagWithTag = Tables<"card_tags"> & { tags: TagRow | null };

  const { data, error } = await supabase
    .from("card_tags")
    .select("tags ( id, name, slug, description, created_at, updated_at )")
    .eq("card_id", cardId);

  if (error) {
    throw error;
  }

  const relations = (data ?? []) as CardTagWithTag[];
  return relations
    .map((relation) => relation.tags)
    .filter((tag): tag is TagRow => Boolean(tag))
    .map(mapTagRowToDto);
}

function mapFlashcardRowToDto(row: FlashcardRow, tags: TagDTO[]): FlashcardDTO {
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
    tags,
  };
}

function mapTagRowToDto(row: TagRow): TagDTO {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface ListFlashcardsResult {
  items: FlashcardDTO[];
  hasMore: boolean;
  nextCursor: string | null;
  aggregates: FlashcardAggregatesDTO;
}

export async function listFlashcards(
  supabase: SupabaseClient,
  userId: string,
  query: FlashcardsQuery
): Promise<ListFlashcardsResult> {
  const tagFilteredCardIds =
    query.tagIds && query.tagIds.length > 0 ? await fetchCardIdsByTags(supabase, query.tagIds) : undefined;

  if (query.tagIds && query.tagIds.length > 0 && (tagFilteredCardIds?.length ?? 0) === 0) {
    const aggregates = await computeFlashcardAggregates(supabase, userId, query, {
      tagFilteredCardIds,
    });
    return {
      items: [],
      hasMore: false,
      nextCursor: null,
      aggregates,
    };
  }

  const queryBuilder = supabase.from("flashcards").select(FLASHCARD_COLUMNS).eq("owner_id", userId);

  applyFlashcardsFilters(queryBuilder, query, { tagFilteredCardIds });
  applyFlashcardsSortingAndCursor(queryBuilder, query);
  queryBuilder.limit(query.limit + 1); // +1 to detect has_more

  const { data: rows, error } = await queryBuilder;
  if (error) {
    throw error;
  }

  const hasMore = rows && rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : (rows ?? []);

  const cardIds = items.map((item) => item.id);
  const tagsByCardId = cardIds.length > 0 ? await fetchTagsForCards(supabase, cardIds) : new Map();

  const reviewStatsByCardId =
    cardIds.length > 0 ? await fetchReviewStatsForCards(supabase, userId, cardIds) : new Map();

  const flashcards = items.map((row) => {
    const tags = tagsByCardId.get(row.id) ?? [];
    const reviewStats = reviewStatsByCardId.get(row.id);
    const dto = mapFlashcardRowToDto(row, tags);
    if (reviewStats) {
      dto.review_stats = reviewStats;
    }
    return dto;
  });

  const nextCursor = hasMore && items.length > 0 ? generateCursor(items[items.length - 1], query.sort) : null;

  const aggregates = await computeFlashcardAggregates(supabase, userId, query, {
    tagFilteredCardIds,
  });

  return {
    items: flashcards,
    hasMore,
    nextCursor,
    aggregates,
  };
}

interface FlashcardFilterOptions {
  includeSearch?: boolean;
  tagFilteredCardIds?: string[];
}

function applyFlashcardsFilters(
  queryBuilder: SupabaseQueryBuilder,
  query: FlashcardsQuery,
  options: FlashcardFilterOptions = {}
): void {
  const includeSearch = options.includeSearch ?? true;
  if (!query.includeDeleted) {
    queryBuilder.is("deleted_at", null);
  }

  if (query.categoryId) {
    queryBuilder.eq("category_id", query.categoryId);
  }

  if (query.contentSourceId) {
    queryBuilder.eq("content_source_id", query.contentSourceId);
  }

  if (query.origin) {
    queryBuilder.eq("origin", query.origin);
  }

  if (query.tagIds && query.tagIds.length > 0) {
    const cardIds = options.tagFilteredCardIds;
    if (!cardIds || cardIds.length === 0) {
      queryBuilder.eq("id", "00000000-0000-0000-0000-000000000000");
      return;
    }
    queryBuilder.in("id", cardIds);
  }

  if (includeSearch && query.search) {
    const searchTerm = escapeSearchTerm(query.search);
    queryBuilder.or(`front.ilike.%${searchTerm}%,back.ilike.%${searchTerm}%`);
  }
}

async function fetchCardIdsByTags(supabase: SupabaseClient, tagIds: number[]): Promise<string[]> {
  const { data, error } = await supabase.from("card_tags").select("card_id").in("tag_id", tagIds);

  if (error) {
    throw error;
  }

  const uniqueCardIds = new Set<string>();
  for (const relation of data ?? []) {
    if (relation.card_id) {
      uniqueCardIds.add(relation.card_id);
    }
  }

  return Array.from(uniqueCardIds);
}

function applyFlashcardsSortingAndCursor(queryBuilder: SupabaseQueryBuilder, query: FlashcardsQuery): void {
  const { sort, cursor } = query;

  let orderColumn: string;
  let ascending: boolean;
  let nullsFirst = false;

  switch (sort) {
    case "created_at":
      orderColumn = "created_at";
      ascending = true;
      break;
    case "-created_at":
      orderColumn = "created_at";
      ascending = false;
      break;
    case "updated_at":
      orderColumn = "updated_at";
      ascending = true;
      break;
    case "next_review_at":
      orderColumn = "review_stats.next_review_at";
      ascending = true;
      nullsFirst = true;
      break;
    default:
      orderColumn = "created_at";
      ascending = false;
  }

  if (cursor) {
    const operator = ascending ? "gt" : "lt";
    const altOperator = ascending ? "gte" : "lte";

    if (orderColumn === "review_stats.next_review_at") {
      queryBuilder.or(
        `and(review_stats.next_review_at.${operator}.${cursor.createdAt},id.${altOperator}.${cursor.id}),review_stats.next_review_at.${operator}.${cursor.createdAt}`
      );
    } else {
      queryBuilder.or(
        `and(${orderColumn}.${operator}.${cursor.createdAt},id.${altOperator}.${cursor.id}),${orderColumn}.${operator}.${cursor.createdAt}`
      );
    }
  }

  if (orderColumn === "review_stats.next_review_at") {
    queryBuilder.order("review_stats.next_review_at", { ascending, nullsFirst });
  } else {
    queryBuilder.order(orderColumn, { ascending });
  }

  queryBuilder.order("id", { ascending: true });
}

function generateCursor(lastItem: FlashcardRow, sort: string): string {
  let timestamp: string;

  switch (sort) {
    case "created_at":
    case "-created_at":
      timestamp = lastItem.created_at;
      break;
    case "updated_at":
      timestamp = lastItem.updated_at;
      break;
    case "next_review_at":
      // For next_review_at, we need to get the actual review stats timestamp
      // This would require an additional query, but for simplicity we'll use created_at as fallback
      // In a real implementation, you'd want to fetch the review_stats.next_review_at
      timestamp = lastItem.created_at;
      break;
    default:
      timestamp = lastItem.created_at;
  }

  const cursorValue = `${timestamp}#${lastItem.id}`;
  return encodeBase64(cursorValue);
}

async function fetchTagsForCards(supabase: SupabaseClient, cardIds: string[]): Promise<Map<string, TagDTO[]>> {
  type CardTagWithTag = Tables<"card_tags"> & { tags: TagRow | null };

  const { data, error } = await supabase
    .from("card_tags")
    .select("card_id, tags ( id, name, slug, description, created_at, updated_at )")
    .in("card_id", cardIds);

  if (error) {
    throw error;
  }

  const tagsByCardId = new Map<string, TagDTO[]>();
  const relations = (data ?? []) as CardTagWithTag[];

  for (const relation of relations) {
    if (!relation.tags) continue;

    const cardId = relation.card_id;
    const existingTags = tagsByCardId.get(cardId) ?? [];
    existingTags.push(mapTagRowToDto(relation.tags));
    tagsByCardId.set(cardId, existingTags);
  }

  return tagsByCardId;
}

interface FlashcardAggregatesOptions {
  tagFilteredCardIds?: string[];
}

async function computeFlashcardAggregates(
  supabase: SupabaseClient,
  userId: string,
  query: FlashcardsQuery,
  options: FlashcardAggregatesOptions = {}
): Promise<FlashcardAggregatesDTO> {
  const { tagFilteredCardIds } = options;

  if (tagFilteredCardIds && tagFilteredCardIds.length === 0) {
    return {
      total: 0,
      by_origin: {},
    };
  }

  const buildBaseQuery = () => {
    const builder = supabase.from("flashcards").select("origin", { count: "exact", head: true }).eq("owner_id", userId);

    applyFlashcardsFilters(builder, query, {
      includeSearch: false,
      tagFilteredCardIds,
    });

    return builder;
  };

  const { count: total } = await buildBaseQuery();

  const origins: Enums<"card_origin">[] = ["ai-full", "ai-edited", "manual"];
  const byOrigin: Partial<Record<Enums<"card_origin">, number>> = {};

  const originResults = await Promise.all(
    origins.map(async (origin) => {
      const { count } = await buildBaseQuery().eq("origin", origin);
      return { origin, count: count ?? 0 };
    })
  );

  for (const result of originResults) {
    if (result.count > 0) {
      byOrigin[result.origin] = result.count;
    }
  }

  return {
    total: total ?? 0,
    by_origin: byOrigin,
  };
}

function escapeSearchTerm(term: string): string {
  return term.replace(/[%_]/g, "\\$&");
}

export async function updateFlashcard(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  cmd: UpdateFlashcardCommand
): Promise<FlashcardDTO> {
  const tasks: Promise<void>[] = [];

  if (cmd.category_id !== undefined && cmd.category_id !== null) {
    tasks.push(ensureCategoryExists(supabase, cmd.category_id));
  }

  if (cmd.content_source_id !== undefined && cmd.content_source_id !== null) {
    tasks.push(ensureContentSourceExists(supabase, cmd.content_source_id));
  }

  if (cmd.tag_ids !== undefined) {
    tasks.push(ensureTagsExist(supabase, cmd.tag_ids));
  }

  await Promise.all(tasks);

  const shouldResetStats = cmd.front !== undefined || cmd.back !== undefined;

  const updatePayload: Partial<TablesUpdate<"flashcards">> = {};

  if (cmd.front !== undefined) updatePayload.front = cmd.front;
  if (cmd.back !== undefined) updatePayload.back = cmd.back;
  if (cmd.origin !== undefined) updatePayload.origin = cmd.origin;
  if (cmd.category_id !== undefined) updatePayload.category_id = cmd.category_id;
  if (cmd.content_source_id !== undefined) updatePayload.content_source_id = cmd.content_source_id;
  if (cmd.metadata !== undefined) updatePayload.metadata = cmd.metadata;

  if (cmd.deleted_at !== undefined) {
    updatePayload.deleted_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase.from("flashcards").update(updatePayload).eq("id", cardId);

  if (updateError) {
    throw updateError;
  }

  if (shouldResetStats) {
    await resetReviewStats(supabase, userId, cardId);
  }

  if (cmd.tag_ids !== undefined) {
    await deleteCardTags(supabase, cardId);
    if (cmd.tag_ids.length > 0) {
      await upsertCardTags(supabase, cardId, cmd.tag_ids);
    }
  }

  const [row, tags] = await Promise.all([fetchFlashcardRow(supabase, cardId), fetchTagsForCard(supabase, cardId)]);

  return mapFlashcardRowToDto(row, tags);
}

async function resetReviewStats(supabase: SupabaseClient, userId: string, cardId: string): Promise<void> {
  const { error } = await supabase.from("review_stats").delete().eq("user_id", userId).eq("card_id", cardId);

  if (error) {
    throw error;
  }
}

async function deleteCardTags(supabase: SupabaseClient, cardId: string): Promise<void> {
  const { error } = await supabase.from("card_tags").delete().eq("card_id", cardId);

  if (error) {
    throw error;
  }
}

export async function getFlashcardById(
  supabase: SupabaseClient,
  userId: string,
  cardId: string
): Promise<FlashcardDTO> {
  // Fetch flashcard row with RLS filtering
  const { data: flashcardRow, error: flashcardError } = await supabase
    .from("flashcards")
    .select(FLASHCARD_COLUMNS)
    .eq("id", cardId)
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .single<FlashcardRow>();

  if (flashcardError) {
    throw flashcardError;
  }

  if (!flashcardRow) {
    throw new Error("Flashcard not found");
  }

  // Fetch tags for the flashcard
  const tags = await fetchTagsForCard(supabase, cardId);

  // Fetch review stats snapshot
  const reviewStats = await fetchReviewStatsSnapshot(supabase, userId, cardId);

  // Map to DTO
  const flashcardDto = mapFlashcardRowToDto(flashcardRow, tags);
  flashcardDto.review_stats = reviewStats ?? undefined;

  return flashcardDto;
}

async function fetchReviewStatsForCards(
  supabase: SupabaseClient,
  userId: string,
  cardIds: string[]
): Promise<Map<string, ReviewStatsSnapshotDTO>> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.from("review_stats").select("*").eq("user_id", userId).in("card_id", cardIds);

  if (error) {
    throw error;
  }

  const reviewStatsMap = new Map<string, ReviewStatsSnapshotDTO>();
  if (data) {
    for (const row of data) {
      reviewStatsMap.set(row.card_id, mapReviewStatsRowToDto(row));
    }
  }

  return reviewStatsMap;
}

function mapReviewStatsRowToDto(row: Tables<"review_stats">): ReviewStatsSnapshotDTO {
  return {
    card_id: row.card_id,
    user_id: row.user_id,
    total_reviews: row.total_reviews,
    successes: row.successes,
    consecutive_successes: row.consecutive_successes,
    last_outcome: row.last_outcome,
    last_interval_days: row.last_interval_days,
    next_review_at: row.next_review_at,
    last_reviewed_at: row.last_reviewed_at,
    aggregates: row.aggregates,
  };
}

async function fetchReviewStatsSnapshot(
  supabase: SupabaseClient,
  userId: string,
  cardId: string
): Promise<ReviewStatsSnapshotDTO | undefined> {
  type ReviewStatsRow = Tables<"review_stats">;

  const { data, error } = await supabase
    .from("review_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .single<ReviewStatsRow>();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw error;
  }

  if (!data) {
    return undefined;
  }

  return mapReviewStatsRowToDto(data);
}

export async function softDeleteFlashcard(supabase: SupabaseClient, userId: string, cardId: string): Promise<void> {
  const client = supabase as SupabaseClient & { rpc: RpcInvoker };
  const { error } = await client.rpc(SOFT_DELETE_FLASHCARD_RPC, {
    p_owner_id: userId,
    p_card_id: cardId,
  });

  if (error) {
    if (error.code === "P0001" && error.message === "flashcard_not_found") {
      throw new Error("Flashcard not found");
    }
    throw error;
  }
}

export async function restoreFlashcard(supabase: SupabaseClient, cardId: string): Promise<FlashcardDTO> {
  const client = supabase as SupabaseClient & { rpc: RpcInvoker };
  const { error } = await client.rpc(RESTORE_FLASHCARD_RPC, {
    p_card_id: cardId,
  });

  if (error) {
    if (error.code === "P0001" && error.message === "flashcard_not_found") {
      throw new FlashcardNotFoundError();
    }
    if (error.code === "P0001" && error.message === "not_admin") {
      throw new FlashcardUnauthorizedError();
    }
    throw error;
  }

  const [row, tags] = await Promise.all([fetchFlashcardRow(supabase, cardId), fetchTagsForCard(supabase, cardId)]);
  const reviewStats = await fetchReviewStatsSnapshot(supabase, row.owner_id, cardId);
  const flashcard = mapFlashcardRowToDto(row, tags);

  if (reviewStats) {
    flashcard.review_stats = reviewStats;
  }

  return flashcard;
}

export async function setFlashcardTags(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  cmd: SetFlashcardTagsCommand
): Promise<TagDTO[]> {
  await ensureFlashcardAccessible(supabase, userId, cardId);

  const tagIds = cmd.tag_ids ?? [];
  if (tagIds.length > 0) {
    await ensureTagsExist(supabase, tagIds);
  }

  const client = supabase as SupabaseClient & { rpc: RpcInvoker };
  const { data, error } = await client.rpc(SET_FLASHCARD_TAGS_RPC, {
    p_owner_id: userId,
    p_card_id: cardId,
    p_tag_ids: tagIds,
  });

  if (error) {
    if (error.code === "P0001" && error.message === "flashcard_not_found") {
      throw new FlashcardReferenceError(FLASHCARD_ERROR_CODES.NOT_FOUND, "Flashcard not found.", {
        card_id: cardId,
      });
    }
    throw error;
  }

  const rows = (data ?? []) as TagRow[];
  return rows.map(mapTagRowToDto);
}
