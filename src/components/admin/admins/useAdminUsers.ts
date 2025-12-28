import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import type {
  AdminUserListItemVM,
  ApiErrorResponse,
  CreateUserRoleCommand,
  AdminUsersViewState,
  UserRolesErrorCode,
  UseAdminUsersReturn,
  UserDTO,
  UserRoleDTO,
} from "@/types";

const LOGIN_PATH = "/auth/login";

const initialState: AdminUsersViewState = {
  items: [],
  loading: false,
  error: null,
  search: "",
  nextCursor: null,
  hasMore: false,
  revokeDialogState: null,
  authorizationError: undefined,
  lastStatusCode: undefined,
};

const redirectToLogin = () => {
  window.location.href = LOGIN_PATH;
};

export function useAdminUsers(): UseAdminUsersReturn {
  const [state, setState] = useState<AdminUsersViewState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user: currentUser } = useCurrentUser();

  const parseApiError = useCallback(async (response: Response): Promise<ApiErrorResponse<UserRolesErrorCode>> => {
    try {
      const errorData = await response.json();
      return {
        error: {
          code: errorData.error?.code || "unexpected_error",
          message: errorData.error?.message || "An unexpected error occurred",
          details: errorData.error?.details,
        },
      };
    } catch {
      return {
        error: {
          code: "unexpected_error",
          message: "Failed to parse error response",
        },
      };
    }
  }, []);

  const mapUserToVm = useCallback(
    (user: UserDTO, adminUserIds: Set<string>, adminRoles: UserRoleDTO[]): AdminUserListItemVM => {
      const currentUserId = currentUser?.id || "";
      const isSelf = user.id === currentUserId;
      const hasAdminRole = adminUserIds.has(user.id);
      const adminRole = adminRoles.find((role) => role.user_id === user.id);
      const totalAdmins = adminUserIds.size;
      const isRevocable = hasAdminRole && totalAdmins > 1;

      return {
        userId: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        hasAdminRole,
        grantedAt: adminRole?.granted_at,
        isSelf,
        isRevocable,
      };
    },
    [currentUser?.id]
  );

  const fetchUsers = useCallback(async (): Promise<void> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const usersResponse = await fetch("/api/admin/users", {
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const rolesResponse = await fetch("/api/admin/user-roles", {
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!usersResponse.ok) {
        if (usersResponse.status === 401 || usersResponse.status === 403) {
          const error = await parseApiError(usersResponse);
          setState((prev) => ({
            ...prev,
            loading: false,
            authorizationError: error,
            lastStatusCode: usersResponse.status,
          }));
          toast.error("Insufficient permissions", {
            description: "You don't have permission to manage users.",
          });
          return;
        }

        const error = await parseApiError(usersResponse);
        setState((prev) => ({
          ...prev,
          loading: false,
          error,
          lastStatusCode: usersResponse.status,
        }));
        toast.error("Failed to load users", {
          description: error.error.message,
        });
        return;
      }

      if (!rolesResponse.ok) {
        if (rolesResponse.status === 401 || rolesResponse.status === 403) {
          const error = await parseApiError(rolesResponse);
          setState((prev) => ({
            ...prev,
            loading: false,
            authorizationError: error,
            lastStatusCode: rolesResponse.status,
          }));
          toast.error("Insufficient permissions", {
            description: "You don't have permission to manage administrators.",
          });
          return;
        }

        const error = await parseApiError(rolesResponse);
        setState((prev) => ({
          ...prev,
          loading: false,
          error,
          lastStatusCode: rolesResponse.status,
        }));
        toast.error("Failed to load admin roles", {
          description: error.error.message,
        });
        return;
      }

      const usersData = await usersResponse.json();
      const rolesData = await rolesResponse.json();

      const adminUserIds = new Set<string>(rolesData.data.map((role: UserRoleDTO) => role.user_id));

      const items = (usersData.data as UserDTO[])
        .filter((user) => user.id !== currentUser?.id) // Don't show current user in the list
        .map((user) => mapUserToVm(user, adminUserIds, rolesData.data as UserRoleDTO[]));

      setState((prev) => ({
        ...prev,
        loading: false,
        items,
        nextCursor: usersData.page.next_cursor,
        hasMore: usersData.page.has_more,
        error: null,
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        error: {
          error: {
            code: "unexpected_error",
            message: "Network error occurred",
          },
        },
      }));
      toast.error("Network error", {
        description: "Failed to load users due to network issues.",
      });
    }
  }, [parseApiError, mapUserToVm, currentUser]);

  const loadInitial = useCallback(async (): Promise<void> => {
    await fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (currentUser && state.items.length > 0) {
      fetchUsers();
    }
  }, [currentUser, fetchUsers, state.items.length]);

  const searchUsers = useCallback((term: string): void => {
    setState((prev) => ({ ...prev, search: term.trim() }));
  }, []);

  const openRevokeDialog = useCallback(
    (userId: string): void => {
      const item = state.items.find((i) => i.userId === userId);
      if (!item) return;

      if (!item.isRevocable) {
        toast.error("Cannot revoke role", {
          description: "Cannot revoke administrator role - cannot remove the last administrator",
        });
        return;
      }

      setState((prev) => ({
        ...prev,
        revokeDialogState: {
          open: true,
          userId,
          role: "admin",
          isSubmitting: false,
          apiError: undefined,
          isSelf: item.isSelf,
        },
      }));
    },
    [state.items]
  );

  const confirmRevoke = useCallback(async (): Promise<void> => {
    if (!state.revokeDialogState) return;

    setState((prev) => ({
      ...prev,
      revokeDialogState: prev.revokeDialogState
        ? {
            ...prev.revokeDialogState,
            isSubmitting: true,
            apiError: undefined,
          }
        : null,
    }));

    try {
      const response = await fetch(`/api/admin/user-roles/${state.revokeDialogState.userId}/admin`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const error = await parseApiError(response);
          setState((prev) => ({
            ...prev,
            authorizationError: error,
            revokeDialogState: prev.revokeDialogState
              ? {
                  ...prev.revokeDialogState,
                  isSubmitting: false,
                  apiError: error,
                }
              : null,
          }));
          toast.error("Insufficient permissions", {
            description: "You don't have permission to manage administrators.",
          });
          redirectToLogin();
          return;
        }

        if (response.status === 404) {
          const error = await parseApiError(response);
          setState((prev) => ({
            ...prev,
            revokeDialogState: prev.revokeDialogState
              ? {
                  ...prev.revokeDialogState,
                  isSubmitting: false,
                  apiError: error,
                }
              : null,
          }));
          toast.error("Role not found", {
            description: "The administrator role no longer exists.",
          });
          await fetchUsers(); // Refresh to get current state
          return;
        }

        const error = await parseApiError(response);
        setState((prev) => ({
          ...prev,
          revokeDialogState: prev.revokeDialogState
            ? {
                ...prev.revokeDialogState,
                isSubmitting: false,
                apiError: error,
              }
            : null,
        }));
        toast.error("Failed to revoke role", {
          description: error.error.message,
        });
        return;
      }

      toast.success("Administrator role revoked successfully");
      setState((prev) => ({
        ...prev,
        revokeDialogState: null,
      }));
      await fetchUsers(); // Refresh data from server to ensure consistency
    } catch {
      setState((prev) => ({
        ...prev,
        revokeDialogState: prev.revokeDialogState
          ? {
              ...prev.revokeDialogState,
              isSubmitting: false,
              apiError: {
                error: {
                  code: "unexpected_error",
                  message: "Network error occurred",
                },
              },
            }
          : null,
      }));
      toast.error("Network error", {
        description: "Failed to revoke administrator role due to network issues.",
      });
    }
  }, [state.revokeDialogState, parseApiError, fetchUsers]);

  const autoGrantRole = useCallback(
    async (userId: string): Promise<void> => {
      const existingAdmin = state.items.find((item) => item.userId === userId && item.hasAdminRole);
      if (existingAdmin) {
        toast.error("Role already exists", {
          description: "User already has administrator role.",
        });
        return;
      }

      try {
        const command: CreateUserRoleCommand = {
          user_id: userId,
          role: "admin",
        };

        const response = await fetch("/api/admin/user-roles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(command),
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            await parseApiError(response);
            toast.error("Insufficient permissions", {
              description: "You don't have permission to manage administrators.",
            });
            return;
          }

          if (response.status === 409) {
            const error = await parseApiError(response);
            toast.error("Role already exists", {
              description: error.error.message,
            });
            return;
          }

          if (response.status === 400) {
            const error = await parseApiError(response);
            toast.error("Validation error", {
              description: error.error.message,
            });
            return;
          }

          const error = await parseApiError(response);
          toast.error("Failed to grant role", {
            description: error.error.message,
          });
          return;
        }

        toast.success("Administrator role granted successfully");
        await fetchUsers(); // Refresh the list
      } catch {
        toast.error("Network error", {
          description: "Failed to grant administrator role due to network issues.",
        });
      }
    },
    [state.items, parseApiError, fetchUsers]
  );

  const cancelRevoke = useCallback((): void => {
    setState((prev) => ({ ...prev, revokeDialogState: null }));
  }, []);

  return {
    state,
    loadInitial,
    searchUsers,
    autoGrantRole,
    openRevokeDialog,
    confirmRevoke,
    cancelRevoke,
  };
}
