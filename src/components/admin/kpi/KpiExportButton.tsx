import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { KpiExportFormat } from "@/lib/analytics-kpi.types";

interface KpiExportButtonProps {
  hasData: boolean;
  onExport: (format: KpiExportFormat) => void;
}

export function KpiExportButton({ hasData, onExport }: KpiExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!hasData} className="gap-2" aria-label="Export KPI data">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport("csv")}>Export as CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("json")}>Export as JSON</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
