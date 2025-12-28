import { FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminKpiDashboard } from "../../hooks/useAdminKpiDashboard";

export function KpiEmptyState() {
  const { setRange } = useAdminKpiDashboard();

  const handleResetFilters = () => {
    setRange("7d");
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" role="status" aria-live="polite">
      <div className="rounded-full bg-muted p-6 mb-4">
        <FileX className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Data</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        No data found for the selected time range. Try changing the date range or check if flashcards have been created
        in the system.
      </p>
      <Button onClick={handleResetFilters} variant="outline">
        Reset Filters
      </Button>
    </div>
  );
}
