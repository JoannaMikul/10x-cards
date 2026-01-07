import type { Tables } from "../../db/database.types";
import type { SupabaseClient } from "../../db/supabase.client";
import type { GenerationRecord } from "./generations.service";
import {
  openRouterService,
  OpenRouterRateLimitError,
  OpenRouterServerError,
  OpenRouterNetworkError,
} from "../openrouter-service";
import { flashcardsResponseFormat, type FlashcardsGenerationResult } from "../ai-schemas";
import { logGenerationError } from "./error-logs.service";

export interface ProcessGenerationResult {
  success: boolean;
  candidatesCreated: number;
  error?: string;
}

const MAX_FRONT_LENGTH = 200;
const MAX_BACK_LENGTH = 500;
const BACK_TRUNCATE_LENGTH = 450;

const DEFAULT_TEMPERATURE = 0.3;

interface ResilienceConfig {
  retry: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeoutMs: number;
    monitoringPeriodMs: number;
  };
  timeout: {
    requestTimeoutMs: number;
    totalTimeoutMs: number;
  };
}

const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000, // 1 second
    maxDelayMs: 30000, // 30 seconds
    backoffMultiplier: 2,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute
    monitoringPeriodMs: 300000, // 5 minutes
  },
  timeout: {
    requestTimeoutMs: 60000, // 1 minute per request
    totalTimeoutMs: 300000, // 5 minutes total
  },
};

const SYSTEM_PROMPT = `You are an expert in creating high-quality educational flashcards.

Tasks:
- Generate flashcards that are clear, precise, and pedagogically valuable
- Each flashcard should contain a question/problem on the front and an answer/explanation on the back
- Add meaningful thematic tags by choosing valid tag IDs from the provided catalog
- Avoid creating duplicates or very similar flashcards
- Adjust difficulty level for IT professionals
- Answers should be concise but complete (max ${BACK_TRUNCATE_LENGTH} characters per back side)

Formatting requirements:
- Front: specific question or task (max ${MAX_FRONT_LENGTH} characters)
- Back: clear, complete answer (max ${BACK_TRUNCATE_LENGTH} characters)
- tag_ids: array of tag IDs taken from the allowed catalog`;

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

Available tags (use ONLY these IDs when filling the \`tag_ids\` array; include up to 3 per card):
{{availableTags}}

Tagging rules:
- Never invent new tags or IDs
- If no tag fits, return an empty array for \`tag_ids\`
- Prefer the most specific matching tags

Generate flashcards in JSON format according to the schema.`;

interface ValidatedFlashcard {
  front: string;
  back: string;
  tagIds: number[];
}

interface RawFlashcard {
  front?: unknown;
  back?: unknown;
  tag_ids?: unknown;
}

type AvailableTag = Pick<Tables<"tags">, "id" | "name" | "slug">;

class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeoutMs: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN - service temporarily unavailable");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

const openRouterCircuitBreaker = new CircuitBreaker(
  DEFAULT_RESILIENCE_CONFIG.circuitBreaker.failureThreshold,
  DEFAULT_RESILIENCE_CONFIG.circuitBreaker.resetTimeoutMs
);

async function withRetry<T>(
  operation: () => Promise<T>,
  config: ResilienceConfig["retry"],
  shouldRetry: (error: Error) => boolean = () => true
): Promise<T> {
  let lastError: Error = new Error("No attempts made");

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === config.maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = Math.min(config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1), config.maxDelayMs);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

function isRetryableError(error: Error): boolean {
  if (error instanceof OpenRouterRateLimitError) {
    return true;
  }

  if (error instanceof OpenRouterServerError) {
    // Retry on 5xx errors except 501 (Not Implemented)
    return error.statusCode >= 500 && error.statusCode !== 501;
  }

  if (error instanceof OpenRouterNetworkError) {
    return true;
  }

  // Also check error name for test compatibility
  if (error.name === "OpenRouterRateLimitError" || error.message.includes("Rate limit")) {
    return true;
  }

  if (error.name === "OpenRouterServerError" || error.message.includes("service temporarily unavailable")) {
    return true;
  }

  // Don't retry on authentication, bad request, or parsing errors
  return false;
}

export function sanitizeTagIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const numericValues = value.filter(
    (item): item is number => typeof item === "number" && Number.isInteger(item) && item > 0
  );

  return Array.from(new Set(numericValues));
}

export function validateFlashcard(card: unknown): ValidatedFlashcard | null {
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

  const finalBack = back.length <= MAX_BACK_LENGTH ? back : back.substring(0, BACK_TRUNCATE_LENGTH) + "...";

  return {
    front: front.length <= MAX_FRONT_LENGTH ? front : front.substring(0, MAX_FRONT_LENGTH),
    back: finalBack,
    tagIds: sanitizeTagIds(rawCard.tag_ids),
  };
}

export async function processGeneration(
  supabase: SupabaseClient,
  generation: GenerationRecord
): Promise<ProcessGenerationResult> {
  try {
    await updateGenerationStatus(supabase, generation.id, "running");

    const availableTags = await fetchAvailableTags(supabase);
    const prompt = buildFlashcardGenerationPrompt(generation.sanitized_input_text, availableTags);

    const result = await performResilientGeneration(
      getSystemPrompt(),
      prompt,
      generation.model,
      generation.temperature ?? DEFAULT_TEMPERATURE,
      generation.id
    );

    const candidatesCreated = await saveGenerationCandidates(supabase, generation, result.cards);

    if (candidatesCreated === 0) {
      const errorMessage = "No valid flashcards were generated from the provided text";
      await updateGenerationStatus(supabase, generation.id, "failed", errorMessage);

      await logGenerationErrorWithResilience(supabase, generation, new Error(errorMessage), "no_candidates_generated");

      return {
        success: false,
        candidatesCreated: 0,
        error: errorMessage,
      };
    }

    await updateGenerationStatus(supabase, generation.id, "succeeded");

    return {
      success: true,
      candidatesCreated,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateGenerationStatus(supabase, generation.id, "failed", errorMessage);

    await logGenerationErrorWithResilience(
      supabase,
      generation,
      error instanceof Error ? error : new Error(errorMessage),
      "ai_generation_failed"
    );

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

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

function buildFlashcardGenerationPrompt(sourceText: string, availableTags: AvailableTag[]): string {
  return USER_PROMPT_TEMPLATE.replace("{{sourceText}}", sourceText).replace(
    "{{availableTags}}",
    formatAvailableTagsForPrompt(availableTags)
  );
}

export function formatAvailableTagsForPrompt(tags: AvailableTag[]): string {
  if (!tags || tags.length === 0) {
    return "No tags are configured. Set `tag_ids` to an empty array for every flashcard.";
  }

  return tags.map((tag) => `- [${tag.id}] ${tag.name} (slug: ${tag.slug})`).join("\n");
}

async function fetchAvailableTags(supabase: SupabaseClient): Promise<AvailableTag[]> {
  const { data, error } = await supabase.from("tags").select("id, name, slug").order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch available tags: ${error.message}`);
  }

  return data ?? [];
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
    suggested_tags: card.tagIds,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("generation_candidates").insert(candidates);

  if (error) {
    throw new Error(`Failed to save generation candidates: ${error.message}`);
  }

  return candidates.length;
}

async function performResilientGeneration(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number,
  generationId: string
): Promise<FlashcardsGenerationResult> {
  const config = DEFAULT_RESILIENCE_CONFIG;

  const generationOperation = async (): Promise<FlashcardsGenerationResult> => {
    return await withTimeout(
      openRouterService.completeStructuredChat<FlashcardsGenerationResult>({
        systemPrompt,
        userPrompt,
        responseFormat: flashcardsResponseFormat,
        model,
        params: { temperature },
      }),
      config.timeout.requestTimeoutMs
    );
  };

  const circuitBreakerOperation = () => openRouterCircuitBreaker.execute(generationOperation);

  try {
    return await withRetry(circuitBreakerOperation, config.retry, isRetryableError);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`AI generation failed for generation ${generationId}:`, {
      error: error instanceof Error ? error.message : String(error),
      circuitBreakerState: openRouterCircuitBreaker.getState(),
      failureCount: openRouterCircuitBreaker.getFailureCount(),
      isRetryable: error instanceof Error ? isRetryableError(error) : false,
    });

    throw error;
  }
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

export interface ServiceHealthStatus {
  circuitBreakerState: string;
  failureCount: number;
  isHealthy: boolean;
  lastChecked: string;
}

export function getOpenRouterServiceHealth(): ServiceHealthStatus {
  const state = openRouterCircuitBreaker.getState();
  const failureCount = openRouterCircuitBreaker.getFailureCount();

  return {
    circuitBreakerState: state,
    failureCount,
    isHealthy: state === "CLOSED",
    lastChecked: new Date().toISOString(),
  };
}

async function logGenerationErrorWithResilience(
  supabase: SupabaseClient,
  generation: GenerationRecord,
  error: Error,
  errorCode: string
): Promise<void> {
  const healthStatus = getOpenRouterServiceHealth();

  await logGenerationError(supabase, {
    user_id: generation.user_id,
    model: generation.model,
    error_code: errorCode,
    error_message: `${error.message} [Circuit Breaker: ${healthStatus.circuitBreakerState}, Failures: ${healthStatus.failureCount}, Retryable: ${isRetryableError(error)}]`,
    source_text_hash: generation.sanitized_input_sha256 || "",
    source_text_length: generation.sanitized_input_length || 0,
  });
}
