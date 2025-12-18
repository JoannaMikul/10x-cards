import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { GenerationRecord } from "./generations.service.ts";
import { openRouterService } from "../openrouter-service.ts";
import { flashcardsResponseFormat, type FlashcardsGenerationResult } from "../ai-schemas.ts";

export interface ProcessGenerationResult {
  success: boolean;
  candidatesCreated: number;
  error?: string;
}

// Constants for text length limits (matching database constraints)
const MAX_FRONT_LENGTH = 200;
const MAX_BACK_LENGTH = 500;
const BACK_TRUNCATE_LENGTH = 450;

// AI generation configuration
const DEFAULT_TEMPERATURE = 0.3;
const SYSTEM_PROMPT = `You are an expert in creating high-quality educational flashcards.

Tasks:
- Generate flashcards that are clear, precise, and pedagogically valuable
- Each flashcard should contain a question/problem on the front and an answer/explanation on the back
- Add meaningful thematic tags (e.g. docker, kubernetes, react, sql, etc.)
- Avoid creating duplicates or very similar flashcards
- Adjust difficulty level for IT professionals
- Answers should be concise but complete (max ${BACK_TRUNCATE_LENGTH} characters per back side)

Formatting requirements:
- Front: specific question or task (max ${MAX_FRONT_LENGTH} characters)
- Back: clear, complete answer (max ${BACK_TRUNCATE_LENGTH} characters)
- Tags: list of appropriate thematic tags`;

const USER_PROMPT_TEMPLATE = `Analyze the following source text and generate up to 10 high-quality educational flashcards for IT professionals.

Source text:
{{sourceText}}

Requirements:
- Create flashcards that cover key concepts, best practices, and important details from the text
- Each flashcard should be self-contained and educationally valuable
- Use tags for thematic categorization
- Focus on practical and technical aspects
- Generate flashcards in the same language as the source text
- Generate as many flashcards as needed to adequately cover the content (up to 10 maximum)

Generate flashcards in JSON format according to the schema.`;

// Type for validated flashcard data
interface ValidatedFlashcard {
  front: string;
  back: string;
  tags: string[];
}

// Raw flashcard data from AI response
interface RawFlashcard {
  front?: unknown;
  back?: unknown;
  tags?: unknown;
}

// Validate and sanitize a single flashcard
function validateFlashcard(card: unknown): ValidatedFlashcard | null {
  if (!card || typeof card !== "object") {
    return null;
  }

  const rawCard = card as RawFlashcard;

  if (typeof rawCard.front !== "string" || typeof rawCard.back !== "string") {
    return null;
  }

  const front = rawCard.front.trim();
  const back = rawCard.back.trim();

  if (!front || !back) {
    return null;
  }

  // Ensure back text doesn't exceed database constraint
  const finalBack = back.length <= MAX_BACK_LENGTH ? back : back.substring(0, BACK_TRUNCATE_LENGTH) + "...";

  return {
    front: front.length <= MAX_FRONT_LENGTH ? front : front.substring(0, MAX_FRONT_LENGTH),
    back: finalBack,
    tags: Array.isArray(rawCard.tags) ? rawCard.tags.filter((tag): tag is string => typeof tag === "string") : [],
  };
}

export async function processGeneration(
  supabase: SupabaseClient,
  generation: GenerationRecord
): Promise<ProcessGenerationResult> {
  try {
    await updateGenerationStatus(supabase, generation.id, "running");

    const prompt = buildFlashcardGenerationPrompt(generation.sanitized_input_text);

    const result = await openRouterService.completeStructuredChat<FlashcardsGenerationResult>({
      systemPrompt: getSystemPrompt(),
      userPrompt: prompt,
      responseFormat: flashcardsResponseFormat,
      model: generation.model,
      params: {
        temperature: generation.temperature ?? DEFAULT_TEMPERATURE,
      },
    });

    const candidatesCreated = await saveGenerationCandidates(supabase, generation, result.cards);

    await updateGenerationStatus(supabase, generation.id, "succeeded");

    return {
      success: true,
      candidatesCreated,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateGenerationStatus(supabase, generation.id, "failed", errorMessage);

    return {
      success: false,
      candidatesCreated: 0,
      error: errorMessage,
    };
  }
}

async function updateGenerationStatus(
  supabase: SupabaseClient,
  generationId: string,
  status: GenerationRecord["status"],
  errorMessage?: string
): Promise<void> {
  const updateData: Partial<GenerationRecord> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "running") {
    updateData.started_at = new Date().toISOString();
  } else if (status === "succeeded" || status === "failed") {
    updateData.completed_at = new Date().toISOString();
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase.from("generations").update(updateData).eq("id", generationId);

  if (error) {
    throw new Error(`Failed to update generation status: ${error.message}`);
  }
}

function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

function buildFlashcardGenerationPrompt(sourceText: string): string {
  return USER_PROMPT_TEMPLATE.replace("{{sourceText}}", sourceText);
}

async function saveGenerationCandidates(
  supabase: SupabaseClient,
  generation: GenerationRecord,
  cards: FlashcardsGenerationResult["cards"]
): Promise<number> {
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return 0;
  }

  const validCards = cards.map(validateFlashcard).filter((card): card is ValidatedFlashcard => card !== null);

  if (validCards.length === 0) {
    return 0;
  }

  const candidates = validCards.map((card) => ({
    generation_id: generation.id,
    owner_id: generation.user_id,
    front: card.front,
    back: card.back,
    status: "proposed" as const,
    suggested_category_id: null,
    suggested_tags: card.tags,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("generation_candidates").insert(candidates);

  if (error) {
    throw new Error(`Failed to save generation candidates: ${error.message}`);
  }

  return candidates.length;
}

export async function processPendingGenerations(
  supabase: SupabaseClient
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const { data: pendingGenerations, error } = await supabase
    .from("generations")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch pending generations: ${error.message}`);
  }

  if (!pendingGenerations || pendingGenerations.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Process generations in parallel for better performance
  const results = await Promise.allSettled(
    pendingGenerations.map((generation) => processGeneration(supabase, generation))
  );

  let succeeded = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    processed: pendingGenerations.length,
    succeeded,
    failed,
  };
}
