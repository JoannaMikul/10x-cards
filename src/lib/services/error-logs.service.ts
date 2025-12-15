import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { TablesInsert } from "../../db/database.types.ts";

type GenerationErrorLogInsert = TablesInsert<"generation_error_logs">;

export type GenerationErrorLogPayload = Pick<
  GenerationErrorLogInsert,
  "user_id" | "model" | "error_code" | "error_message" | "source_text_hash" | "source_text_length"
>;

/**
 * Best-effort logging for generation errors – logs to console only since database logging requires admin permissions.
 * This prevents RLS policy violations when called by regular users.
 */
export async function logGenerationError(supabase: SupabaseClient, payload: GenerationErrorLogPayload): Promise<void> {
  // Log to console instead of database to avoid RLS policy violations for regular users
  // eslint-disable-next-line no-console
  console.error("[generation] Error occurred", {
    userId: payload.user_id,
    model: payload.model,
    errorCode: payload.error_code,
    errorMessage: payload.error_message,
    sourceHash: payload.source_text_hash,
    sourceLength: payload.source_text_length,
  });
}
