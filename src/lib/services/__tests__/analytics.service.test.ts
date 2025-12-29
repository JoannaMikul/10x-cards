import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsService } from "../analytics.service";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { AnalyticsTotalsDTO, AnalyticsTrendPointDTO } from "../../../types";

/**
 * Test-compatible Supabase client that allows method overrides
 * Extends the real SupabaseClient but makes 'from' writable for mocking
 */
type TestableSupabaseClient = Omit<SupabaseClient, "from"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
};

/**
 * Type-safe helper for accessing private methods in AnalyticsService for testing
 */
interface AnalyticsServicePrivateMethods {
  calculateTotals: (dateRange: { from: Date; to: Date }) => Promise<AnalyticsTotalsDTO>;
  aggregateTrendData: (dateRange: { from: Date; to: Date }) => Promise<AnalyticsTrendPointDTO[]>;
  calculateAiAcceptanceRate: (dateRange: { from: Date; to: Date }) => Promise<number>;
  calculateDateRange: (params: { range: string; group_by?: string; from?: string; to?: string }) => {
    from: Date;
    to: Date;
  };
  countTotalCandidates: (dateRange: { from: Date; to: Date }) => Promise<number>;
  countAcceptedCandidates: (dateRange: { from: Date; to: Date }) => Promise<number>;
}

/**
 * Safe accessor for private methods using type assertion
 */
function getPrivateMethods(service: AnalyticsService): AnalyticsServicePrivateMethods {
  return service as unknown as AnalyticsServicePrivateMethods;
}

describe("AnalyticsService", () => {
  let mockSupabase: TestableSupabaseClient;
  let service: AnalyticsService;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    } as TestableSupabaseClient;

    service = new AnalyticsService(mockSupabase as SupabaseClient);
  });

  describe("getKpiMetrics", () => {
    it("should orchestrate KPI calculations and return combined results", async () => {
      const mockTotals = { ai: 5, manual: 3 };
      const mockTrend = [
        { date: "2024-12-20", ai: 2, manual: 1, accepted_ai: 2 },
        { date: "2024-12-21", ai: 3, manual: 2, accepted_ai: 3 },
      ];

      const privateMethods = getPrivateMethods(service);
      const calculateTotalsSpy = vi.spyOn(privateMethods, "calculateTotals").mockResolvedValue(mockTotals);
      const aggregateTrendDataSpy = vi.spyOn(privateMethods, "aggregateTrendData").mockResolvedValue(mockTrend);
      const calculateAiAcceptanceRateSpy = vi.spyOn(privateMethods, "calculateAiAcceptanceRate").mockResolvedValue(0.8);
      const calculateDateRangeSpy = vi.spyOn(privateMethods, "calculateDateRange").mockReturnValue({
        from: new Date("2024-12-20"),
        to: new Date("2024-12-27"),
      });

      const result = await service.getKpiMetrics({ range: "7d", group_by: "day" });

      expect(calculateDateRangeSpy).toHaveBeenCalledWith({ range: "7d", group_by: "day" });
      expect(calculateTotalsSpy).toHaveBeenCalled();
      expect(aggregateTrendDataSpy).toHaveBeenCalled();
      expect(calculateAiAcceptanceRateSpy).toHaveBeenCalled();

      expect(result).toEqual({
        ai_acceptance_rate: 0.8,
        ai_share: 5 / 8,
        totals: mockTotals,
        trend: mockTrend,
      });
    });
  });

  describe("calculateTotals", () => {
    it("should calculate totals correctly", async () => {
      const mockData = [
        { origin: "ai-full" },
        { origin: "ai-edited" },
        { origin: "manual" },
        { origin: "manual" },
        { origin: "manual" },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn(() => ({
                data: mockData,
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await getPrivateMethods(service).calculateTotals({
        from: new Date("2024-01-01"),
        to: new Date("2024-01-31"),
      });

      expect(result).toEqual({ ai: 2, manual: 3 });
    });

    it("should handle empty data", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await getPrivateMethods(service).calculateTotals({
        from: new Date("2024-01-01"),
        to: new Date("2024-01-31"),
      });

      expect(result).toEqual({ ai: 0, manual: 0 });
    });
  });

  describe("aggregateTrendData", () => {
    it("should aggregate trend data by date", async () => {
      const mockData = [
        { created_at: "2024-12-20T10:00:00Z", origin: "ai-full" },
        { created_at: "2024-12-20T11:00:00Z", origin: "manual" },
        { created_at: "2024-12-21T10:00:00Z", origin: "ai-edited" },
        { created_at: "2024-12-21T12:00:00Z", origin: "manual" },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  data: mockData,
                  error: null,
                })),
              })),
            })),
          })),
        })),
      }));

      const result = await getPrivateMethods(service).aggregateTrendData({
        from: new Date("2024-12-20"),
        to: new Date("2024-12-21"),
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: "2024-12-20",
        ai: 1,
        manual: 1,
        accepted_ai: 1,
      });
      expect(result[1]).toEqual({
        date: "2024-12-21",
        ai: 1,
        manual: 1,
        accepted_ai: 1,
      });
    });

    it("should sort results by date", async () => {
      const mockData = [
        { created_at: "2024-12-22T10:00:00Z", origin: "manual" },
        { created_at: "2024-12-20T10:00:00Z", origin: "ai-full" },
        { created_at: "2024-12-21T10:00:00Z", origin: "manual" },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  data: mockData,
                  error: null,
                })),
              })),
            })),
          })),
        })),
      }));

      const result = await getPrivateMethods(service).aggregateTrendData({
        from: new Date("2024-12-20"),
        to: new Date("2024-12-22"),
      });

      expect(result[0].date).toBe("2024-12-20");
      expect(result[1].date).toBe("2024-12-21");
      expect(result[2].date).toBe("2024-12-22");
    });
  });

  describe("calculateDateRange", () => {
    it("should calculate 7 day range", () => {
      const now = new Date("2024-12-25T12:00:00Z");
      vi.setSystemTime(now);

      const result = getPrivateMethods(service).calculateDateRange({ range: "7d" });

      const expectedFrom = new Date("2024-12-25T12:00:00Z");
      expectedFrom.setDate(expectedFrom.getDate() - 7);

      expect(result.from.getTime()).toBe(expectedFrom.getTime());
      expect(result.to.getTime()).toBe(now.getTime());

      vi.useRealTimers();
    });

    it("should calculate 30 day range", () => {
      const now = new Date("2024-12-25T12:00:00Z");
      vi.setSystemTime(now);

      const result = getPrivateMethods(service).calculateDateRange({ range: "30d" });

      const expectedFrom = new Date("2024-12-25T12:00:00Z");
      expectedFrom.setDate(expectedFrom.getDate() - 30);

      expect(result.from.getTime()).toBe(expectedFrom.getTime());
      expect(result.to.getTime()).toBe(now.getTime());

      vi.useRealTimers();
    });

    it("should handle custom range with valid dates", () => {
      const result = getPrivateMethods(service).calculateDateRange({
        range: "custom",
        from: "2024-01-01T00:00:00Z",
        to: "2024-01-31T23:59:59Z",
      });

      expect(result.from.getTime()).toBe(new Date("2024-01-01T00:00:00Z").getTime());
      expect(result.to.getTime()).toBe(new Date("2024-01-31T23:59:59Z").getTime());
    });

    it("should throw error for custom range without dates", () => {
      expect(() => {
        getPrivateMethods(service).calculateDateRange({ range: "custom" });
      }).toThrow("Custom range requires both 'from' and 'to' dates");
    });

    it("should throw error for invalid dates", () => {
      expect(() => {
        getPrivateMethods(service).calculateDateRange({
          range: "custom",
          from: "invalid-date",
          to: "2024-01-31T23:59:59Z",
        });
      }).toThrow("Invalid date format provided for custom range");
    });

    it("should throw error when from date is after to date", () => {
      expect(() => {
        getPrivateMethods(service).calculateDateRange({
          range: "custom",
          from: "2024-01-31T23:59:59Z",
          to: "2024-01-01T00:00:00Z",
        });
      }).toThrow("'from' date must be before 'to' date");
    });

    it("should cap future dates to current date", () => {
      const pastDate = new Date("2024-01-01T00:00:00Z");

      vi.setSystemTime(pastDate);

      const result = getPrivateMethods(service).calculateDateRange({
        range: "custom",
        from: "2024-01-01T00:00:00Z",
        to: "2025-01-01T00:00:00Z",
      });

      expect(result.to.getTime()).toBe(pastDate.getTime());

      vi.useRealTimers();
    });
  });
});
