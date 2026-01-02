import type { AnalyticsKpiResponse, ApiErrorResponse } from "../../types";
import type { AdminKpiQueryParams } from "../analytics-kpi.types";

/**
 * Fetches admin KPI data from the API endpoint.
 * @param params Query parameters for the KPI request
 * @returns Promise resolving to AnalyticsKpiResponse
 * @throws {status: number, body: ApiErrorResponse} when API returns error
 */
export async function fetchAdminKpi(params: AdminKpiQueryParams): Promise<AnalyticsKpiResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("range", params.range);
  searchParams.set("group_by", params.group_by);

  if (params.range === "custom") {
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
  }

  const urlString = `/api/admin/kpi?${searchParams.toString()}`;
  const res = await globalThis.fetch(urlString, { method: "GET" });

  const json = await res.json();

  if (!res.ok) {
    throw { status: res.status, body: json } as { status: number; body: ApiErrorResponse };
  }

  return json as AnalyticsKpiResponse;
}
