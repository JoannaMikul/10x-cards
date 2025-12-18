import type { Json, Tables, TablesInsert, Enums } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";

type SupabaseQueryBuilder = ReturnType<SupabaseClient["from"]>;
import type { CreateFlashcardCommand, FlashcardDTO, TagDTO, FlashcardAggregatesDTO } from "../../types";
import { FLASHCARD_ERROR_CODES } from "../errors.ts";
import type { FlashcardsQuery } from "../validation/flashcards.schema.ts";
import { encodeBase64 } from "../utils/base64.ts";

type FlashcardReferenceErrorCode =
  | typeof FLASHCARD_ERROR_CODES.CATEGORY_NOT_FOUND
  | typeof FLASHCARD_ERROR_CODES.SOURCE_NOT_FOUND
  | typeof FLASHCARD_ERROR_CODES.TAG_NOT_FOUND;

type FlashcardRow = Tables<"flashcards">;
type TagRow = Tables<"tags">;
const FLASHCARD_COLUMNS =
  "id, front, back, origin, metadata, category_id, content_source_id, owner_id, created_at, updated_at, deleted_at, front_back_fingerprint";

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
  // Best-effort rollback; swallow errors to avoid masking the root cause.
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

// List flashcards functionality
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
  const queryBuilder = supabase.from("flashcards").select(FLASHCARD_COLUMNS).eq("owner_id", userId);

  applyFlashcardsFilters(queryBuilder, query);
  applyFlashcardsSortingAndCursor(queryBuilder, query);
  queryBuilder.limit(query.limit + 1); // +1 to detect has_more

  const { data: rows, error } = await queryBuilder;
  if (error) {
    throw error;
  }

  const hasMore = rows && rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : (rows ?? []);

  // Fetch tags for all flashcards in batch
  const cardIds = items.map((item) => item.id);
  const tagsByCardId = cardIds.length > 0 ? await fetchTagsForCards(supabase, cardIds) : new Map();

  // Map to DTOs
  const flashcards = items.map((row) => mapFlashcardRowToDto(row, tagsByCardId.get(row.id) ?? []));

  // Generate next cursor
  const nextCursor = hasMore && items.length > 0 ? generateCursor(items[items.length - 1], query.sort) : null;

  // Compute aggregates
  const aggregates = await computeFlashcardAggregates(supabase, userId, query);

  return {
    items: flashcards,
    hasMore,
    nextCursor,
    aggregates,
  };
}

function applyFlashcardsFilters(queryBuilder: SupabaseQueryBuilder, query: FlashcardsQuery): void {
  // Always filter out deleted records unless explicitly requested
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
    queryBuilder.in("card_tags.tag_id", query.tagIds);
  }

  if (query.search) {
    const searchTerm = escapeSearchTerm(query.search);
    queryBuilder.or(`front.ilike.%${searchTerm}%,back.ilike.%${searchTerm}%`);
  }
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

  // Apply cursor-based pagination
  if (cursor) {
    const operator = ascending ? "gt" : "lt";
    const altOperator = ascending ? "gte" : "lte";

    if (orderColumn === "review_stats.next_review_at") {
      // Special handling for next_review_at with LEFT JOIN
      queryBuilder.or(
        `and(review_stats.next_review_at.${operator}.${cursor.createdAt},id.${altOperator}.${cursor.id}),review_stats.next_review_at.${operator}.${cursor.createdAt}`
      );
    } else {
      queryBuilder.or(
        `and(${orderColumn}.${operator}.${cursor.createdAt},id.${altOperator}.${cursor.id}),${orderColumn}.${operator}.${cursor.createdAt}`
      );
    }
  }

  // Apply sorting
  if (orderColumn === "review_stats.next_review_at") {
    queryBuilder.order("review_stats.next_review_at", { ascending, nullsFirst });
  } else {
    queryBuilder.order(orderColumn, { ascending });
  }

  // Tie-breaker for deterministic ordering
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

async function computeFlashcardAggregates(
  supabase: SupabaseClient,
  userId: string,
  query: FlashcardsQuery
): Promise<FlashcardAggregatesDTO> {
  const baseQuery = supabase.from("flashcards").select("origin", { count: "exact", head: true }).eq("owner_id", userId);

  // Apply same filters as main query (except search)
  if (!query.includeDeleted) {
    baseQuery.is("deleted_at", null);
  }

  if (query.categoryId) {
    baseQuery.eq("category_id", query.categoryId);
  }

  if (query.contentSourceId) {
    baseQuery.eq("content_source_id", query.contentSourceId);
  }

  if (query.tagIds && query.tagIds.length > 0) {
    baseQuery.in("card_tags.tag_id", query.tagIds);
  }

  // Get total count
  const { count: total } = await baseQuery;

  // Get counts by origin - we need separate queries for each origin
  const origins: Enums<"card_origin">[] = ["ai-full", "ai-edited", "manual"];
  const byOrigin: Partial<Record<Enums<"card_origin">, number>> = {};

  for (const origin of origins) {
    const { count } = await baseQuery.eq("origin", origin);
    if (count && count > 0) {
      byOrigin[origin] = count;
    }
  }

  return {
    total: total ?? 0,
    by_origin: byOrigin,
  };
}

function escapeSearchTerm(term: string): string {
  // Escape special characters for PostgreSQL ilike
  return term.replace(/[%_]/g, "\\$&");
}
