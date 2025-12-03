import type { PostgrestError } from "@supabase/supabase-js";

import type { Tables } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import type {
  AcceptGenerationCandidateCommand,
  FlashcardDTO,
  GenerationCandidateDTO,
  TagDTO,
  UpdateGenerationCandidateCommand,
} from "../../types";
import type { GenerationCandidatesQuery } from "../validation/generation-candidates.schema.ts";

type GenerationCandidateRow = Tables<"generation_candidates">;
type GenerationCandidateProjection = Pick<
  GenerationCandidateRow,
  | "id"
  | "generation_id"
  | "owner_id"
  | "front"
  | "back"
  | "front_back_fingerprint"
  | "status"
  | "accepted_card_id"
  | "suggested_category_id"
  | "suggested_tags"
  | "created_at"
  | "updated_at"
>;

type FlashcardRow = Tables<"flashcards">;
type CardTagRow = Tables<"card_tags">;
type TagRow = Tables<"tags">;

const CANDIDATE_COLUMNS =
  "id, generation_id, owner_id, front, back, front_back_fingerprint, status, accepted_card_id, suggested_category_id, suggested_tags, created_at, updated_at";
const FLASHCARD_COLUMNS =
  "id, front, back, origin, metadata, category_id, content_source_id, owner_id, created_at, updated_at, deleted_at";
const ACCEPT_CANDIDATE_RPC = "accept_generation_candidate";
const EDITABLE_CANDIDATE_STATUSES = ["proposed", "edited"] as const;

type UpdateCandidatePayload = UpdateGenerationCandidateCommand & { updated_at: string };

type UnsafeRpc = (
  fn: string,
  args?: Record<string, unknown>
) => Promise<{
  data: unknown;
  error: PostgrestError | null;
}>;

export interface ListGenerationCandidatesResult {
  items: GenerationCandidateDTO[];
  hasMore: boolean;
  nextCursorId: string | null;
}

export async function listGenerationCandidates(
  supabase: SupabaseClient,
  userId: string,
  query: GenerationCandidatesQuery
): Promise<ListGenerationCandidatesResult> {
  let builder = supabase
    .from("generation_candidates")
    .select(CANDIDATE_COLUMNS)
    .eq("owner_id", userId)
    .eq("generation_id", query.generationId)
    .order("id", { ascending: true });

  if (query.statuses && query.statuses.length > 0) {
    builder = builder.in("status", query.statuses);
  }

  if (query.cursor) {
    builder = builder.gt("id", query.cursor);
  }

  const { data, error } = await builder.limit(query.limit + 1);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const hasMore = rows.length > query.limit;
  const limitedRows = hasMore ? rows.slice(0, query.limit) : rows;
  const lastVisibleRow = limitedRows.length > 0 ? limitedRows[limitedRows.length - 1] : null;
  const nextCursorId = hasMore && lastVisibleRow ? lastVisibleRow.id : null;

  return {
    items: limitedRows.map(mapCandidateToDto),
    hasMore,
    nextCursorId,
  };
}

export async function updateCandidateForOwner(
  supabase: SupabaseClient,
  userId: string,
  candidateId: string,
  payload: UpdateCandidatePayload
): Promise<GenerationCandidateDTO | null> {
  const { data, error } = await supabase
    .from("generation_candidates")
    .update(payload)
    .eq("owner_id", userId)
    .eq("id", candidateId)
    .in("status", EDITABLE_CANDIDATE_STATUSES)
    .select(CANDIDATE_COLUMNS)
    .maybeSingle<GenerationCandidateProjection>();

  if (error) {
    throw error;
  }

  return data ? mapCandidateToDto(data) : null;
}

function mapCandidateToDto(row: GenerationCandidateProjection): GenerationCandidateDTO {
  return {
    id: row.id,
    generation_id: row.generation_id,
    owner_id: row.owner_id,
    front: row.front,
    back: row.back,
    front_back_fingerprint: row.front_back_fingerprint,
    status: row.status,
    accepted_card_id: row.accepted_card_id,
    suggested_category_id: row.suggested_category_id,
    suggested_tags: row.suggested_tags,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getCandidateForOwner(
  supabase: SupabaseClient,
  userId: string,
  candidateId: string
): Promise<GenerationCandidateProjection | null> {
  const { data, error } = await supabase
    .from("generation_candidates")
    .select(CANDIDATE_COLUMNS)
    .eq("owner_id", userId)
    .eq("id", candidateId)
    .maybeSingle<GenerationCandidateProjection>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function hasFingerprintConflict(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("flashcards")
    .select("id", { head: true, count: "exact" })
    .eq("owner_id", userId)
    .eq("front_back_fingerprint", fingerprint)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  return Boolean(count && count > 0);
}

interface CandidateAcceptanceMetadata {
  accepted_from_candidate_id: string;
  generation_id: string;
  candidate_fingerprint: string;
}

interface CandidateAcceptancePayload {
  origin: "ai-full" | "ai-edited";
  category_id: number | null;
  content_source_id: number | null;
  tag_ids: number[];
  metadata: CandidateAcceptanceMetadata;
}

type AcceptCandidateRpcResult = { new_card_id?: string; card_id?: string; id?: string } | string | null;

export async function acceptCandidateForOwner(
  supabase: SupabaseClient,
  userId: string,
  candidate: GenerationCandidateProjection,
  overrides: AcceptGenerationCandidateCommand = {}
): Promise<FlashcardDTO> {
  const payload = buildAcceptancePayload(candidate, overrides);

  const { data, error } = await (supabase as SupabaseClient & { rpc: UnsafeRpc }).rpc(ACCEPT_CANDIDATE_RPC, {
    p_owner_id: userId,
    p_candidate_id: candidate.id,
    p_origin: payload.origin,
    p_category_id: payload.category_id,
    p_tag_ids: payload.tag_ids,
    p_content_source_id: payload.content_source_id,
    p_metadata: payload.metadata,
  });

  if (error) {
    throw error;
  }

  const flashcardId = extractFlashcardId(data as AcceptCandidateRpcResult | null);
  return fetchFlashcardDto(supabase, flashcardId);
}

function buildAcceptancePayload(
  candidate: GenerationCandidateProjection,
  overrides: AcceptGenerationCandidateCommand
): CandidateAcceptancePayload {
  const generationId = candidate.generation_id;
  const fingerprint = candidate.front_back_fingerprint;

  if (!generationId) {
    throw new Error("Generation candidate is missing generation reference.");
  }

  if (!fingerprint) {
    throw new Error("Generation candidate is missing fingerprint data.");
  }

  const tagIds =
    overrides.tag_ids ?? (Array.isArray(candidate.suggested_tags) ? normalizeTagIds(candidate.suggested_tags) : []);

  return {
    origin: resolveOrigin(overrides.origin, candidate.status),
    category_id: overrides.category_id ?? candidate.suggested_category_id ?? null,
    content_source_id: overrides.content_source_id ?? null,
    tag_ids: tagIds,
    metadata: {
      accepted_from_candidate_id: candidate.id,
      generation_id: generationId,
      candidate_fingerprint: fingerprint,
    },
  };
}

function resolveOrigin(
  overrideOrigin: AcceptGenerationCandidateCommand["origin"] | undefined,
  candidateStatus: GenerationCandidateProjection["status"]
): CandidateAcceptancePayload["origin"] {
  if (overrideOrigin === "ai-full" || overrideOrigin === "ai-edited") {
    return overrideOrigin;
  }

  return candidateStatus === "edited" ? "ai-edited" : "ai-full";
}

function normalizeTagIds(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const numericValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isInteger(value) && value > 0
  );

  return Array.from(new Set(numericValues));
}

function extractFlashcardId(result: AcceptCandidateRpcResult): string {
  if (!result) {
    throw new Error("accept_generation_candidate RPC did not return a flashcard identifier.");
  }

  if (typeof result === "string") {
    return result;
  }

  const id = result.new_card_id ?? result.card_id ?? result.id;
  if (!id) {
    throw new Error("accept_generation_candidate RPC returned an unexpected payload.");
  }

  return id;
}

async function fetchFlashcardDto(supabase: SupabaseClient, cardId: string): Promise<FlashcardDTO> {
  const [row, tags] = await Promise.all([fetchFlashcardRow(supabase, cardId), fetchTagsForCard(supabase, cardId)]);
  return mapFlashcardRowToDto(row, tags);
}

async function fetchFlashcardRow(supabase: SupabaseClient, cardId: string): Promise<FlashcardRow> {
  const { data, error } = await supabase
    .from("flashcards")
    .select(FLASHCARD_COLUMNS)
    .eq("id", cardId)
    .single<FlashcardRow>();

  if (error || !data) {
    throw error ?? new Error("Flashcard not found after acceptance.");
  }

  return data;
}

async function fetchTagsForCard(supabase: SupabaseClient, cardId: string): Promise<TagDTO[]> {
  type CardTagWithTag = CardTagRow & { tags: TagRow | null };

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
