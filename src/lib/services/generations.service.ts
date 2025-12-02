import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { TablesInsert, Enums, Tables } from "../../db/database.types.ts";
import type { CreateGenerationCommand } from "../../types";

const CONTROL_CHAR_REGEX = /\p{Cc}/gu;
const NEWLINE_REGEX = /\r\n?/g;
const MULTISPACE_REGEX = /[ \t]{2,}/g;
const MULTIBLANK_REGEX = /\n{3,}/g;
const PENDING_STATUS: Enums<"generation_status"> = "pending";
type CandidateStatus = Enums<"candidate_status">;
type CandidateStatusRow = Pick<Tables<"generation_candidates">, "status">;
type CandidateStatusCounters = Record<CandidateStatus, number>;
const CANDIDATE_STATUSES: CandidateStatus[] = ["proposed", "edited", "accepted", "rejected"];
const GENERATION_PROJECTION = [
  "id",
  "user_id",
  "model",
  "status",
  "temperature",
  "prompt_tokens",
  "sanitized_input_length",
  "sanitized_input_sha256",
  "started_at",
  "completed_at",
  "created_at",
  "updated_at",
  "error_code",
  "error_message",
].join(", ");

export type GenerationRecord = Pick<
  Tables<"generations">,
  | "id"
  | "user_id"
  | "model"
  | "status"
  | "temperature"
  | "prompt_tokens"
  | "sanitized_input_length"
  | "sanitized_input_sha256"
  | "started_at"
  | "completed_at"
  | "created_at"
  | "updated_at"
  | "error_code"
  | "error_message"
>;

export interface GenerationCandidatesSummary {
  total: number;
  by_status: CandidateStatusCounters;
}

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

/**
 * Retrieves a generation owned by the provided user using a limited column
 * projection to minimize data transfer while still capturing the fields
 * required for logging and client responses.
 */
export async function getGenerationById(
  supabase: SupabaseClient,
  userId: string,
  generationId: string
): Promise<GenerationRecord | null> {
  const { data, error } = await supabase
    .from("generations")
    .select(GENERATION_PROJECTION)
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<GenerationRecord, { merge: false }>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

/**
 * Fetches raw candidate statuses for a generation and aggregates them into a
 * deterministic summary to power response metadata.
 */
export async function getCandidatesStatuses(
  supabase: SupabaseClient,
  userId: string,
  generationId: string
): Promise<GenerationCandidatesSummary> {
  const { data, error } = await supabase
    .from("generation_candidates")
    .select("status")
    .eq("generation_id", generationId)
    .eq("owner_id", userId)
    .overrideTypes<CandidateStatusRow[], { merge: false }>();

  if (error) {
    throw error;
  }

  const byStatus = buildEmptyStatusCounters();
  const rows: CandidateStatusRow[] = data ?? [];

  for (const row of rows) {
    if (!row.status || !Object.prototype.hasOwnProperty.call(byStatus, row.status)) {
      continue;
    }

    byStatus[row.status] += 1;
  }

  return {
    total: rows.length,
    by_status: byStatus,
  };
}

function buildEmptyStatusCounters(): CandidateStatusCounters {
  return CANDIDATE_STATUSES.reduce<CandidateStatusCounters>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as CandidateStatusCounters);
}
