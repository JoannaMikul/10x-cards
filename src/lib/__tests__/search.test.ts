import { describe, it, expect } from "vitest";
import { escapeIlikePattern } from "../utils/search";

describe("escapeIlikePattern", () => {
  describe("special character escaping", () => {
    it("escapes backslash characters", () => {
      expect(escapeIlikePattern("\\")).toBe("\\\\");
      expect(escapeIlikePattern("test\\value")).toBe("test\\\\value");
      expect(escapeIlikePattern("\\\\")).toBe("\\\\\\\\");
    });

    it("escapes percent characters", () => {
      expect(escapeIlikePattern("%")).toBe("\\%");
      expect(escapeIlikePattern("test%value")).toBe("test\\%value");
      expect(escapeIlikePattern("%%")).toBe("\\%\\%");
    });

    it("escapes underscore characters", () => {
      expect(escapeIlikePattern("_")).toBe("\\_");
      expect(escapeIlikePattern("test_value")).toBe("test\\_value");
      expect(escapeIlikePattern("__")).toBe("\\_\\_");
    });

    it("escapes comma characters", () => {
      expect(escapeIlikePattern(",")).toBe("\\,");
      expect(escapeIlikePattern("test,value")).toBe("test\\,value");
      expect(escapeIlikePattern(",,")).toBe("\\,\\,");
    });
  });

  describe("character combinations", () => {
    it("escapes multiple different special characters in one string", () => {
      expect(escapeIlikePattern("\\%_,")).toBe("\\\\\\%\\_\\,");
      expect(escapeIlikePattern("test\\%_value,more")).toBe("test\\\\\\%\\_value\\,more");
    });

    it("escapes repeated special characters", () => {
      expect(escapeIlikePattern("\\\\%%__,,")).toBe("\\\\\\\\\\%\\%\\_\\_\\,\\,");
    });

    it("handles complex patterns with mixed special and regular characters", () => {
      expect(escapeIlikePattern("query_with%special\\chars,and_more")).toBe(
        "query\\_with\\%special\\\\chars\\,and\\_more"
      );
    });
  });

  describe("regular characters", () => {
    it("leaves regular alphanumeric characters unchanged", () => {
      expect(escapeIlikePattern("hello")).toBe("hello");
      expect(escapeIlikePattern("Test123")).toBe("Test123");
      expect(escapeIlikePattern("mixed123TEXT")).toBe("mixed123TEXT");
    });

    it("leaves other special characters unchanged", () => {
      expect(escapeIlikePattern("hello@world.com")).toBe("hello@world.com");
      expect(escapeIlikePattern("test-value+other")).toBe("test-value+other");
      expect(escapeIlikePattern("symbols!@#$^&*()")).toBe("symbols!@#$^&*()");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(escapeIlikePattern("")).toBe("");
    });

    it("handles string with only special characters", () => {
      expect(escapeIlikePattern("\\%_,".repeat(3))).toBe("\\\\\\%\\_\\,".repeat(3));
    });

    it("handles long strings with mixed content", () => {
      const longString = "A".repeat(1000) + "\\" + "%".repeat(500) + "_" + ",".repeat(200);
      const expected = "A".repeat(1000) + "\\\\" + "\\%".repeat(500) + "\\_" + "\\,".repeat(200);
      expect(escapeIlikePattern(longString)).toBe(expected);
    });

    it("handles strings with spaces and newlines", () => {
      expect(escapeIlikePattern("test\nvalue\tmore")).toBe("test\nvalue\tmore");
      expect(escapeIlikePattern("test \\ value")).toBe("test \\\\ value");
    });
  });
});
