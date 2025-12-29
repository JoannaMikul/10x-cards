import { describe, it, expect } from "vitest";
import {
  adminKpiQuerySchema,
  customRangeValidationSchema,
  type AdminKpiQuery,
  type CustomRangeValidation,
} from "../admin-kpi.schema";

describe("adminKpiQuerySchema", () => {
  describe("range validation", () => {
    it("accepts valid range values", () => {
      const validRanges = ["7d", "30d", "custom"] as const;

      validRanges.forEach((range) => {
        const result = adminKpiQuerySchema.safeParse({ range });
        expect(result.success).toBe(true);
        expect(result.data?.range).toBe(range);
      });
    });

    it("rejects invalid range values with custom error message", () => {
      const invalidRanges = ["1d", "60d", "year", "invalid"];

      invalidRanges.forEach((range) => {
        const result = adminKpiQuerySchema.safeParse({ range });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Range must be one of: 7d, 30d, custom.");
      });
    });

    it("defaults to '7d' when range is not provided", () => {
      const result = adminKpiQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.range).toBe("7d");
    });

    it("accepts undefined range value", () => {
      const result = adminKpiQuerySchema.safeParse({ range: undefined });
      expect(result.success).toBe(true);
      expect(result.data?.range).toBe("7d");
    });
  });

  describe("group_by validation", () => {
    it("accepts valid group_by values", () => {
      const validGroupBy = ["day", "category", "origin"] as const;

      validGroupBy.forEach((groupBy) => {
        const result = adminKpiQuerySchema.safeParse({ group_by: groupBy });
        expect(result.success).toBe(true);
        expect(result.data?.group_by).toBe(groupBy);
      });
    });

    it("rejects invalid group_by values with custom error message", () => {
      const invalidGroupBy = ["week", "month", "user", "invalid"];

      invalidGroupBy.forEach((groupBy) => {
        const result = adminKpiQuerySchema.safeParse({ group_by: groupBy });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Group by must be one of: day, category, origin.");
      });
    });

    it("defaults to 'day' when group_by is not provided", () => {
      const result = adminKpiQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.group_by).toBe("day");
    });

    it("accepts undefined group_by value", () => {
      const result = adminKpiQuerySchema.safeParse({ group_by: undefined });
      expect(result.success).toBe(true);
      expect(result.data?.group_by).toBe("day");
    });
  });

  describe("date validation", () => {
    it("accepts valid ISO datetime strings for from and to", () => {
      const validData = {
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-01-31T23:59:59.999Z",
      };

      const result = adminKpiQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data?.from).toBe(validData.from);
      expect(result.data?.to).toBe(validData.to);
    });

    it("rejects invalid datetime strings", () => {
      const invalidDates = ["2024-01-01", "not-a-date", "2024/01/01", ""];

      invalidDates.forEach((date) => {
        const result = adminKpiQuerySchema.safeParse({ from: date });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("From date must be a valid ISO date string.");
      });

      invalidDates.forEach((date) => {
        const result = adminKpiQuerySchema.safeParse({ to: date });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("To date must be a valid ISO date string.");
      });
    });

    it("accepts undefined dates", () => {
      const result = adminKpiQuerySchema.safeParse({
        from: undefined,
        to: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.data?.from).toBeUndefined();
      expect(result.data?.to).toBeUndefined();
    });
  });

  describe("complete query validation", () => {
    it("validates complete query with all fields", () => {
      const validQuery = {
        range: "30d" as const,
        group_by: "category" as const,
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-01-31T23:59:59.999Z",
      };

      const result = adminKpiQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validQuery);
    });

    it("validates query with only some fields", () => {
      const partialQuery = {
        range: "custom" as const,
        from: "2024-01-01T00:00:00.000Z",
      };

      const result = adminKpiQuerySchema.safeParse(partialQuery);
      expect(result.success).toBe(true);
      expect(result.data?.range).toBe("custom");
      expect(result.data?.group_by).toBe("day"); // default
      expect(result.data?.from).toBe(partialQuery.from);
      expect(result.data?.to).toBeUndefined();
    });

    it("validates empty query object with defaults", () => {
      const result = adminKpiQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.range).toBe("7d");
      expect(result.data?.group_by).toBe("day");
      expect(result.data?.from).toBeUndefined();
      expect(result.data?.to).toBeUndefined();
    });
  });
});

describe("customRangeValidationSchema", () => {
  describe("basic validation", () => {
    it("accepts valid custom range with required fields", () => {
      const validData = {
        range: "custom" as const,
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-01-15T23:59:59.999Z",
      };

      const result = customRangeValidationSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it("rejects when range is not 'custom'", () => {
      const invalidRanges = ["7d", "30d", "other"];

      invalidRanges.forEach((range) => {
        const result = customRangeValidationSchema.safeParse({
          range,
          from: "2024-01-01T00:00:00.000Z",
          to: "2024-01-15T23:59:59.999Z",
        });
        expect(result.success).toBe(false);
      });
    });

    it("rejects when from date is missing", () => {
      const result = customRangeValidationSchema.safeParse({
        range: "custom" as const,
        to: "2024-01-15T23:59:59.999Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects when to date is missing", () => {
      const result = customRangeValidationSchema.safeParse({
        range: "custom" as const,
        from: "2024-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid datetime formats", () => {
      const result = customRangeValidationSchema.safeParse({
        range: "custom" as const,
        from: "invalid-date",
        to: "2024-01-15T23:59:59.999Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("90-day range limit", () => {
    it("accepts range within 90 days", () => {
      const testCases = [
        {
          from: "2024-01-01T00:00:00.000Z",
          to: "2024-03-31T00:00:00.000Z", // exactly 90 days (90 * 24 hours)
        },
        {
          from: "2024-01-01T00:00:00.000Z",
          to: "2024-01-31T23:59:59.999Z", // 30 days
        },
        {
          from: "2024-01-01T00:00:00.000Z",
          to: "2024-01-08T23:59:59.999Z", // 7 days
        },
        {
          from: "2024-01-01T00:00:00.000Z",
          to: "2024-03-30T23:59:59.999Z", // 89 days
        },
      ];

      testCases.forEach(({ from, to }) => {
        const result = customRangeValidationSchema.safeParse({
          range: "custom" as const,
          from,
          to,
        });
        expect(result.success).toBe(true);
      });
    });

    it("rejects range exceeding 90 days", () => {
      const testCases = [
        {
          from: "2024-01-01T00:00:00.000Z",
          to: "2024-04-01T00:00:00.000Z", // 91 days
        },
        {
          from: "2024-01-01T00:00:00.000Z",
          to: "2024-06-01T00:00:00.000Z", // 151 days
        },
        {
          from: "2024-01-01T00:00:00.000Z",
          to: "2025-01-01T00:00:00.000Z", // 365 days
        },
      ];

      testCases.forEach(({ from, to }) => {
        const result = customRangeValidationSchema.safeParse({
          range: "custom" as const,
          from,
          to,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Date range cannot exceed 90 days.");
        expect(result.error?.issues[0]?.path).toEqual(["to"]);
      });
    });

    it("calculates days correctly including leap years", () => {
      const result = customRangeValidationSchema.safeParse({
        range: "custom" as const,
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-03-31T00:00:00.000Z", // exactly 90 days in leap year
      });
      expect(result.success).toBe(true);
    });
  });

  describe("date order validation", () => {
    it("accepts when from date is before or equal to to date", () => {
      const testCases = [
        {
          from: "2024-01-01T00:00:00.000Z",
          to: "2024-01-01T00:00:00.000Z", // same date
        },
        {
          from: "2024-01-01T00:00:00.000Z",
          to: "2024-01-02T00:00:00.000Z", // from before to
        },
        {
          from: "2024-01-01T10:00:00.000Z",
          to: "2024-01-01T15:00:00.000Z", // same day, different time
        },
      ];

      testCases.forEach(({ from, to }) => {
        const result = customRangeValidationSchema.safeParse({
          range: "custom" as const,
          from,
          to,
        });
        expect(result.success).toBe(true);
      });
    });

    it("rejects when from date is after to date", () => {
      const testCases = [
        {
          from: "2024-01-02T00:00:00.000Z",
          to: "2024-01-01T00:00:00.000Z",
        },
        {
          from: "2024-01-01T15:00:00.000Z",
          to: "2024-01-01T10:00:00.000Z",
        },
      ];

      testCases.forEach(({ from, to }) => {
        const result = customRangeValidationSchema.safeParse({
          range: "custom" as const,
          from,
          to,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("From date must be before or equal to to date.");
        expect(result.error?.issues[0]?.path).toEqual(["from"]);
      });
    });
  });

  describe("edge cases", () => {
    it("handles same datetime correctly", () => {
      const result = customRangeValidationSchema.safeParse({
        range: "custom" as const,
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("handles boundary dates correctly", () => {
      const result = customRangeValidationSchema.safeParse({
        range: "custom" as const,
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-03-31T00:00:00.000Z", // exactly 90 days
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("TypeScript integration", () => {
  it("ensures AdminKpiQuery type matches schema", () => {
    const validQuery: AdminKpiQuery = {
      range: "30d",
      group_by: "category",
      from: "2024-01-01T00:00:00.000Z",
      to: "2024-01-31T23:59:59.999Z",
    };

    const result = adminKpiQuerySchema.parse(validQuery);
    expect(result).toEqual(validQuery);
  });

  it("ensures CustomRangeValidation type matches schema", () => {
    const validCustomRange: CustomRangeValidation = {
      range: "custom",
      from: "2024-01-01T00:00:00.000Z",
      to: "2024-01-15T23:59:59.999Z",
    };

    const result = customRangeValidationSchema.parse(validCustomRange);
    expect(result).toEqual(validCustomRange);
  });
});

describe("Error handling", () => {
  it("provides detailed error information", () => {
    const invalidData = {
      range: "invalid",
      group_by: "also_invalid",
      from: "not-a-date",
      to: "also-not-a-date",
    };

    const result = adminKpiQuerySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.issues).toHaveLength(4);
    const rangeError = result.error?.issues.find((issue) => issue.path.includes("range"));
    const groupByError = result.error?.issues.find((issue) => issue.path.includes("group_by"));
    const fromError = result.error?.issues.find((issue) => issue.path.includes("from"));
    const toError = result.error?.issues.find((issue) => issue.path.includes("to"));

    expect(rangeError?.message).toContain("Range must be one of");
    expect(groupByError?.message).toContain("Group by must be one of");
    expect(fromError?.message).toContain("From date must be a valid ISO date string");
    expect(toError?.message).toContain("To date must be a valid ISO date string");
  });

  it("handles multiple validation failures in custom range schema", () => {
    const invalidData = {
      range: "7d", // not custom
      from: "2024-01-02T00:00:00.000Z",
      to: "2024-01-01T00:00:00.000Z", // from after to
    };

    const result = customRangeValidationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    const rangeError = result.error?.issues.find((issue) => issue.path.includes("range"));
    expect(rangeError).toBeDefined();
  });
});
