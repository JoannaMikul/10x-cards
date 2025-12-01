import type { Tables } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { CategoryDTO } from "../../types";
import type { CategoriesQuery } from "../validation/categories.schema.ts";

type CategoryRow = Tables<"categories">;
type CategorySelect = Pick<CategoryRow, "id" | "name" | "slug" | "description" | "color" | "created_at" | "updated_at">;

const CATEGORY_COLUMNS = "id, name, slug, description, color, created_at, updated_at";

export interface ListCategoriesResult {
  items: CategoryDTO[];
  hasMore: boolean;
  nextCursorId: number | null;
}

export async function listCategories(supabase: SupabaseClient, query: CategoriesQuery): Promise<ListCategoriesResult> {
  let builder = supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
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
    items: limitedRows.map(mapCategoryRowToDto),
    hasMore,
    nextCursorId,
  };
}

function mapCategoryRowToDto(row: CategorySelect): CategoryDTO {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,");
}
