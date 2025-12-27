import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseClient } from "../../../db/supabase.client.ts";
import { USER_ROLES_ERROR_CODES, buildErrorResponse } from "../../../lib/errors.ts";
import { getUserRoles, createUserRole, UserRoleServiceError } from "../../../lib/services/user-roles.service.ts";
import { createUserRoleSchema } from "../../../lib/validation/user-roles.schema.ts";
import type { CreateUserRoleCommand, UserRoleListResponse } from "../../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const USER_ROLES_EVENT_SCOPE = "api/admin/user-roles";

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
 * GET /api/admin/user-roles
 *
 * Retrieves all user role assignments in the system for audit purposes.
 * Requires admin privileges for access.
 *
 * This endpoint provides a complete list of all administrator role assignments
 * across the system, sorted by grant date in descending order (most recent first).
 * The list is not paginated as the number of admin roles is expected to be small.
 *
 * Security considerations:
 * - Requires authenticated user with admin privileges
 * - Uses Row Level Security (RLS) for additional data access control
 * - Returns sensitive information about admin role assignments
 *
 * @param locals - Astro locals containing user and supabase client
 * @returns Response with user roles data or error response
 */
export const GET: APIRoute = async ({ locals }) => {
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
        details: { reason: "user_not_admin", userId: locals.user.id },
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
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    const result: UserRoleListResponse = await getUserRoles(supabase);

    recordUserRolesEvent({
      severity: "info",
      status: 200,
      code: "user_roles_retrieved",
      details: {
        reason: "user_roles_retrieved_successfully",
        userId: locals.user.id,
        totalRoles: result.data.length,
      },
    });

    return jsonResponse(200, result);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = buildErrorResponse(
        500,
        USER_ROLES_ERROR_CODES.DB_ERROR,
        "Failed to retrieve user roles from the database.",
        { code: error.code, message: error.message }
      );
      recordUserRolesEvent({
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
      "Unexpected error while retrieving user roles."
    );
    recordUserRolesEvent({
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
 * POST /api/admin/user-roles
 *
 * Grants an administrator role to a specified user.
 * Requires admin privileges for access.
 *
 * This endpoint allows administrators to grant admin roles to other users.
 * The operation is atomic and includes validation to prevent duplicate role assignments.
 *
 * Security considerations:
 * - Requires authenticated user with admin privileges
 * - Uses Row Level Security (RLS) for additional data access control
 * - Prevents privilege escalation through strict validation
 *
 * @param locals - Astro locals containing user and supabase client
 * @returns Response with 201 status on success or error response
 */
export const POST: APIRoute = async ({ request, locals }) => {
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
        details: { reason: "user_not_admin", userId: locals.user.id },
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
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  // Parse and validate request body
  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (error) {
    const descriptor = buildErrorResponse(400, USER_ROLES_ERROR_CODES.INVALID_BODY, "Request body must be valid JSON.");
    recordUserRolesEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.INVALID_BODY,
      details: {
        reason: "invalid_json",
        userId: locals.user.id,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const validationResult = createUserRoleSchema.safeParse(requestBody);
  if (!validationResult.success) {
    const issues = validationResult.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
    }));
    const descriptor = buildErrorResponse(400, USER_ROLES_ERROR_CODES.INVALID_BODY, "Invalid request body.", {
      issues,
    });
    recordUserRolesEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.INVALID_BODY,
      details: {
        reason: "validation_failed",
        userId: locals.user.id,
        validationErrors: issues,
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const cmd: CreateUserRoleCommand = validationResult.data;

  // Create the user role
  try {
    await createUserRole(supabase, cmd);

    recordUserRolesEvent({
      severity: "info",
      status: 201,
      code: "user_role_created",
      details: {
        reason: "user_role_granted_successfully",
        userId: locals.user.id,
        targetUserId: cmd.user_id,
        role: cmd.role,
      },
    });

    return jsonResponse(201, null);
  } catch (error) {
    // Handle role already exists error
    if (error instanceof UserRoleServiceError && error.code === "role_exists") {
      const descriptor = buildErrorResponse(409, USER_ROLES_ERROR_CODES.ROLE_EXISTS, "User already has this role.");
      recordUserRolesEvent({
        severity: "error",
        status: descriptor.status,
        code: USER_ROLES_ERROR_CODES.ROLE_EXISTS,
        details: {
          reason: "role_already_exists",
          userId: locals.user.id,
          targetUserId: cmd.user_id,
          role: cmd.role,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    // Handle database errors
    if (isPostgrestError(error)) {
      const descriptor = buildErrorResponse(500, USER_ROLES_ERROR_CODES.DB_ERROR, "Failed to create user role.", {
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
          targetUserId: cmd.user_id,
          role: cmd.role,
          db_code: error.code,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    // Handle other unexpected errors
    const descriptor = buildErrorResponse(
      500,
      USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while creating user role."
    );
    recordUserRolesEvent({
      severity: "error",
      status: descriptor.status,
      code: USER_ROLES_ERROR_CODES.UNEXPECTED_ERROR,
      details: {
        reason: "unexpected_create_error",
        userId: locals.user.id,
        targetUserId: cmd.user_id,
        role: cmd.role,
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
