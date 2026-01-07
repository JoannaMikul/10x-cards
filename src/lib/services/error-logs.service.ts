import type { SupabaseClient } from "../../db/supabase.client";
import type { Tables, TablesInsert } from "../../db/database.types";
import type { GenerationErrorLogDTO } from "../../types";
import type { GenerationErrorLogsQuery } from "../validation/generation-error-logs.schema";

type GenerationErrorLogInsert = TablesInsert<"generation_error_logs">;

export type GenerationErrorLogPayload = Pick<
  GenerationErrorLogInsert,
  "user_id" | "model" | "error_code" | "error_message" | "source_text_hash" | "source_text_length"
>;

export async function logGenerationError(supabase: SupabaseClient, payload: GenerationErrorLogPayload): Promise<void> {
  try {
    const { error } = await supabase.from("generation_error_logs").insert(payload);

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[generation] Failed to log error to database:", error);
    }

    // Also log to console for debugging
    // eslint-disable-next-line no-console
    console.error("[generation] Error occurred", {
      userId: payload.user_id,
      model: payload.model,
      errorCode: payload.error_code,
      errorMessage: payload.error_message,
      sourceHash: payload.source_text_hash,
      sourceLength: payload.source_text_length,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[generation] Unexpected error while logging generation error:", error);
  }
}

type GenerationErrorLogRow = Tables<"generation_error_logs">;
type GenerationErrorLogSelect = Pick<
  GenerationErrorLogRow,
  "id" | "user_id" | "model" | "error_code" | "error_message" | "source_text_hash" | "source_text_length" | "created_at"
>;

const GENERATION_ERROR_LOG_COLUMNS =
  "id, user_id, model, error_code, error_message, source_text_hash, source_text_length, created_at";

export interface ListGenerationErrorLogsResult {
  items: GenerationErrorLogDTO[];
  hasMore: boolean;
  nextCursorId: string | null;
}

export async function getGenerationErrorLogs(
  supabase: SupabaseClient,
  query: GenerationErrorLogsQuery & { limit: number }
): Promise<ListGenerationErrorLogsResult> {
  let builder = supabase
    .from("generation_error_logs")
    .select(GENERATION_ERROR_LOG_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (query.user_id) {
    builder = builder.eq("user_id", query.user_id);
  }

  if (query.model) {
    builder = builder.eq("model", query.model);
  }

  if (query.from) {
    builder = builder.gte("created_at", query.from);
  }

  if (query.to) {
    builder = builder.lte("created_at", query.to);
  }

  if (query.cursor) {
    builder = builder.lt("created_at", query.cursor);
  }

  const { data, error } = await builder.limit(query.limit + 1);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const hasMore = rows.length > query.limit;
  const limitedRows = hasMore ? rows.slice(0, query.limit) : rows;
  const lastVisibleRow = limitedRows.length > 0 ? limitedRows[limitedRows.length - 1] : null;
  const nextCursorId = hasMore && lastVisibleRow ? lastVisibleRow.created_at : null;

  return {
    items: limitedRows.map(mapGenerationErrorLogRowToDto),
    hasMore,
    nextCursorId,
  };
}

function mapGenerationErrorLogRowToDto(row: GenerationErrorLogSelect): GenerationErrorLogDTO {
  return {
    id: row.id,
    user_id: row.user_id,
    model: row.model,
    error_code: row.error_code,
    error_message: row.error_message,
    source_text_hash: row.source_text_hash,
    source_text_length: row.source_text_length,
    created_at: row.created_at,
  };
}
