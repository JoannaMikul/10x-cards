import type { APIRoute } from "astro";
import type { PostgrestError, User } from "@supabase/supabase-js";

import { supabaseClient } from "../../../db/supabase.client.ts";
import { USER_ROLES_ERROR_CODES, buildErrorResponse } from "../../../lib/errors.ts";
import type { UserListResponse } from "../../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const USERS_EVENT_SCOPE = "api/admin/users";

/**
 * Checks if the current user has admin privileges.
 * @param supabase Supabase client instance
 * @returns Promise resolving to true if user is admin, throws error otherwise
 */
async function checkAdminStatus(supabase: NonNullable<typeof supabaseClient>): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");

  if (error) {
    throw new Error(`Failed to verify admin privileges: ${error.message}`);
  }

  return data === true;
}

/**
 * GET /api/admin/users
 *
 * Retrieves all users in the system for admin management purposes.
 * Requires admin privileges for access.
 *
 * This endpoint provides a complete list of all users in the system,
 * allowing administrators to manage user roles and permissions.
 *
 * Security considerations:
 * - Requires authenticated user with admin privileges
 * - Returns sensitive user information
 *
 * @param locals - Astro locals containing user and supabase client
 * @returns Response with users data or error response
 */
export const GET: APIRoute = async ({ locals }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordUsersEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, USER_ROLES_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordUsersEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.UNAUTHORIZED,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    const isAdmin = await checkAdminStatus(supabase);
    if (!isAdmin) {
      const descriptor = buildErrorResponse(
        403,
        USER_ROLES_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        "Admin privileges required."
      );
      recordUsersEvent({
        severity: "error",
        status: descriptor.status,
        code: USER_ROLES_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        details: { reason: "user_not_admin", userId: locals.user.id },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }
  } catch (error) {
    const descriptor = buildErrorResponse(500, USER_ROLES_ERROR_CODES.DB_ERROR, "Failed to verify admin privileges.");
    recordUsersEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.DB_ERROR,
      details: {
        reason: "admin_check_failed",
        userId: locals.user.id,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    // Get all users from Supabase Auth Admin API
    // This requires service role key and admin SDK
    const { createClient } = await import("@supabase/supabase-js");

    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      recordUsersEvent({
        severity: "error",
        status: 500,
        code: USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
        details: {
          reason: "missing_service_role_key",
          userId: locals.user.id,
        },
      });
      return jsonResponse(500, {
        error: "Service role key not configured. Cannot retrieve users.",
      });
    }

    const supabaseAdmin = createClient(import.meta.env.SUPABASE_URL, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      recordUsersEvent({
        severity: "error",
        status: 500,
        code: USER_ROLES_ERROR_CODES.DB_ERROR,
        details: {
          reason: "failed_to_list_users",
          userId: locals.user.id,
          error: usersError.message,
        },
      });
      return jsonResponse(500, { error: "Failed to retrieve users" });
    }

    const users = (usersData.users ?? [])
      .filter((user: User): user is User & { email: string } => Boolean(user.email))
      .map((user: User & { email: string }) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      }));

    const result: UserListResponse = {
      data: users,
      page: {
        next_cursor: null,
        has_more: false,
      },
    };

    recordUsersEvent({
      severity: "info",
      status: 200,
      code: "users_retrieved",
      details: {
        reason: "users_retrieved_via_admin_api",
        userId: locals.user.id,
        totalUsers: users.length,
      },
    });

    return jsonResponse(200, result);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = buildErrorResponse(
        500,
        USER_ROLES_ERROR_CODES.DB_ERROR,
        "Failed to retrieve users from the database.",
        { code: error.code, message: error.message }
      );
      recordUsersEvent({
        severity: "error",
        status: descriptor.status,
        code: USER_ROLES_ERROR_CODES.DB_ERROR,
        details: {
          reason: "postgrest_error",
          userId: locals.user.id,
          db_code: error.code,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while retrieving users."
    );
    recordUsersEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      details: {
        reason: "unexpected_fetch_error",
        userId: locals.user.id,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

/**
 * Creates a JSON response with proper headers.
 * @param status HTTP status code
 * @param body Response body to be JSON serialized
 * @returns Response object with JSON content
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

/**
 * Type guard to check if an error is a PostgREST error.
 * @param error The error to check
 * @returns True if the error is a PostgREST error with a code property
 */
function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(
    error && typeof error === "object" && "code" in error && typeof (error as Record<string, unknown>).code === "string"
  );
}

interface UsersEventPayload {
  severity: "info" | "error";
  status: number;
  code: string;
  userId?: string;
  details?: Record<string, unknown>;
}

/* eslint-disable no-console */
/**
 * Records an event for audit and monitoring purposes.
 * Logs to console with structured JSON format.
 * @param payload Event details including severity, status, and metadata
 */
function recordUsersEvent(payload: UsersEventPayload): void {
  const entry = {
    scope: USERS_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: payload.userId ?? "unknown",
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${USERS_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
