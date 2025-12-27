import { z } from "zod";

// User roles available in the system
export const USER_ROLE_VALUES = ["admin"] as const;
export type UserRole = (typeof USER_ROLE_VALUES)[number];

// Schema for creating a new user role assignment (POST /api/admin/user-roles)
const createUserRoleUserIdSchema = z
  .string()
  .uuid("User ID must be a valid UUID.")
  .transform((value) => value.trim());

const createUserRoleRoleSchema = z.enum(USER_ROLE_VALUES, {
  errorMap: () => ({
    message: `Role must be one of: ${USER_ROLE_VALUES.join(", ")}.`,
  }),
});

export const createUserRoleSchema = z.object({
  user_id: createUserRoleUserIdSchema,
  role: createUserRoleRoleSchema,
});

export type CreateUserRoleSchema = z.infer<typeof createUserRoleSchema>;
