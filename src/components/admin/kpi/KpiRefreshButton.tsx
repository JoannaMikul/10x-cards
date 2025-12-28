import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface KpiRefreshButtonProps {
  isLoading: boolean;
  isRangeValid: boolean;
  onClick: () => void;
}

export function KpiRefreshButton({ isLoading, isRangeValid, onClick }: KpiRefreshButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            disabled={isLoading || !isRangeValid}
            className="gap-2"
            aria-label={isLoading ? "Refreshing KPI data" : "Refresh KPI data"}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refresh KPI data</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
