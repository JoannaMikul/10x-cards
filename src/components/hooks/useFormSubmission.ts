import { useCallback } from "react";
import type { AuthUser } from "./useAuth";

export interface UseFormSubmissionOptions {
  redirect?: string;
  onError?: (error: string) => void;
  onSuccess?: (user?: AuthUser) => void;
  successRedirectDelay?: number;
}

export interface UseFormSubmissionReturn {
  handleSubmit: (submitFn: () => Promise<{ user?: AuthUser }>) => Promise<void>;
  isSubmitting: boolean;
}

export function useFormSubmission(options: UseFormSubmissionOptions = {}): UseFormSubmissionReturn {
  const { redirect, onError, onSuccess, successRedirectDelay } = options;

  const handleSubmit = useCallback(
    async (submitFn: () => Promise<{ user?: AuthUser }>) => {
      try {
        const result = await submitFn();

        // Always call onSuccess if provided (for custom success handling)
        if (onSuccess) {
          const user = result && typeof result === "object" && "user" in result ? result.user : undefined;
          onSuccess(user);
        }

        // Handle redirect - always redirect after successful submission
        const redirectUrl = redirect || "/";
        if (successRedirectDelay && onSuccess) {
          // Delayed redirect for forms with custom success handling (like updatePassword)
          setTimeout(() => {
            window.location.assign(redirectUrl);
          }, successRedirectDelay);
        } else {
          // Immediate redirect for login/register
          window.location.assign(redirectUrl);
        }
      } catch (error) {
        // Error is already handled in the hook that calls this
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
        onError?.(errorMessage);
      }
    },
    [redirect, onError, onSuccess, successRedirectDelay]
  );

  return {
    handleSubmit,
    isSubmitting: false, // This will be managed by the auth hook
  };
}
