import type { JsonSchemaResponseFormat } from "../types";

/**
 * Models that support strict JSON schema mode in OpenRouter.
 * Other models will use non-strict mode for better compatibility.
 */
const MODELS_WITH_STRICT_SCHEMA_SUPPORT = [
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-opus",
  "anthropic/claude-3-sonnet",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/o1",
  "openai/o1-mini",
  "google/gemini-2.0-flash-exp",
  "google/gemini-exp-1206",
] as const;

/**
 * Check if a model supports strict JSON schema mode.
 */
export function supportsStrictJsonSchema(model: string): boolean {
  return MODELS_WITH_STRICT_SCHEMA_SUPPORT.some((supportedModel) => model.includes(supportedModel));
}

export const flashcardsGenerationSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          front: {
            type: "string",
            description: "Content of the front side (question/task).",
          },
          back: {
            type: "string",
            description: "Content of the back side (answer/explanation).",
          },
          explanation: {
            type: "string",
            description: "Optional additional explanation.",
          },
          tag_ids: {
            type: "array",
            items: { type: "integer", minimum: 1 },
            description: "List of tag IDs chosen from the provided catalog.",
          },
        },
        required: ["front", "back"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
} as const;

export const flashcardsTranslationSchema = {
  type: "object",
  properties: {
    translatedCards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          originalFront: { type: "string" },
          originalBack: { type: "string" },
          translatedFront: { type: "string" },
          translatedBack: { type: "string" },
          targetLanguage: { type: "string" },
          notes: { type: "string" },
        },
        required: ["originalFront", "originalBack", "translatedFront", "translatedBack", "targetLanguage"],
        additionalProperties: false,
      },
    },
  },
  required: ["translatedCards"],
  additionalProperties: false,
} as const;

export const flashcardsEditingSchema = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cardIndex: { type: "integer", minimum: 0 },
          suggestedFront: { type: "string" },
          suggestedBack: { type: "string" },
          reasoning: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          suggestedTags: {
            type: "array",
            items: { type: "string" },
          },
          suggestedCategory: { type: "string" },
        },
        required: ["cardIndex", "suggestedFront", "suggestedBack", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

export const flashcardsQualityAnalysisSchema = {
  type: "object",
  properties: {
    analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cardIndex: { type: "integer", minimum: 0 },
          qualityScore: { type: "number", minimum: 0, maximum: 10 },
          clarity: { type: "number", minimum: 0, maximum: 10 },
          accuracy: { type: "number", minimum: 0, maximum: 10 },
          completeness: { type: "number", minimum: 0, maximum: 10 },
          strengths: {
            type: "array",
            items: { type: "string" },
          },
          weaknesses: {
            type: "array",
            items: { type: "string" },
          },
          suggestions: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["cardIndex", "qualityScore", "clarity", "accuracy", "completeness"],
        additionalProperties: false,
      },
    },
    overallScore: { type: "number", minimum: 0, maximum: 10 },
    summary: { type: "string" },
  },
  required: ["analysis", "overallScore", "summary"],
  additionalProperties: false,
} as const;

/**
 * Create response format for flashcards generation with appropriate strict mode.
 * @param model - The model name to determine if strict mode is supported
 */
export function createFlashcardsResponseFormat(model: string): JsonSchemaResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
      name: "flashcards_generation_result",
      strict: supportsStrictJsonSchema(model),
      schema: flashcardsGenerationSchema,
    },
  };
}

/**
 * Create response format for flashcards translation with appropriate strict mode.
 * @param model - The model name to determine if strict mode is supported
 */
export function createFlashcardsTranslationResponseFormat(model: string): JsonSchemaResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
      name: "flashcards_translation_result",
      strict: supportsStrictJsonSchema(model),
      schema: flashcardsTranslationSchema,
    },
  };
}

/**
 * Create response format for flashcards editing with appropriate strict mode.
 * @param model - The model name to determine if strict mode is supported
 */
export function createFlashcardsEditingResponseFormat(model: string): JsonSchemaResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
      name: "flashcards_editing_result",
      strict: supportsStrictJsonSchema(model),
      schema: flashcardsEditingSchema,
    },
  };
}

/**
 * Create response format for flashcards quality analysis with appropriate strict mode.
 * @param model - The model name to determine if strict mode is supported
 */
export function createFlashcardsQualityAnalysisResponseFormat(model: string): JsonSchemaResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
      name: "flashcards_quality_analysis_result",
      strict: supportsStrictJsonSchema(model),
      schema: flashcardsQualityAnalysisSchema,
    },
  };
}

// Backward compatibility - these now use non-strict mode by default
export const flashcardsResponseFormat: JsonSchemaResponseFormat = createFlashcardsResponseFormat("");
export const flashcardsTranslationResponseFormat: JsonSchemaResponseFormat =
  createFlashcardsTranslationResponseFormat("");
export const flashcardsEditingResponseFormat: JsonSchemaResponseFormat = createFlashcardsEditingResponseFormat("");
export const flashcardsQualityAnalysisResponseFormat: JsonSchemaResponseFormat =
  createFlashcardsQualityAnalysisResponseFormat("");

export interface FlashcardsGenerationResult {
  cards: {
    front: string;
    back: string;
    explanation?: string;
    tag_ids?: number[];
  }[];
}

export interface FlashcardsTranslationResult {
  translatedCards: {
    originalFront: string;
    originalBack: string;
    translatedFront: string;
    translatedBack: string;
    targetLanguage: string;
    notes?: string;
  }[];
}

export interface FlashcardsEditingResult {
  suggestions: {
    cardIndex: number;
    suggestedFront: string;
    suggestedBack: string;
    reasoning: string;
    confidence?: number;
    suggestedTags?: string[];
    suggestedCategory?: string;
  }[];
}

export interface FlashcardsQualityAnalysisResult {
  analysis: {
    cardIndex: number;
    qualityScore: number;
    clarity: number;
    accuracy: number;
    completeness: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  }[];
  overallScore: number;
  summary: string;
}
