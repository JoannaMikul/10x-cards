import { describe, it, expect } from "vitest";
import {
  createGenerationSchema,
  getGenerationParamsSchema,
  updateGenerationSchema,
  MIN_SANITIZED_TEXT_LENGTH,
  MAX_SANITIZED_TEXT_LENGTH,
  TEMPERATURE_MIN,
  TEMPERATURE_MAX,
} from "../generations.schema";

describe("createGenerationSchema", () => {
  describe("model validation", () => {
    it("accepts valid model string", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
      });
      expect(result.success).toBe(true);
      expect(result.data?.model).toBe("gpt-4");
    });

    it("rejects empty model", () => {
      const result = createGenerationSchema.safeParse({
        model: "",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Model cannot be empty");
    });

    it("rejects missing model", () => {
      const result = createGenerationSchema.safeParse({
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Model is required");
    });

    it("rejects non-string model", () => {
      const result = createGenerationSchema.safeParse({
        model: 123,
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Model must be a string");
    });
  });

  describe("sanitized_input_text validation", () => {
    it("accepts valid text length", () => {
      const text = "a".repeat(MIN_SANITIZED_TEXT_LENGTH);
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: text,
      });
      expect(result.success).toBe(true);
      expect(result.data?.sanitized_input_text).toBe(text);
    });

    it("accepts maximum text length", () => {
      const text = "a".repeat(MAX_SANITIZED_TEXT_LENGTH);
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: text,
      });
      expect(result.success).toBe(true);
      expect(result.data?.sanitized_input_text).toBe(text);
    });

    it("rejects text below minimum length", () => {
      const text = "a".repeat(MIN_SANITIZED_TEXT_LENGTH - 1);
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: text,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        `Sanitized input text must be at least ${MIN_SANITIZED_TEXT_LENGTH} characters long`
      );
    });

    it("rejects text above maximum length", () => {
      const text = "a".repeat(MAX_SANITIZED_TEXT_LENGTH + 1);
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: text,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        `Sanitized input text can contain at most ${MAX_SANITIZED_TEXT_LENGTH} characters`
      );
    });

    it("rejects missing sanitized_input_text", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Sanitized input text is required");
    });

    it("rejects non-string sanitized_input_text", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: 123,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Sanitized input text must be a string");
    });
  });

  describe("temperature validation", () => {
    it("accepts valid temperature value", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
        temperature: 1.5,
      });
      expect(result.success).toBe(true);
      expect(result.data?.temperature).toBe(1.5);
    });

    it("rounds temperature to 2 decimal places", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
        temperature: 1.23456,
      });
      expect(result.success).toBe(true);
      expect(result.data?.temperature).toBe(1.23);
    });

    it("accepts minimum temperature", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
        temperature: TEMPERATURE_MIN,
      });
      expect(result.success).toBe(true);
      expect(result.data?.temperature).toBe(TEMPERATURE_MIN);
    });

    it("accepts maximum temperature", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
        temperature: TEMPERATURE_MAX,
      });
      expect(result.success).toBe(true);
      expect(result.data?.temperature).toBe(TEMPERATURE_MAX);
    });

    it("rejects temperature below minimum", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
        temperature: TEMPERATURE_MIN - 0.1,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Temperature cannot be lower than ${TEMPERATURE_MIN}`);
    });

    it("rejects temperature above maximum", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
        temperature: TEMPERATURE_MAX + 0.1,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Temperature cannot be higher than ${TEMPERATURE_MAX}`);
    });

    it("rejects non-number temperature", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
        temperature: "1.5",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Temperature must be a number");
    });

    it("accepts undefined temperature", () => {
      const result = createGenerationSchema.safeParse({
        model: "gpt-4",
        sanitized_input_text: "a".repeat(MIN_SANITIZED_TEXT_LENGTH),
        temperature: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.data?.temperature).toBeUndefined();
    });
  });
});

describe("getGenerationParamsSchema", () => {
  describe("id validation", () => {
    it("accepts valid UUID", () => {
      const uuid = "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95";
      const result = getGenerationParamsSchema.safeParse({
        id: uuid,
      });
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(uuid);
    });

    it("rejects invalid UUID format", () => {
      const result = getGenerationParamsSchema.safeParse({
        id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Invalid generation id");
    });

    it("rejects empty id", () => {
      const result = getGenerationParamsSchema.safeParse({
        id: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Invalid generation id");
    });

    it("rejects missing id", () => {
      const result = getGenerationParamsSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Generation id is required");
    });

    it("rejects non-string id", () => {
      const result = getGenerationParamsSchema.safeParse({
        id: 123,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Generation id must be a string");
    });
  });
});

describe("updateGenerationSchema", () => {
  describe("status validation", () => {
    it("accepts cancelled status", () => {
      const result = updateGenerationSchema.safeParse({
        status: "cancelled",
      });
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe("cancelled");
    });

    it("rejects other status values", () => {
      const invalidStatuses = ["pending", "running", "completed", "failed"];

      invalidStatuses.forEach((status) => {
        const result = updateGenerationSchema.safeParse({
          status,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe('Invalid literal value, expected "cancelled"');
      });
    });

    it("rejects missing status", () => {
      const result = updateGenerationSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Status is required");
    });

    it("rejects non-string status", () => {
      const result = updateGenerationSchema.safeParse({
        status: 123,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('Invalid literal value, expected "cancelled"');
    });

    it("rejects extra fields", () => {
      const result = updateGenerationSchema.safeParse({
        status: "cancelled",
        extraField: "value",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Only status field is allowed");
    });
  });
});
