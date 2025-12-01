import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { TablesInsert, Enums } from "../../db/database.types.ts";
import type { CreateGenerationCommand } from "../../types";

const CONTROL_CHAR_REGEX = /\p{Cc}/gu;
const NEWLINE_REGEX = /\r\n?/g;
const MULTISPACE_REGEX = /[ \t]{2,}/g;
const MULTIBLANK_REGEX = /\n{3,}/g;
const PENDING_STATUS: Enums<"generation_status"> = "pending";

export interface StartGenerationResult {
  id: string;
  created_at: string;
}

/**
 * Idempotently sanitizes the source text by normalizing new lines, removing
 * control characters and collapsing excessive whitespace without changing
 * the meaning of the content.
 */
export function sanitizeSourceText(input: string): string {
  if (!input) {
    return "";
  }

  const normalizedNewlines = input.replace(NEWLINE_REGEX, "\n");
  const withoutControl = normalizedNewlines.replace(CONTROL_CHAR_REGEX, "");
  const collapsedSpaces = withoutControl.replace(MULTISPACE_REGEX, " ");
  const collapsedBlankLines = collapsedSpaces.replace(MULTIBLANK_REGEX, "\n\n");

  return collapsedBlankLines.trim();
}

/**
 * Inserts a new generation in pending status and returns the minimal data
 * required to confirm that the job has been enqueued.
 */
export async function startGeneration(
  supabase: SupabaseClient,
  userId: string,
  payload: CreateGenerationCommand
): Promise<StartGenerationResult> {
  //Temporarily short-circuit logGenerationError and startGeneration when import.meta.env.MODE !== "production". This bypasses Supabase RLS while authentication is still under development, so we can keep exercising the API locally without loosening database policies. Remove the guard once Supabase Auth (or service-role clients) is wired up.
  if (import.meta.env.MODE !== "production") {
    // Bypass DB writes in non-production environments until auth/RLS is configured.
    return {
      id: `dev-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
  }

  const insertPayload: TablesInsert<"generations"> = {
    user_id: userId,
    status: PENDING_STATUS,
    model: payload.model,
    sanitized_input_text: payload.sanitized_input_text,
    temperature: payload.temperature ?? null,
  };

  const { data, error } = await supabase.from("generations").insert(insertPayload).select("id, created_at").single();

  if (error || !data) {
    throw error ?? new Error("Failed to insert generation");
  }

  return { id: data.id, created_at: data.created_at };
}
