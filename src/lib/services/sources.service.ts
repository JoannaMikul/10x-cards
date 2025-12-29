import type { Tables } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { SourceDTO } from "../../types";
import type { SourcesQuery } from "../validation/sources.schema.ts";
import { escapeIlikePattern } from "../utils/search.ts";

type SourceRow = Tables<"sources">;
type SourceSelect = Pick<
  SourceRow,
  "id" | "name" | "slug" | "description" | "kind" | "url" | "created_at" | "updated_at"
>;

const SOURCE_COLUMNS = "id, name, slug, description, kind, url, created_at, updated_at" as const;

export interface ListSourcesResult {
  items: SourceDTO[];
  hasMore: boolean;
  nextCursorId: number | null;
}

export async function listSources(supabase: SupabaseClient, query: SourcesQuery): Promise<ListSourcesResult> {
  if (!query || typeof query !== "object") {
    throw new Error("Invalid query parameters: query must be an object");
  }

  if (query.limit <= 0 || query.limit > 1000) {
    throw new Error("Invalid limit: must be between 1 and 1000");
  }

  if (query.cursor !== undefined && (typeof query.cursor !== "number" || query.cursor <= 0)) {
    throw new Error("Invalid cursor: must be a positive number");
  }

  if (query.search && typeof query.search !== "string") {
    throw new Error("Invalid search: must be a string");
  }

  let builder = supabase
    .from("sources")
    .select(SOURCE_COLUMNS)
    .order(query.sort, { ascending: true })
    .order("id", { ascending: true });

  if (query.kind) {
    builder = builder.eq("kind", query.kind);
  }

  if (query.search) {
    const pattern = `%${escapeIlikePattern(query.search)}%`;
    builder = builder.or(`name.ilike.${pattern},slug.ilike.${pattern}`);
  }

  if (query.cursor) {
    builder = builder.gt("id", query.cursor);
  }

  const { data, error } = await builder.limit(query.limit + 1);

  if (error) {
    throw new Error(`Failed to fetch sources: ${error.message}`);
  }

  const rows = data ?? [];

  if (!Array.isArray(rows)) {
    throw new Error("Invalid response: data must be an array");
  }

  const hasMore = rows.length > query.limit;
  const limitedRows = hasMore ? rows.slice(0, query.limit) : rows;
  const lastVisibleRow = limitedRows.length > 0 ? limitedRows[limitedRows.length - 1] : null;
  const nextCursorId = hasMore && lastVisibleRow ? lastVisibleRow.id : null;

  return {
    items: limitedRows.map(mapSourceRowToDto),
    hasMore,
    nextCursorId,
  };
}

function mapSourceRowToDto(row: SourceSelect): SourceDTO {
  if (!row || typeof row !== "object") {
    throw new Error("Invalid source row: row must be an object");
  }

  if (!row.id || !row.name || !row.slug) {
    throw new Error("Invalid source row: missing required fields (id, name, slug)");
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    kind: row.kind,
    url: row.url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
