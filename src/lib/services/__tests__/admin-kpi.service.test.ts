import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { fetchAdminKpi } from "../admin-kpi.service";
import type { AdminKpiQueryParams } from "../../analytics-kpi.types";

describe("fetchAdminKpi", () => {
  const mockOrigin = "https://example.com";
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    vi.stubGlobal("location", { origin: mockOrigin });
  });

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful requests", () => {
    it("fetches KPI data for 7 day range", async () => {
      const mockResponse = {
        ai_acceptance_rate: 0.75,
        ai_share: 0.6,
        totals: { ai: 42, manual: 28 },
        trend: [
          { date: "2024-12-20T00:00:00.000Z", ai: 8, manual: 4, accepted_ai: 6 },
          { date: "2024-12-21T00:00:00.000Z", ai: 6, manual: 6, accepted_ai: 4 },
          { date: "2024-12-22T00:00:00.000Z", ai: 10, manual: 2, accepted_ai: 8 },
          { date: "2024-12-23T00:00:00.000Z", ai: 7, manual: 5, accepted_ai: 6 },
          { date: "2024-12-24T00:00:00.000Z", ai: 4, manual: 4, accepted_ai: 3 },
          { date: "2024-12-25T00:00:00.000Z", ai: 2, manual: 3, accepted_ai: 1 },
          { date: "2024-12-26T00:00:00.000Z", ai: 5, manual: 4, accepted_ai: 4 },
        ],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const params: AdminKpiQueryParams = {
        range: "7d",
        group_by: "day",
      };

      const result = await fetchAdminKpi(params);

      expect(fetchSpy).toHaveBeenCalledWith(`${mockOrigin}/api/admin/kpi?range=7d&group_by=day`, { method: "GET" });
      expect(result).toEqual(mockResponse);
      expect(result.ai_acceptance_rate).toBe(0.75);
      expect(result.ai_share).toBe(0.6);
    });

    it("fetches KPI data for 30 day range", async () => {
      const mockResponse = {
        ai_acceptance_rate: 0.82,
        ai_share: 0.78,
        totals: { ai: 234, manual: 66 },
        trend: [
          { date: "2024-11-27T00:00:00.000Z", ai: 12, manual: 2, accepted_ai: 10 },
          { date: "2024-11-28T00:00:00.000Z", ai: 15, manual: 3, accepted_ai: 13 },
          { date: "2024-11-29T00:00:00.000Z", ai: 18, manual: 4, accepted_ai: 15 },
          { date: "2024-11-30T00:00:00.000Z", ai: 14, manual: 5, accepted_ai: 11 },
          { date: "2024-12-01T00:00:00.000Z", ai: 16, manual: 6, accepted_ai: 14 },
        ],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const params: AdminKpiQueryParams = {
        range: "30d",
        group_by: "day",
      };

      const result = await fetchAdminKpi(params);

      expect(fetchSpy).toHaveBeenCalledWith(`${mockOrigin}/api/admin/kpi?range=30d&group_by=day`, { method: "GET" });
      expect(result).toEqual(mockResponse);
      expect(result.ai_acceptance_rate).toBe(0.82);
      expect(result.ai_share).toBe(0.78);
    });

    it("fetches KPI data for custom range with from and to dates", async () => {
      const mockResponse = {
        ai_acceptance_rate: 0.68,
        ai_share: 0.55,
        totals: { ai: 88, manual: 72 },
        trend: [
          { date: "2024-01-01T00:00:00.000Z", ai: 8, manual: 12, accepted_ai: 5 },
          { date: "2024-01-02T00:00:00.000Z", ai: 6, manual: 8, accepted_ai: 4 },
          { date: "2024-01-03T00:00:00.000Z", ai: 10, manual: 6, accepted_ai: 7 },
        ],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const params: AdminKpiQueryParams = {
        range: "custom",
        group_by: "day",
        from: "2024-01-01",
        to: "2024-01-31",
      };

      const result = await fetchAdminKpi(params);

      expect(fetchSpy).toHaveBeenCalledWith(
        `${mockOrigin}/api/admin/kpi?range=custom&group_by=day&from=2024-01-01&to=2024-01-31`,
        { method: "GET" }
      );
      expect(result).toEqual(mockResponse);
      expect(result.ai_acceptance_rate).toBe(0.68);
    });

    it("fetches KPI data for custom range with only from date", async () => {
      const mockResponse = {
        ai_acceptance_rate: 0.71,
        ai_share: 0.62,
        totals: { ai: 156, manual: 94 },
        trend: [
          { date: "2024-01-01T00:00:00.000Z", ai: 8, manual: 12, accepted_ai: 6 },
          { date: "2024-01-02T00:00:00.000Z", ai: 12, manual: 8, accepted_ai: 9 },
        ],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const params: AdminKpiQueryParams = {
        range: "custom",
        group_by: "day",
        from: "2024-01-01",
      };

      const result = await fetchAdminKpi(params);

      expect(fetchSpy).toHaveBeenCalledWith(`${mockOrigin}/api/admin/kpi?range=custom&group_by=day&from=2024-01-01`, {
        method: "GET",
      });
      expect(result).toEqual(mockResponse);
    });

    it("fetches KPI data for custom range with only to date", async () => {
      const mockResponse = {
        ai_acceptance_rate: 0.65,
        ai_share: 0.48,
        totals: { ai: 76, manual: 84 },
        trend: [
          { date: "2024-01-13T00:00:00.000Z", ai: 6, manual: 14, accepted_ai: 4 },
          { date: "2024-01-14T00:00:00.000Z", ai: 8, manual: 12, accepted_ai: 5 },
          { date: "2024-01-15T00:00:00.000Z", ai: 4, manual: 16, accepted_ai: 3 },
        ],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const params: AdminKpiQueryParams = {
        range: "custom",
        group_by: "day",
        to: "2024-01-31",
      };

      const result = await fetchAdminKpi(params);

      expect(fetchSpy).toHaveBeenCalledWith(`${mockOrigin}/api/admin/kpi?range=custom&group_by=day&to=2024-01-31`, {
        method: "GET",
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("error handling", () => {
    it("throws error for non-ok response", async () => {
      const errorResponse = { error: "Internal Server Error" };

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValueOnce(errorResponse),
      });

      const params: AdminKpiQueryParams = {
        range: "7d",
        group_by: "day",
      };

      await expect(fetchAdminKpi(params)).rejects.toEqual({
        status: 500,
        body: errorResponse,
      });
    });

    it("throws error for 404 response", async () => {
      const errorResponse = { error: "Not Found" };

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValueOnce(errorResponse),
      });

      const params: AdminKpiQueryParams = {
        range: "7d",
        group_by: "day",
      };

      await expect(fetchAdminKpi(params)).rejects.toEqual({
        status: 404,
        body: errorResponse,
      });
    });

    it("throws error for network failure", async () => {
      const networkError = new Error("Network Error");
      fetchSpy.mockRejectedValueOnce(networkError);

      const params: AdminKpiQueryParams = {
        range: "7d",
        group_by: "day",
      };

      await expect(fetchAdminKpi(params)).rejects.toThrow("Network Error");
    });
  });
});
