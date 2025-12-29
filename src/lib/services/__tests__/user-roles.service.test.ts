import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserRoles, createUserRole, deleteUserRole, UserRoleServiceError } from "../user-roles.service";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { CreateUserRoleCommand } from "../../../types";

/**
 * Test-compatible Supabase client that allows method overrides
 * Extends the real SupabaseClient but makes 'from' writable for mocking
 */
type TestableSupabaseClient = Omit<SupabaseClient, "from"> & {
  from: SupabaseClient["from"] | ReturnType<typeof vi.fn>;
};

describe("user-roles.service", () => {
  let mockSupabase: TestableSupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    } as TestableSupabaseClient;
  });

  describe("getUserRoles", () => {
    it("should retrieve user roles successfully", async () => {
      const mockData = [
        {
          user_id: "550e8400-e29b-41d4-a716-446655440001",
          role: "admin",
          granted_at: "2024-12-27T10:00:00.000Z",
        },
        {
          user_id: "550e8400-e29b-41d4-a716-446655440002",
          role: "admin",
          granted_at: "2024-12-26T09:30:00.000Z",
        },
      ];

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getUserRoles(mockSupabase as SupabaseClient);

      expect(mockSupabase.from).toHaveBeenCalledWith("user_roles");
      expect(mockBuilder.select).toHaveBeenCalledWith("user_id, role, granted_at");
      expect(mockBuilder.order).toHaveBeenCalledWith("granted_at", { ascending: false });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        user_id: "550e8400-e29b-41d4-a716-446655440001",
        role: "admin",
        granted_at: "2024-12-27T10:00:00.000Z",
      });
      expect(result.page.next_cursor).toBe(null);
      expect(result.page.has_more).toBe(false);
    });

    it("should handle empty results", async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getUserRoles(mockSupabase as SupabaseClient);

      expect(result.data).toHaveLength(0);
      expect(result.page.next_cursor).toBe(null);
      expect(result.page.has_more).toBe(false);
    });

    it("should handle null data gracefully", async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      const result = await getUserRoles(mockSupabase as SupabaseClient);

      expect(result.data).toHaveLength(0);
      expect(result.page.next_cursor).toBe(null);
      expect(result.page.has_more).toBe(false);
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = new Error("Database connection failed");

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(getUserRoles(mockSupabase as SupabaseClient)).rejects.toThrow("Database connection failed");
    });
  });

  describe("createUserRole", () => {
    const command: CreateUserRoleCommand = {
      user_id: "550e8400-e29b-41d4-a716-446655440004",
      role: "admin",
    };

    it("should create user role successfully when role doesn't exist", async () => {
      let checkCallCount = 0;

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() => {
          checkCallCount++;
          if (checkCallCount === 1) {
            return { data: null, error: { code: "PGRST116" } };
          }
          return { data: null, error: null };
        }),
        insert: vi.fn().mockReturnThis(),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(createUserRole(mockSupabase as SupabaseClient, command)).resolves.toBeUndefined();

      expect(mockSupabase.from).toHaveBeenCalledWith("user_roles");
      expect(mockBuilder.select).toHaveBeenCalledWith("user_id, role");
      expect(mockBuilder.eq).toHaveBeenNthCalledWith(1, "user_id", command.user_id);
      expect(mockBuilder.eq).toHaveBeenNthCalledWith(2, "role", command.role);
      expect(mockBuilder.insert).toHaveBeenCalledWith({
        user_id: command.user_id,
        role: command.role,
      });
    });

    it("should throw UserRoleServiceError when role already exists", async () => {
      const existingRole = {
        user_id: command.user_id,
        role: command.role,
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({ data: existingRole, error: null }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(createUserRole(mockSupabase as SupabaseClient, command)).rejects.toThrow(UserRoleServiceError);
      await expect(createUserRole(mockSupabase as SupabaseClient, command)).rejects.toMatchObject({
        code: "role_exists",
        message: "User already has this role",
      });
    });

    it("should throw error when check query fails with unexpected error", async () => {
      const mockError = new Error("Unexpected check error");

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(createUserRole(mockSupabase as SupabaseClient, command)).rejects.toThrow(
        "Failed to check existing role: Unexpected check error"
      );
    });

    it("should throw error when insert fails", async () => {
      const mockError = new Error("Insert failed");

      let checkCallCount = 0;

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() => {
          checkCallCount++;
          if (checkCallCount === 1) {
            return { data: null, error: { code: "PGRST116" } };
          }
          return { data: null, error: null };
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(createUserRole(mockSupabase as SupabaseClient, command)).rejects.toThrow(
        "Failed to create user role: Insert failed"
      );
    });
  });

  describe("deleteUserRole", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440003";
    const role = "admin";

    it("should delete user role successfully when role exists", async () => {
      const existingRole = {
        user_id: userId,
        role: role,
      };

      let checkCallCount = 0;

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() => {
          checkCallCount++;
          if (checkCallCount === 1) {
            return { data: existingRole, error: null };
          }
          return { data: null, error: null };
        }),
        delete: vi.fn().mockReturnThis(),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(deleteUserRole(mockSupabase as SupabaseClient, userId, role)).resolves.toBeUndefined();

      expect(mockSupabase.from).toHaveBeenCalledWith("user_roles");
      expect(mockBuilder.select).toHaveBeenCalledWith("user_id, role");
      expect(mockBuilder.eq).toHaveBeenNthCalledWith(1, "user_id", userId);
      expect(mockBuilder.eq).toHaveBeenNthCalledWith(2, "role", role);
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenNthCalledWith(3, "user_id", userId);
      expect(mockBuilder.eq).toHaveBeenNthCalledWith(4, "role", role);
    });

    it("should throw UserRoleServiceError when role doesn't exist", async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({ data: null, error: { code: "PGRST116" } }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(deleteUserRole(mockSupabase as SupabaseClient, userId, role)).rejects.toThrow(UserRoleServiceError);
      await expect(deleteUserRole(mockSupabase as SupabaseClient, userId, role)).rejects.toMatchObject({
        code: "role_not_found",
        message: "User does not have this role",
      });
    });

    it("should throw error when check query fails with unexpected error", async () => {
      const mockError = new Error("Unexpected check error");

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({ data: null, error: mockError }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(deleteUserRole(mockSupabase as SupabaseClient, userId, role)).rejects.toThrow(
        "Failed to check existing role: Unexpected check error"
      );
    });

    it("should throw error when delete fails", async () => {
      const existingRole = {
        user_id: userId,
        role: role,
      };

      const mockError = new Error("Delete failed");

      let checkCallCount = 0;

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() => {
          checkCallCount++;
          if (checkCallCount === 1) {
            return { data: existingRole, error: null };
          }
          return { data: null, error: null };
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: mockError }),
          }),
        }),
      };

      mockSupabase.from = vi.fn(() => mockBuilder);

      await expect(deleteUserRole(mockSupabase as SupabaseClient, userId, role)).rejects.toThrow(
        "Failed to delete user role: Delete failed"
      );
    });
  });
});
