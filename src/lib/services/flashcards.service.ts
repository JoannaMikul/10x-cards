import type { Json, Tables, TablesInsert } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { CreateFlashcardCommand, FlashcardDTO, TagDTO } from "../../types";
import { FLASHCARD_ERROR_CODES } from "../errors.ts";

type FlashcardReferenceErrorCode =
  | typeof FLASHCARD_ERROR_CODES.CATEGORY_NOT_FOUND
  | typeof FLASHCARD_ERROR_CODES.SOURCE_NOT_FOUND
  | typeof FLASHCARD_ERROR_CODES.TAG_NOT_FOUND;

type FlashcardRow = Tables<"flashcards">;
type TagRow = Tables<"tags">;
const FLASHCARD_COLUMNS =
  "id, front, back, origin, metadata, category_id, content_source_id, owner_id, created_at, updated_at, deleted_at";

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
