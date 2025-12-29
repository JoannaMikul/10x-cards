import { describe, it, expect } from "vitest";
import { createUserRoleSchema, userRolePathParamsSchema, USER_ROLE_VALUES } from "../user-roles.schema";

describe("createUserRoleSchema", () => {
  describe("user_id validation", () => {
    it("accepts valid UUID", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
      });
      expect(result.success).toBe(true);
      expect(result.data?.user_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("trims user_id", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: "  550e8400-e29b-41d4-a716-446655440000  ",
        role: "admin",
      });
      expect(result.success).toBe(true);
      expect(result.data?.user_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("rejects invalid UUID format", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: "invalid-uuid",
        role: "admin",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("User ID must be a valid UUID.");
    });

    it("rejects empty user_id", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: "",
        role: "admin",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("User ID must be a valid UUID.");
    });

    it("rejects non-string user_id", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: 123,
        role: "admin",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Expected string, received number");
    });
  });

  describe("role validation", () => {
    it("accepts valid role", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
      });
      expect(result.success).toBe(true);
      expect(result.data?.role).toBe("admin");
    });

    it("rejects invalid role", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        role: "invalid_role",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Role must be one of: ${USER_ROLE_VALUES.join(", ")}.`);
    });

    it("rejects non-string role", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        role: 123,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Role must be one of: ${USER_ROLE_VALUES.join(", ")}.`);
    });
  });

  describe("complete schema validation", () => {
    it("accepts complete valid payload", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
      });
    });

    it("rejects payload with missing user_id", () => {
      const result = createUserRoleSchema.safeParse({
        role: "admin",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["user_id"]);
    });

    it("rejects payload with missing role", () => {
      const result = createUserRoleSchema.safeParse({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["role"]);
    });

    it("rejects empty payload", () => {
      const result = createUserRoleSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(2);
    });
  });
});

describe("userRolePathParamsSchema", () => {
  describe("userId validation", () => {
    it("accepts valid UUID", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
      });
      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("trims userId", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: "  550e8400-e29b-41d4-a716-446655440000  ",
        role: "admin",
      });
      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("rejects invalid UUID format", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: "invalid-uuid",
        role: "admin",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("User ID must be a valid UUID.");
    });

    it("rejects empty userId", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: "",
        role: "admin",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("User ID must be a valid UUID.");
    });

    it("rejects non-string userId", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: 123,
        role: "admin",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Expected string, received number");
    });
  });

  describe("role validation", () => {
    it("accepts valid role", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
      });
      expect(result.success).toBe(true);
      expect(result.data?.role).toBe("admin");
    });

    it("rejects invalid role", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        role: "invalid_role",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Role must be one of: ${USER_ROLE_VALUES.join(", ")}.`);
    });

    it("rejects non-string role", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        role: 123,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Role must be one of: ${USER_ROLE_VALUES.join(", ")}.`);
    });
  });

  describe("complete schema validation", () => {
    it("accepts complete valid payload", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
      });
    });

    it("rejects payload with missing userId", () => {
      const result = userRolePathParamsSchema.safeParse({
        role: "admin",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["userId"]);
    });

    it("rejects payload with missing role", () => {
      const result = userRolePathParamsSchema.safeParse({
        userId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["role"]);
    });

    it("rejects empty payload", () => {
      const result = userRolePathParamsSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(2);
    });
  });
});
