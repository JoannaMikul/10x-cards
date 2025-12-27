import type { Tables } from "../../db/database.types.ts";
import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { UserRoleDTO, UserRoleListResponse } from "../../types";

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
