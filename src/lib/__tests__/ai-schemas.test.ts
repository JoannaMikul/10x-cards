import { describe, it, expect } from "vitest";
import {
  supportsStrictJsonSchema,
  createFlashcardsResponseFormat,
  createFlashcardsTranslationResponseFormat,
  createFlashcardsEditingResponseFormat,
  createFlashcardsQualityAnalysisResponseFormat,
} from "../ai-schemas";

describe("ai-schemas", () => {
  describe("supportsStrictJsonSchema", () => {
    it("should return true for Claude models", () => {
      expect(supportsStrictJsonSchema("anthropic/claude-3.5-sonnet")).toBe(true);
      expect(supportsStrictJsonSchema("anthropic/claude-3-opus")).toBe(true);
      expect(supportsStrictJsonSchema("anthropic/claude-3-sonnet")).toBe(true);
      expect(supportsStrictJsonSchema("anthropic/claude-sonnet-4.5")).toBe(true);
    });

    it("should return true for GPT-4o models", () => {
      expect(supportsStrictJsonSchema("openai/gpt-4o")).toBe(true);
      expect(supportsStrictJsonSchema("openai/gpt-4o-mini")).toBe(true);
    });

    it("should return true for O1 models", () => {
      expect(supportsStrictJsonSchema("openai/o1")).toBe(true);
      expect(supportsStrictJsonSchema("openai/o1-mini")).toBe(true);
    });

    it("should return true for supported Gemini models", () => {
      expect(supportsStrictJsonSchema("google/gemini-2.0-flash-exp")).toBe(true);
      expect(supportsStrictJsonSchema("google/gemini-exp-1206")).toBe(true);
    });

    it("should return false for unsupported models", () => {
      expect(supportsStrictJsonSchema("openai/gpt-4.1-mini")).toBe(false);
      expect(supportsStrictJsonSchema("openai/gpt-5-mini")).toBe(false);
      expect(supportsStrictJsonSchema("deepseek/deepseek-v3.2")).toBe(false);
      expect(supportsStrictJsonSchema("deepseek/deepseek-v3")).toBe(false);
      expect(supportsStrictJsonSchema("x-ai/grok-4.1-fast")).toBe(false);
      expect(supportsStrictJsonSchema("google/gemini-2.5-flash")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(supportsStrictJsonSchema("")).toBe(false);
    });
  });

  describe("createFlashcardsResponseFormat", () => {
    it("should create format with strict: true for supported models", () => {
      const format = createFlashcardsResponseFormat("anthropic/claude-sonnet-4.5");

      expect(format.type).toBe("json_schema");
      expect(format.json_schema.name).toBe("flashcards_generation_result");
      expect(format.json_schema.strict).toBe(true);
      expect(format.json_schema.schema).toBeDefined();
    });

    it("should create format with strict: false for unsupported models", () => {
      const format = createFlashcardsResponseFormat("openai/gpt-4.1-mini");

      expect(format.type).toBe("json_schema");
      expect(format.json_schema.name).toBe("flashcards_generation_result");
      expect(format.json_schema.strict).toBe(false);
      expect(format.json_schema.schema).toBeDefined();
    });

    it("should create format with strict: false for empty model string", () => {
      const format = createFlashcardsResponseFormat("");

      expect(format.json_schema.strict).toBe(false);
    });
  });

  describe("createFlashcardsTranslationResponseFormat", () => {
    it("should create format with appropriate strict mode", () => {
      const strictFormat = createFlashcardsTranslationResponseFormat("openai/gpt-4o");
      const nonStrictFormat = createFlashcardsTranslationResponseFormat("deepseek/deepseek-v3.2");

      expect(strictFormat.json_schema.name).toBe("flashcards_translation_result");
      expect(strictFormat.json_schema.strict).toBe(true);

      expect(nonStrictFormat.json_schema.name).toBe("flashcards_translation_result");
      expect(nonStrictFormat.json_schema.strict).toBe(false);
    });
  });

  describe("createFlashcardsEditingResponseFormat", () => {
    it("should create format with appropriate strict mode", () => {
      const strictFormat = createFlashcardsEditingResponseFormat("openai/gpt-4o-mini");
      const nonStrictFormat = createFlashcardsEditingResponseFormat("x-ai/grok-4.1-fast");

      expect(strictFormat.json_schema.name).toBe("flashcards_editing_result");
      expect(strictFormat.json_schema.strict).toBe(true);

      expect(nonStrictFormat.json_schema.name).toBe("flashcards_editing_result");
      expect(nonStrictFormat.json_schema.strict).toBe(false);
    });
  });

  describe("createFlashcardsQualityAnalysisResponseFormat", () => {
    it("should create format with appropriate strict mode", () => {
      const strictFormat = createFlashcardsQualityAnalysisResponseFormat("anthropic/claude-3-opus");
      const nonStrictFormat = createFlashcardsQualityAnalysisResponseFormat("google/gemini-2.5-flash");

      expect(strictFormat.json_schema.name).toBe("flashcards_quality_analysis_result");
      expect(strictFormat.json_schema.strict).toBe(true);

      expect(nonStrictFormat.json_schema.name).toBe("flashcards_quality_analysis_result");
      expect(nonStrictFormat.json_schema.strict).toBe(false);
    });
  });

  describe("schema structure", () => {
    it("should have correct flashcards generation schema structure", () => {
      const format = createFlashcardsResponseFormat("openai/gpt-4o");
      const schema = format.json_schema.schema as Record<string, unknown>;

      expect(schema.type).toBe("object");
      expect(schema.properties).toHaveProperty("cards");
      expect(schema.required).toContain("cards");
    });

    it("should have correct card item properties", () => {
      const format = createFlashcardsResponseFormat("openai/gpt-4o");
      const schema = format.json_schema.schema as {
        properties: {
          cards: {
            items: {
              properties: Record<string, unknown>;
              required: string[];
            };
          };
        };
      };
      const cardSchema = schema.properties.cards.items;

      expect(cardSchema.properties).toHaveProperty("front");
      expect(cardSchema.properties).toHaveProperty("back");
      expect(cardSchema.properties).toHaveProperty("tag_ids");
      expect(cardSchema.required).toEqual(["front", "back"]);
    });
  });
});
