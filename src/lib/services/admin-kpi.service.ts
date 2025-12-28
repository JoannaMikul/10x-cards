import type { AnalyticsKpiResponse, ApiErrorResponse } from "../../types";
import type { AdminKpiQueryParams } from "../analytics-kpi.types";

/**
 * Fetches admin KPI data from the API endpoint.
 * @param params Query parameters for the KPI request
 * @returns Promise resolving to AnalyticsKpiResponse
 * @throws {status: number, body: ApiErrorResponse} when API returns error
 */
export async function fetchAdminKpi(params: AdminKpiQueryParams): Promise<AnalyticsKpiResponse> {
  const url = new URL("/api/admin/kpi", window.location.origin);
  url.searchParams.set("range", params.range);
  url.searchParams.set("group_by", params.group_by);

  if (params.range === "custom") {
    if (params.from) url.searchParams.set("from", params.from);
    if (params.to) url.searchParams.set("to", params.to);
  }

  const res = await fetch(url.toString(), { method: "GET" });

  const json = await res.json();

  if (!res.ok) {
    throw { status: res.status, body: json } as { status: number; body: ApiErrorResponse };
  }

  return json as AnalyticsKpiResponse;
}
