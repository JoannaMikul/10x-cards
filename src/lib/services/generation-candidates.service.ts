import type { Tables } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { GenerationCandidateDTO } from "../../types";
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

const CANDIDATE_COLUMNS =
  "id, generation_id, owner_id, front, back, front_back_fingerprint, status, accepted_card_id, suggested_category_id, suggested_tags, created_at, updated_at";

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
