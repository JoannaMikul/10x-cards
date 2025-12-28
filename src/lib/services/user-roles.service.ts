import type { Tables } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { CreateUserRoleCommand, UserRoleDTO, UserRoleListResponse } from "../../types";
import type { UserRolesErrorCode } from "../errors.ts";

export class UserRoleServiceError extends Error {
  readonly code: UserRolesErrorCode;

  constructor(code: UserRolesErrorCode, message: string) {
    super(message);
    this.name = "UserRoleServiceError";
    this.code = code;
  }
}

type UserRoleRow = Tables<"user_roles">;
type UserRoleSelect = Pick<UserRoleRow, "user_id" | "role" | "granted_at">;

const USER_ROLE_COLUMNS = "user_id, role, granted_at";

/**
 * Retrieves all user roles in the system for admin audit purposes.
 * This function uses Row Level Security (RLS) which automatically filters
 * results to only include records the current user is authorized to see.
 *
 * @param supabase - Supabase client instance
 * @returns Promise resolving to UserRoleListResponse containing all visible user roles
 * @throws Error if database query fails
 */
export async function getUserRoles(supabase: SupabaseClient): Promise<UserRoleListResponse> {
  const { data, error } = await supabase
    .from("user_roles")
    .select(USER_ROLE_COLUMNS)
    .order("granted_at", { ascending: false });

  if (error) {
    throw error;
  }

  const roles = data ?? [];

  return {
    data: roles.map(mapUserRoleRowToDto),
    page: {
      next_cursor: null, // No pagination for admin audit endpoint
      has_more: false,
    },
  };
}

/**
 * Creates a new user role assignment.
 * This function checks if the role already exists before creating a new assignment.
 *
 * @param supabase - Supabase client instance
 * @param cmd - Command containing user_id and role to assign
 * @throws Error with code "role_exists" if the user already has this role
 * @throws Error if database operations fail
 */
export async function createUserRole(supabase: SupabaseClient, cmd: CreateUserRoleCommand): Promise<void> {
  const { data: existingRole, error: checkError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("user_id", cmd.user_id)
    .eq("role", cmd.role)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    throw new Error(`Failed to check existing role: ${checkError.message}`);
  }

  if (existingRole) {
    throw new UserRoleServiceError("role_exists", "User already has this role");
  }

  const { error: insertError } = await supabase.from("user_roles").insert({
    user_id: cmd.user_id,
    role: cmd.role,
  });

  if (insertError) {
    throw new Error(`Failed to create user role: ${insertError.message}`);
  }
}

/**
 * Deletes a user role assignment.
 * This function first checks if the role exists before attempting to delete it.
 *
 * @param supabase - Supabase client instance
 * @param userId - ID of the user whose role should be removed
 * @param role - Role to remove from the user
 * @throws UserRoleServiceError with code "role_not_found" if the user doesn't have this role
 * @throws Error if database operations fail
 */
export async function deleteUserRole(supabase: SupabaseClient, userId: string, role: string): Promise<void> {
  const { data: existingRole, error: checkError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("user_id", userId)
    .eq("role", role)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    throw new Error(`Failed to check existing role: ${checkError.message}`);
  }

  if (!existingRole) {
    throw new UserRoleServiceError("role_not_found", "User does not have this role");
  }

  const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);

  if (deleteError) {
    throw new Error(`Failed to delete user role: ${deleteError.message}`);
  }
}

/**
 * Maps a database row to UserRoleDTO.
 * @param row - Database row from user_roles table
 * @returns UserRoleDTO
 */
function mapUserRoleRowToDto(row: UserRoleSelect): UserRoleDTO {
  return {
    user_id: row.user_id,
    role: row.role,
    granted_at: row.granted_at,
  };
}
