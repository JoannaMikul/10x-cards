import { z } from "zod";

export const USER_ROLE_VALUES = ["admin"] as const;
export type UserRole = (typeof USER_ROLE_VALUES)[number];

const createUserRoleUserIdSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().uuid("User ID must be a valid UUID.")
);

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

const userRolePathParamsUserIdSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().uuid("User ID must be a valid UUID.")
);

const userRolePathParamsRoleSchema = z.enum(USER_ROLE_VALUES, {
  errorMap: () => ({
    message: `Role must be one of: ${USER_ROLE_VALUES.join(", ")}.`,
  }),
});

export const userRolePathParamsSchema = z.object({
  userId: userRolePathParamsUserIdSchema,
  role: userRolePathParamsRoleSchema,
});

export type UserRolePathParamsSchema = z.infer<typeof userRolePathParamsSchema>;
