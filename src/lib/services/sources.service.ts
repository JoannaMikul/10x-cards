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

const SOURCE_COLUMNS = "id, name, slug, description, kind, url, created_at, updated_at";

export interface ListSourcesResult {
  items: SourceDTO[];
  hasMore: boolean;
  nextCursorId: number | null;
}

export async function listSources(supabase: SupabaseClient, query: SourcesQuery): Promise<ListSourcesResult> {
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
    throw error;
  }

  const rows = data ?? [];
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
