import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { AnalyticsKpiResponse, AnalyticsTotalsDTO, AnalyticsTrendPointDTO } from "../../types";
import type { AdminKpiQuery } from "../validation/admin-kpi.schema.ts";

/**
 * Analytics service for calculating KPI metrics for admin dashboard.
 * Provides AI acceptance rates, AI share ratios, and trend data.
 */
export class AnalyticsService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Calculates key performance indicators for flashcard generation and usage.
   * @param params Query parameters for filtering KPI data
   * @returns Comprehensive KPI metrics including acceptance rates, shares, and trends
   */
  async getKpiMetrics(params: AdminKpiQuery): Promise<AnalyticsKpiResponse> {
    const dateRange = this.calculateDateRange(params);
    const totals = await this.calculateTotals(dateRange);
    const trend = await this.aggregateTrendData(dateRange);

    const aiAcceptanceRate = await this.calculateAiAcceptanceRate(dateRange);

    return {
      ai_acceptance_rate: aiAcceptanceRate,
      ai_share: totals.ai > 0 ? totals.ai / (totals.ai + totals.manual) : 0,
      totals,
      trend,
    };
  }

  /**
   * Calculates AI acceptance rate from totals.
   * @param totals Total counts of AI and manual cards
   * @returns Acceptance rate as a decimal between 0 and 1
   */
  /**
   * Calculates AI acceptance rate from generation candidates data.
   * @param dateRange Date range for filtering candidates
   * @returns Acceptance rate as a decimal between 0 and 1
   */
  private async calculateAiAcceptanceRate(dateRange: { from: Date; to: Date }): Promise<number> {
    const { data: totalCandidates, error: totalError } = await this.supabase
      .from("generation_candidates")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString());

    if (totalError) {
      throw new Error(`Failed to count total candidates: ${totalError.message}`);
    }

    const totalCount = totalCandidates?.length ?? 0;

    if (totalCount === 0) {
      return 0;
    }

    const { data: acceptedCandidates, error: acceptedError } = await this.supabase
      .from("generation_candidates")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString())
      .or("status.eq.accepted,accepted_card_id.not.is.null");

    if (acceptedError) {
      throw new Error(`Failed to count accepted candidates: ${acceptedError.message}`);
    }

    const acceptedCount = acceptedCandidates?.length ?? 0;

    return acceptedCount / totalCount;
  }

  /**
   * Calculates total counts of AI and manual flashcards within date range.
   * @param dateRange Date range for filtering
   * @returns Totals for AI and manual cards
   */
  private async calculateTotals(dateRange: { from: Date; to: Date }): Promise<AnalyticsTotalsDTO> {
    const { data, error } = await this.supabase
      .from("flashcards")
      .select("origin")
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString())
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to fetch flashcard totals: ${error.message}`);
    }

    const totals = data.reduce(
      (acc, card) => {
        if (card.origin === "ai-full" || card.origin === "ai-edited") {
          acc.ai++;
        } else if (card.origin === "manual") {
          acc.manual++;
        }
        return acc;
      },
      { ai: 0, manual: 0 }
    );

    return totals;
  }

  /**
   * Aggregates trend data grouped by specified criteria.
   * @param dateRange Date range for filtering
   * @param groupBy Grouping criteria (day, category, origin)
   * @returns Array of trend data points
   */
  private async aggregateTrendData(dateRange: { from: Date; to: Date }): Promise<AnalyticsTrendPointDTO[]> {
    const { data, error } = await this.supabase
      .from("flashcards")
      .select("created_at, origin")
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString())
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch trend data: ${error.message}`);
    }

    const grouped = data.reduce(
      (acc, card) => {
        const date = card.created_at.split("T")[0]; // YYYY-MM-DD format

        if (!acc[date]) {
          acc[date] = { ai: 0, manual: 0, accepted_ai: 0 };
        }

        if (card.origin === "ai-full" || card.origin === "ai-edited") {
          acc[date].ai++;
          acc[date].accepted_ai++;
        } else if (card.origin === "manual") {
          acc[date].manual++;
        }

        return acc;
      },
      {} as Record<string, { ai: number; manual: number; accepted_ai: number }>
    );

    return Object.entries(grouped)
      .map(([date, counts]) => ({
        date,
        ai: counts.ai,
        manual: counts.manual,
        accepted_ai: counts.accepted_ai,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculates date range based on query parameters.
   * @param params Query parameters containing range specification
   * @returns Object with from and to Date objects
   */
  private calculateDateRange(params: AdminKpiQuery): { from: Date; to: Date } {
    const now = new Date();
    let from: Date;
    let to: Date = now;

    if (params.range === "custom") {
      if (!params.from || !params.to) {
        throw new Error("Custom range requires both 'from' and 'to' dates");
      }
      from = new Date(params.from);
      to = new Date(params.to);
    } else {
      const days = params.range === "30d" ? 30 : 7;
      from = new Date(now);
      from.setDate(now.getDate() - days);
    }

    return { from, to };
  }
}

/**
 * Factory function to create AnalyticsService instance.
 * @param supabase Supabase client instance
 * @returns Configured AnalyticsService instance
 */
export function createAnalyticsService(supabase: SupabaseClient): AnalyticsService {
  return new AnalyticsService(supabase);
}
