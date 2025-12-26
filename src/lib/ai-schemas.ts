import type { JsonSchemaResponseFormat } from "../types";

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

export const flashcardsResponseFormat: JsonSchemaResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "flashcards_generation_result",
    strict: true,
    schema: flashcardsGenerationSchema,
  },
};

export const flashcardsTranslationResponseFormat: JsonSchemaResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "flashcards_translation_result",
    strict: true,
    schema: flashcardsTranslationSchema,
  },
};

export const flashcardsEditingResponseFormat: JsonSchemaResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "flashcards_editing_result",
    strict: true,
    schema: flashcardsEditingSchema,
  },
};

export const flashcardsQualityAnalysisResponseFormat: JsonSchemaResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "flashcards_quality_analysis_result",
    strict: true,
    schema: flashcardsQualityAnalysisSchema,
  },
};

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
