import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseClient } from "../../../../../db/supabase.client";
import { USER_ROLES_ERROR_CODES, buildErrorResponse } from "../../../../../lib/errors";
import { deleteUserRole, UserRoleServiceError } from "../../../../../lib/services/user-roles.service";
import { userRolePathParamsSchema } from "../../../../../lib/validation/user-roles.schema";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const USER_ROLES_EVENT_SCOPE = "api/admin/user-roles/[userId]/[role]";

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
 * DELETE /api/admin/user-roles/[userId]/[role]
 *
 * Removes an administrator role from a specified user.
 * Requires admin privileges for access.
 *
 * This endpoint allows administrators to revoke admin roles from other users.
 * The operation is atomic and includes validation to ensure the role exists before removal.
 *
 * Security considerations:
 * - Requires authenticated user with admin privileges
 * - Uses Row Level Security (RLS) for additional data access control
 * - Prevents privilege escalation through strict validation
 * - Logs all role removal operations for audit purposes
 *
 * @param locals - Astro locals containing user and supabase client
 * @param params - URL parameters containing userId and role
 * @returns Response with 204 status on success or error response
 */
export const DELETE: APIRoute = async ({ locals, params }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordUserRolesEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, USER_ROLES_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordUserRolesEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.UNAUTHORIZED,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  // Validate path parameters
  const validationResult = userRolePathParamsSchema.safeParse(params);
  if (!validationResult.success) {
    const descriptor = buildErrorResponse(400, USER_ROLES_ERROR_CODES.INVALID_PATH_PARAMS, "Invalid path parameters.");
    recordUserRolesEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.INVALID_PATH_PARAMS,
      details: {
        reason: "validation_failed",
        userId: locals.user.id,
        validationErrors: validationResult.error.issues,
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const { userId, role } = validationResult.data;

  // Verify admin privileges
  try {
    const isAdmin = await checkAdminStatus(supabase);
    if (!isAdmin) {
      const descriptor = buildErrorResponse(
        403,
        USER_ROLES_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        "Admin privileges required."
      );
      recordUserRolesEvent({
        severity: "error",
        status: descriptor.status,
        code: USER_ROLES_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        details: { reason: "user_not_admin", userId: locals.user.id, targetUserId: userId, role },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }
  } catch (error) {
    const descriptor = buildErrorResponse(500, USER_ROLES_ERROR_CODES.DB_ERROR, "Failed to verify admin privileges.");
    recordUserRolesEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.DB_ERROR,
      details: {
        reason: "admin_check_failed",
        userId: locals.user.id,
        targetUserId: userId,
        role,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  // Delete the user role
  try {
    await deleteUserRole(supabase, userId, role);

    recordUserRolesEvent({
      severity: "info",
      status: 204,
      code: "user_role_deleted",
      details: {
        reason: "user_role_revoked_successfully",
        userId: locals.user.id,
        targetUserId: userId,
        role,
      },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    // Handle role not found error
    if (error instanceof UserRoleServiceError && error.code === "role_not_found") {
      const descriptor = buildErrorResponse(
        404,
        USER_ROLES_ERROR_CODES.ROLE_NOT_FOUND,
        "User does not have this role."
      );
      recordUserRolesEvent({
        severity: "error",
        status: descriptor.status,
        code: USER_ROLES_ERROR_CODES.ROLE_NOT_FOUND,
        details: {
          reason: "role_not_found",
          userId: locals.user.id,
          targetUserId: userId,
          role,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    // Handle database errors
    if (isPostgrestError(error)) {
      const descriptor = buildErrorResponse(500, USER_ROLES_ERROR_CODES.DB_ERROR, "Failed to delete user role.", {
        code: error.code,
        message: error.message,
      });
      recordUserRolesEvent({
        severity: "error",
        status: descriptor.status,
        code: USER_ROLES_ERROR_CODES.DB_ERROR,
        details: {
          reason: "postgrest_error",
          userId: locals.user.id,
          targetUserId: userId,
          role,
          db_code: error.code,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    // Handle other unexpected errors
    const descriptor = buildErrorResponse(
      500,
      USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while deleting user role."
    );
    recordUserRolesEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      details: {
        reason: "unexpected_delete_error",
        userId: locals.user.id,
        targetUserId: userId,
        role,
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

interface UserRolesEventPayload {
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
function recordUserRolesEvent(payload: UserRolesEventPayload): void {
  const entry = {
    scope: USER_ROLES_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: payload.userId ?? "unknown",
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${USER_ROLES_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
