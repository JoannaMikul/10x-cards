import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { TablesInsert } from "../../db/database.types.ts";

type GenerationErrorLogInsert = TablesInsert<"generation_error_logs">;

export type GenerationErrorLogPayload = Pick<
  GenerationErrorLogInsert,
  "user_id" | "model" | "error_code" | "error_message" | "source_text_hash" | "source_text_length"
>;

/**
 * Best-effort logging for generation errors – never throws even if logging fails.
 */
export async function logGenerationError(supabase: SupabaseClient, payload: GenerationErrorLogPayload): Promise<void> {
  const { error } = await supabase.from("generation_error_logs").insert(payload);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[generation] Failed to write error log", {
      code: error.code,
      message: error.message,
    });
  }
}
