export type AdminKpiRange = "7d" | "30d" | "custom";

export interface AdminKpiQueryParams {
  range: AdminKpiRange;
  group_by: "day";
  from?: string;
  to?: string;
}

export interface AdminKpiState {
  query: AdminKpiQueryParams;
  data?: import("../types").AnalyticsKpiResponse;
  loading: boolean;
  error?: import("../types").ApiErrorResponse | null;
  lastUpdatedAt?: string;
  isPristine: boolean;
  validationErrors: string[];
  lastStatusCode?: number;
}

export interface KpiCardsViewModel {
  aiAcceptanceRatePercent: number;
  aiSharePercent: number;
  totalAi: number;
  totalManual: number;
  totalAll: number;
}

export interface KpiTrendPointViewModel {
  date: Date;
  label: string;
  ai: number;
  manual: number;
  acceptedAi: number;
}

export type KpiExportFormat = "csv" | "json";
