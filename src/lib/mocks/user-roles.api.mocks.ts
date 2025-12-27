import type { UserRolesErrorCode } from "../errors.ts";
import type { ApiErrorResponse, UserRoleListResponse, CreateUserRoleCommand } from "../../types";

export interface UserRolesApiMock {
  description: string;
  status: number;
  request: {
    method: "GET" | "POST";
    url: string;
    headers?: Record<string, string>;
    body?: CreateUserRoleCommand;
  };
  response: UserRoleListResponse | null | ApiErrorResponse<UserRolesErrorCode>;
}

export const userRolesApiMocks: UserRolesApiMock[] = [
  {
    description: "200 OK – successful retrieval of user roles",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      data: [
        {
          user_id: "550e8400-e29b-41d4-a716-446655440001",
          role: "admin",
          granted_at: "2024-12-27T10:00:00.000Z",
        },
        {
          user_id: "550e8400-e29b-41d4-a716-446655440002",
          role: "admin",
          granted_at: "2024-12-27T09:30:00.000Z",
        },
        {
          user_id: "550e8400-e29b-41d4-a716-446655440003",
          role: "admin",
          granted_at: "2024-12-26T15:45:00.000Z",
        },
      ],
      page: {
        next_cursor: null,
        has_more: false,
      },
    },
  },
  {
    description: "200 OK – empty list when no admin roles exist",
    status: 200,
    request: {
      method: "GET",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      data: [],
      page: {
        next_cursor: null,
        has_more: false,
      },
    },
  },
  {
    description: "401 Unauthorized – user not authenticated",
    status: 401,
    request: {
      method: "GET",
      url: "/api/admin/user-roles",
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authenticated.",
      },
    },
  },
  {
    description: "403 Forbidden – user not admin",
    status: 403,
    request: {
      method: "GET",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer regular-user-token",
      },
    },
    response: {
      error: {
        code: "insufficient_permissions",
        message: "Admin privileges required.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database connection failure",
    status: 500,
    request: {
      method: "GET",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "Failed to retrieve user roles from the database.",
        details: {
          code: "ECONNREFUSED",
          message: "Connection refused",
        },
      },
    },
  },
  {
    description: "500 Internal Server Error – unexpected database error",
    status: 500,
    request: {
      method: "GET",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "Failed to retrieve user roles from the database.",
        details: {
          code: "XX000",
          message: 'duplicate key value violates unique constraint "user_roles_pkey"',
        },
      },
    },
  },
  {
    description: "500 Internal Server Error – unexpected application error",
    status: 500,
    request: {
      method: "GET",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
      },
    },
    response: {
      error: {
        code: "unexpected_error",
        message: "Unexpected error while retrieving user roles.",
      },
    },
  },

  // POST /api/admin/user-roles mocks
  {
    description: "201 Created – successfully granted admin role",
    status: 201,
    request: {
      method: "POST",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: {
        user_id: "550e8400-e29b-41d4-a716-446655440004",
        role: "admin",
      },
    },
    response: null,
  },
  {
    description: "400 Bad Request – invalid body (invalid UUID)",
    status: 400,
    request: {
      method: "POST",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: {
        user_id: "invalid-uuid",
        role: "admin",
      } as CreateUserRoleCommand,
    },
    response: {
      error: {
        code: "invalid_body",
        message: "Invalid request body.",
        details: {
          issues: [
            {
              message: "User ID must be a valid UUID.",
              path: ["user_id"],
            },
          ],
        },
      },
    },
  },
  {
    description: "401 Unauthorized – user not authenticated",
    status: 401,
    request: {
      method: "POST",
      url: "/api/admin/user-roles",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        user_id: "550e8400-e29b-41d4-a716-446655440004",
        role: "admin",
      },
    },
    response: {
      error: {
        code: "unauthorized",
        message: "User not authenticated.",
      },
    },
  },
  {
    description: "403 Forbidden – user not admin",
    status: 403,
    request: {
      method: "POST",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer regular-user-token",
        "Content-Type": "application/json",
      },
      body: {
        user_id: "550e8400-e29b-41d4-a716-446655440004",
        role: "admin",
      },
    },
    response: {
      error: {
        code: "insufficient_permissions",
        message: "Admin privileges required.",
      },
    },
  },
  {
    description: "409 Conflict – role already exists",
    status: 409,
    request: {
      method: "POST",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: {
        user_id: "550e8400-e29b-41d4-a716-446655440001",
        role: "admin",
      },
    },
    response: {
      error: {
        code: "role_exists",
        message: "User already has this role.",
      },
    },
  },
  {
    description: "500 Internal Server Error – database error during role creation",
    status: 500,
    request: {
      method: "POST",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: {
        user_id: "550e8400-e29b-41d4-a716-446655440004",
        role: "admin",
      },
    },
    response: {
      error: {
        code: "db_error",
        message: "Failed to create user role.",
        details: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "user_roles_pkey"',
        },
      },
    },
  },
  {
    description: "500 Internal Server Error – unexpected error during role creation",
    status: 500,
    request: {
      method: "POST",
      url: "/api/admin/user-roles",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: {
        user_id: "550e8400-e29b-41d4-a716-446655440004",
        role: "admin",
      },
    },
    response: {
      error: {
        code: "unexpected_error",
        message: "Unexpected error while creating user role.",
      },
    },
  },
];
