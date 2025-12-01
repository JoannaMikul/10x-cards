import type { Tables } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { TagDTO } from "../../types";
import type { TagsQuery } from "../validation/tags.schema.ts";

type TagRow = Tables<"tags">;
type TagSelect = Pick<TagRow, "id" | "name" | "slug" | "description" | "created_at" | "updated_at">;

const TAG_COLUMNS = "id, name, slug, description, created_at, updated_at";

export interface ListTagsResult {
  items: TagDTO[];
  hasMore: boolean;
  nextCursorId: number | null;
}

export async function listTags(supabase: SupabaseClient, query: TagsQuery): Promise<ListTagsResult> {
  let builder = supabase
    .from("tags")
    .select(TAG_COLUMNS)
    .order(query.sort, { ascending: true })
    .order("id", { ascending: true });

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
    items: limitedRows.map(mapTagRowToDto),
    hasMore,
    nextCursorId,
  };
}

function mapTagRowToDto(row: TagSelect): TagDTO {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,");
}
