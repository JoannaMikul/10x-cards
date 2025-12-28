import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAdminKpiDashboard } from "../../hooks/useAdminKpiDashboard";
import type { ApiErrorResponse } from "../../../types";

interface KpiErrorStateProps {
  error: ApiErrorResponse | null;
  statusCode?: number;
  onRetry?: () => void;
}

export function KpiErrorState({ error, statusCode, onRetry }: KpiErrorStateProps) {
  const { refresh } = useAdminKpiDashboard();

  const getErrorMessage = () => {
    if (statusCode === 401) {
      return "Your session has expired or you are not logged in. Please log in again.";
    }
    if (statusCode === 403) {
      return "Only administrators have access to the KPI dashboard.";
    }
    if (statusCode === 400) {
      return "Query validation error. Please check the selected parameters.";
    }
    if (statusCode && statusCode >= 500) {
      return "A server error occurred. Please try again later.";
    }
    return error?.error?.message || "An unexpected error occurred while fetching data.";
  };

  const canRetry = statusCode !== 403;

  return (
    <Alert variant="destructive" role="alert">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{getErrorMessage()}</p>
        {canRetry && (
          <Button variant="outline" size="sm" onClick={onRetry || refresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
