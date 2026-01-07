import { useState } from "react";
import type { LoginFormData, RegisterFormData } from "../../types";

export interface AuthError {
  message: string;
  status?: number;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface UpdatePasswordFormData {
  password: string;
  tokenHash?: string;
  token?: string;
}

export interface ResetPasswordFormData {
  email: string;
}

export interface UseAuthReturn {
  login: (data: LoginFormData) => Promise<{ user: AuthUser }>;
  register: (data: RegisterFormData) => Promise<{ user: AuthUser }>;
  updatePassword: (data: UpdatePasswordFormData) => Promise<{ user?: AuthUser }>;
  resetPassword: (data: ResetPasswordFormData) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: AuthError | null;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const clearError = () => setError(null);

  const login = async (data: LoginFormData): Promise<{ user: AuthUser }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Invalid email or password");
        } else {
          const errorMessage =
            typeof errorData.error === "string"
              ? errorData.error
              : errorData.error?.message || "An error occurred during login";
          throw new Error(errorMessage);
        }
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const authError: AuthError = {
        message: err instanceof Error ? err.message : "An unexpected error occurred. Please try again later.",
        status: err instanceof Error && "status" in err ? (err as { status?: number }).status : undefined,
      };
      setError(authError);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterFormData): Promise<{ user: AuthUser }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error("Email address is already registered");
        } else if (response.status === 400) {
          const errorMessage =
            typeof errorData.error === "string"
              ? errorData.error
              : errorData.error?.message || "An error occurred during registration";
          throw new Error(errorMessage);
        } else {
          throw new Error("An error occurred during registration");
        }
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const authError: AuthError = {
        message: err instanceof Error ? err.message : "An unexpected error occurred. Please try again later.",
        status: err instanceof Error && "status" in err ? (err as { status?: number }).status : undefined,
      };
      setError(authError);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (data: UpdatePasswordFormData): Promise<{ user?: AuthUser }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400) {
          throw new Error(errorData.error?.message || "An error occurred while updating password");
        } else {
          throw new Error("An error occurred while updating password");
        }
      }

      return {}; // Password update successful, no user data to return
    } catch (err) {
      const authError: AuthError = {
        message: err instanceof Error ? err.message : "An unexpected error occurred. Please try again later.",
        status: err instanceof Error && "status" in err ? (err as { status?: number }).status : undefined,
      };
      setError(authError);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (data: ResetPasswordFormData): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          typeof errorData.error === "string"
            ? errorData.error
            : errorData.error?.message || "An error occurred while sending password reset instructions";
        throw new Error(errorMessage);
      }
    } catch (err) {
      const authError: AuthError = {
        message: err instanceof Error ? err.message : "An unexpected error occurred. Please try again later.",
        status: err instanceof Error && "status" in err ? (err as { status?: number }).status : undefined,
      };
      setError(authError);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to logout");
      }
    } catch (err) {
      const authError: AuthError = {
        message: err instanceof Error ? err.message : "Failed to logout",
      };
      setError(authError);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    login,
    register,
    updatePassword,
    resetPassword,
    logout,
    isLoading,
    error,
    clearError,
  };
}
