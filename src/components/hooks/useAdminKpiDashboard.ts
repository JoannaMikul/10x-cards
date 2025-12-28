import { useState, useCallback } from "react";
import { toast } from "sonner";
import { fetchAdminKpi } from "../../lib/services/admin-kpi.service";
import type { AdminKpiRange, AdminKpiState, KpiExportFormat } from "../../lib/analytics-kpi.types";
import type { ApiErrorResponse } from "../../types";

interface UseAdminKpiDashboardReturn {
  state: AdminKpiState;
  setRange: (range: AdminKpiRange) => void;
  setCustomRange: (from: Date | null, to: Date | null) => void;
  refresh: () => Promise<void>;
  export: (format: KpiExportFormat) => void;
}

/**
 * Validates date range for custom range selection.
 * @param from Start date
 * @param to End date
 * @returns Array of validation error messages
 */
function validateDateRange(from: Date | null, to: Date | null): string[] {
  const errors: string[] = [];

  if (!from || !to) {
    errors.push("Both date fields must be filled for custom range");
    return errors;
  }

  if (from > to) {
    errors.push("Start date cannot be later than end date");
  }

  const diffInMs = to.getTime() - from.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  if (diffInDays > 90) {
    errors.push("Date range cannot exceed 90 days");
  }

  return errors;
}

function createInitialState(): AdminKpiState {
  return {
    query: {
      range: "7d",
      group_by: "day",
    },
    data: undefined,
    loading: false,
    error: null,
    lastUpdatedAt: undefined,
    isPristine: true,
    validationErrors: [],
    lastStatusCode: undefined,
  };
}

export function useAdminKpiDashboard(): UseAdminKpiDashboardReturn {
  const [state, setState] = useState<AdminKpiState>(createInitialState);

  const setRange = useCallback((range: AdminKpiRange) => {
    setState((prev) => ({
      ...prev,
      query: {
        ...prev.query,
        range,
        ...(range !== "custom" && { from: undefined, to: undefined }),
      },
      validationErrors: [],
    }));
  }, []);

  const setCustomRange = useCallback((from: Date | null, to: Date | null) => {
    const fromIso = from ? from.toISOString().split("T")[0] : undefined;
    const toIso = to ? to.toISOString().split("T")[0] : undefined;
    const errors = validateDateRange(from, to);

    setState((prev) => ({
      ...prev,
      query: {
        ...prev.query,
        from: fromIso,
        to: toIso,
      },
      validationErrors: errors,
    }));
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => {
      if (prev.validationErrors.length > 0) {
        toast.error("Fix form errors before refreshing data");
        return prev;
      }

      return { ...prev, loading: true, error: null };
    });

    try {
      const currentState = await new Promise<AdminKpiState>((resolve) => {
        setState((prev) => {
          resolve(prev);
          return prev;
        });
      });

      const data = await fetchAdminKpi(currentState.query);

      setState((prev) => ({
        ...prev,
        data,
        loading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
        isPristine: false,
        lastStatusCode: 200,
      }));

      toast.success("Data refreshed successfully");
    } catch (error) {
      const apiError = error as { status: number; body: ApiErrorResponse };
      const errorMessage = apiError.body?.error?.message || "An error occurred while fetching data";

      setState((prev) => ({
        ...prev,
        loading: false,
        error: apiError.body,
        lastStatusCode: apiError.status,
      }));

      toast.error(errorMessage);
    }
  }, []);

  const exportData = useCallback(
    (format: KpiExportFormat) => {
      if (!state.data) {
        toast.error("No data to export");
        return;
      }

      try {
        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `kpi-analytics-${timestamp}.${format}`;

        if (format === "json") {
          const blob = new Blob([JSON.stringify(state.data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else if (format === "csv") {
          const csvRows: string[] = [];

          csvRows.push("Totals");
          csvRows.push("Metric,Value");
          csvRows.push(`AI Cards,${state.data.totals.ai}`);
          csvRows.push(`Manual Cards,${state.data.totals.manual}`);
          csvRows.push(`AI Acceptance Rate,${state.data.ai_acceptance_rate}`);
          csvRows.push(`AI Share,${state.data.ai_share}`);
          csvRows.push("");

          csvRows.push("Trend Data");
          csvRows.push("Date,AI Cards,Manual Cards,Accepted AI");
          state.data.trend.forEach((point) => {
            csvRows.push(`${point.date},${point.ai},${point.manual},${point.accepted_ai}`);
          });

          const csvContent = csvRows.join("\n");
          const blob = new Blob([csvContent], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        toast.success(`Data exported as ${format.toUpperCase()}`);
      } catch {
        toast.error("An error occurred during export");
      }
    },
    [state.data]
  );

  return {
    state,
    setRange,
    setCustomRange,
    refresh,
    export: exportData,
  };
}
