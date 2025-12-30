import type { ApiErrorResponse, AnalyticsKpiResponse } from "../../../types";
import type { AnalyticsErrorCode } from "../../errors";

export interface AdminKpiApiMock {
  description: string;
  status: number;
  request: {
    method: "GET";
    url: string;
    headers?: Record<string, string>;
  };
  response: AnalyticsKpiResponse | ApiErrorResponse<AnalyticsErrorCode>;
}

export const adminKpiApiMocks: AdminKpiApiMock[] = [
  {
    description: "200 OK – 7 day range with balanced AI/manual activity",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=7d&group_by=day",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      ai_acceptance_rate: 0.75,
      ai_share: 0.6,
      totals: {
        ai: 42,
        manual: 28,
      },
      trend: [
        {
          date: "2024-12-20T00:00:00.000Z",
          ai: 8,
          manual: 4,
          accepted_ai: 6,
        },
        {
          date: "2024-12-21T00:00:00.000Z",
          ai: 6,
          manual: 6,
          accepted_ai: 4,
        },
        {
          date: "2024-12-22T00:00:00.000Z",
          ai: 10,
          manual: 2,
          accepted_ai: 8,
        },
        {
          date: "2024-12-23T00:00:00.000Z",
          ai: 7,
          manual: 5,
          accepted_ai: 6,
        },
        {
          date: "2024-12-24T00:00:00.000Z",
          ai: 4,
          manual: 4,
          accepted_ai: 3,
        },
        {
          date: "2024-12-25T00:00:00.000Z",
          ai: 2,
          manual: 3,
          accepted_ai: 1,
        },
        {
          date: "2024-12-26T00:00:00.000Z",
          ai: 5,
          manual: 4,
          accepted_ai: 4,
        },
      ],
    },
  },
  {
    description: "200 OK – 30 day range with high AI usage",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=30d&group_by=day",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      ai_acceptance_rate: 0.82,
      ai_share: 0.78,
      totals: {
        ai: 234,
        manual: 66,
      },
      trend: [
        {
          date: "2024-11-27T00:00:00.000Z",
          ai: 12,
          manual: 2,
          accepted_ai: 10,
        },
        {
          date: "2024-11-28T00:00:00.000Z",
          ai: 15,
          manual: 3,
          accepted_ai: 13,
        },
        {
          date: "2024-11-29T00:00:00.000Z",
          ai: 18,
          manual: 4,
          accepted_ai: 15,
        },
        {
          date: "2024-11-30T00:00:00.000Z",
          ai: 14,
          manual: 5,
          accepted_ai: 11,
        },
        {
          date: "2024-12-01T00:00:00.000Z",
          ai: 16,
          manual: 6,
          accepted_ai: 14,
        },
      ],
    },
  },
  {
    description: "200 OK – custom range with from/to dates",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=custom&group_by=day&from=2024-12-01&to=2024-12-15",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      ai_acceptance_rate: 0.68,
      ai_share: 0.55,
      totals: {
        ai: 88,
        manual: 72,
      },
      trend: [
        {
          date: "2024-12-01T00:00:00.000Z",
          ai: 8,
          manual: 12,
          accepted_ai: 5,
        },
        {
          date: "2024-12-02T00:00:00.000Z",
          ai: 6,
          manual: 8,
          accepted_ai: 4,
        },
        {
          date: "2024-12-03T00:00:00.000Z",
          ai: 10,
          manual: 6,
          accepted_ai: 7,
        },
      ],
    },
  },
  {
    description: "200 OK – custom range with only from date",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=custom&group_by=day&from=2024-12-01",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      ai_acceptance_rate: 0.71,
      ai_share: 0.62,
      totals: {
        ai: 156,
        manual: 94,
      },
      trend: [
        {
          date: "2024-12-01T00:00:00.000Z",
          ai: 8,
          manual: 12,
          accepted_ai: 6,
        },
        {
          date: "2024-12-02T00:00:00.000Z",
          ai: 12,
          manual: 8,
          accepted_ai: 9,
        },
      ],
    },
  },
  {
    description: "200 OK – custom range with only to date",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=custom&group_by=day&to=2024-12-15",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      ai_acceptance_rate: 0.65,
      ai_share: 0.48,
      totals: {
        ai: 76,
        manual: 84,
      },
      trend: [
        {
          date: "2024-12-13T00:00:00.000Z",
          ai: 6,
          manual: 14,
          accepted_ai: 4,
        },
        {
          date: "2024-12-14T00:00:00.000Z",
          ai: 8,
          manual: 12,
          accepted_ai: 5,
        },
        {
          date: "2024-12-15T00:00:00.000Z",
          ai: 4,
          manual: 16,
          accepted_ai: 3,
        },
      ],
    },
  },
  {
    description: "200 OK – empty data (no activity in range)",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=7d&group_by=day",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      ai_acceptance_rate: 0,
      ai_share: 0,
      totals: {
        ai: 0,
        manual: 0,
      },
      trend: [],
    },
  },
  {
    description: "401 Unauthorized – missing auth token",
    status: 401,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=7d&group_by=day",
    },
    response: {
      error: {
        code: "unauthorized",
        message: "Authentication required",
      },
    },
  },
  {
    description: "403 Forbidden – user without admin role",
    status: 403,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=7d&group_by=day",
      headers: {
        Authorization: "Bearer user-token",
      },
    },
    response: {
      error: {
        code: "forbidden",
        message: "Admin access required",
      },
    },
  },
  {
    description: "400 Bad Request – invalid date format",
    status: 400,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=custom&group_by=day&from=invalid-date&to=2024-12-15",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Invalid date format in 'from' parameter",
      },
    },
  },
  {
    description: "400 Bad Request – invalid range value",
    status: 400,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=invalid&group_by=day",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      error: {
        code: "invalid_query",
        message: "Invalid range parameter. Must be one of: 7d, 30d, custom",
      },
    },
  },
  {
    description: "500 Internal Server Error – database connection failed",
    status: 500,
    request: {
      method: "GET",
      url: "/api/admin/kpi?range=7d&group_by=day",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "Database connection failed",
      },
    },
  },
];
