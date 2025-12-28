import { useAdminKpiDashboard } from "../../hooks/useAdminKpiDashboard";
import { KpiRangePicker } from "./KpiRangePicker";
import { KpiRefreshButton } from "./KpiRefreshButton";
import { KpiExportButton } from "./KpiExportButton";

export function KpiControlsBar() {
  const { state, setRange, setCustomRange, refresh, export: exportData } = useAdminKpiDashboard();

  const hasData = !!state.data;
  const isRangeValid = state.validationErrors.length === 0;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-end p-4 border rounded-lg bg-muted/20">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center min-w-0 flex-1 w-full">
        <KpiRangePicker
          range={state.query.range}
          customFrom={state.query.from ? new Date(state.query.from) : null}
          customTo={state.query.to ? new Date(state.query.to) : null}
          rangeError={state.validationErrors.length > 0 ? state.validationErrors[0] : undefined}
          onRangeChange={setRange}
          onCustomRangeChange={setCustomRange}
        />
      </div>

      <div className="flex gap-2 place-self-start sm:place-self-end">
        <KpiRefreshButton isLoading={state.loading} isRangeValid={isRangeValid} onClick={refresh} />
        <KpiExportButton hasData={hasData} onExport={exportData} />
      </div>
    </div>
  );
}
