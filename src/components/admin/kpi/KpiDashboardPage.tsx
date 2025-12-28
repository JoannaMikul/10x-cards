import { useEffect } from "react";
import { useAdminKpiDashboard } from "../../hooks/useAdminKpiDashboard";
import { KpiHeader } from "./KpiHeader";
import { KpiControlsBar } from "./KpiControlsBar";
import { KpiCards } from "./KpiCards";
import { KpiTrendChart } from "./KpiTrendChart";
import { KpiEmptyState } from "./KpiEmptyState";
import { KpiErrorState } from "./KpiErrorState";
import { Skeleton } from "@/components/ui/skeleton";

export function KpiDashboardPage() {
  const { state, refresh } = useAdminKpiDashboard();

  useEffect(() => {
    if (state.isPristine) {
      refresh();
    }
  }, [state.isPristine, refresh]);

  const hasData = state.data && state.data.totals.ai + state.data.totals.manual > 0;

  const renderContent = () => {
    if (state.loading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }

    if (state.error) {
      return <KpiErrorState error={state.error} statusCode={state.lastStatusCode} onRetry={refresh} />;
    }

    if (!hasData) {
      return <KpiEmptyState />;
    }

    if (state.data) {
      return (
        <>
          <KpiCards data={state.data} />
          <KpiTrendChart trend={state.data.trend} />
        </>
      );
    }

    return null;
  };

  return (
    <main className="container mx-auto px-4 py-6 space-y-6" role="main" aria-labelledby="kpi-dashboard-title">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {state.loading && "Loading KPI data..."}
        {state.error && "Error loading KPI data"}
        {!state.loading && !state.error && state.data && "KPI data loaded successfully"}
      </div>
      <KpiHeader />
      <KpiControlsBar />
      <div className="space-y-6">{renderContent()}</div>
    </main>
  );
}
