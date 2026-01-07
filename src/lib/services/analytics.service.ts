import type { SupabaseClient } from "../../db/supabase.client";
import type { AnalyticsKpiResponse, AnalyticsTotalsDTO, AnalyticsTrendPointDTO } from "../../types";
import type { AdminKpiQuery } from "../validation/admin-kpi.schema";

/**
 * Analytics service for calculating KPI metrics for admin dashboard.
 * Provides AI acceptance rates, AI share ratios, and trend data.
 */
export class AnalyticsService {
  constructor(private readonly supabase: SupabaseClient) {}

  // Alternative: extract database operations to testable methods
  protected async countTotalCandidates(dateRange: { from: Date; to: Date }): Promise<number> {
    const { count, error } = await this.supabase
      .from("generation_candidates")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString());

    if (error) throw error;
    return count ?? 0;
  }

  protected async countAcceptedCandidates(dateRange: { from: Date; to: Date }): Promise<number> {
    const { count, error } = await this.supabase
      .from("generation_candidates")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString())
      .or("status.eq.accepted,accepted_card_id.not.is.null");

    if (error) throw error;
    return count ?? 0;
  }

  /**
   * Calculates key performance indicators for flashcard generation and usage.
   * @param params Query parameters for filtering KPI data
   * @returns Comprehensive KPI metrics including acceptance rates, shares, and trends
   */
  async getKpiMetrics(params: AdminKpiQuery): Promise<AnalyticsKpiResponse> {
    const dateRange = this.calculateDateRange(params);

    const [totals, trend, aiAcceptanceRate] = await Promise.all([
      this.calculateTotals(dateRange),
      this.aggregateTrendData(dateRange),
      this.calculateAiAcceptanceRate(dateRange),
    ]);

    return {
      ai_acceptance_rate: aiAcceptanceRate,
      ai_share: totals.ai > 0 ? totals.ai / (totals.ai + totals.manual) : 0,
      totals,
      trend,
    };
  }

  /**
   * Calculates AI acceptance rate from generation candidates data.
   * @param dateRange Date range for filtering candidates
   * @returns Acceptance rate as a decimal between 0 and 1
   */
  private async calculateAiAcceptanceRate(dateRange: { from: Date; to: Date }): Promise<number> {
    const totalCount = await this.countTotalCandidates(dateRange);

    if (totalCount === 0) {
      return 0;
    }

    const acceptedCount = await this.countAcceptedCandidates(dateRange);
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
        // Handle different date formats - ensure we get YYYY-MM-DD
        const date = new Date(card.created_at).toISOString().split("T")[0];

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

      // Validate that dates are valid
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error("Invalid date format provided for custom range");
      }

      // Ensure from is before to
      if (from >= to) {
        throw new Error("'from' date must be before 'to' date");
      }

      // Prevent future dates
      if (to > now) {
        to = now;
      }
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
