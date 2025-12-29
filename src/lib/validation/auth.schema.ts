import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const baseRegisterSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Z]/, "Password should contain at least one uppercase letter")
    .regex(/[a-z]/, "Password should contain at least one lowercase letter")
    .regex(/\d/, "Password should contain at least one digit"),
});

export const registerApiSchema = baseRegisterSchema;

export const registerSchema = baseRegisterSchema
  .merge(
    z.object({
      passwordConfirm: z.string().min(1, "Password confirmation is required"),
    })
  )
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords must match",
    path: ["passwordConfirm"],
  });

export const resetPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
});

export const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Z]/, "Password should contain at least one uppercase letter")
    .regex(/[a-z]/, "Password should contain at least one lowercase letter")
    .regex(/\d/, "Password should contain at least one digit"),
  tokenHash: z.string().optional(),
  token: z.string().optional(),
});
