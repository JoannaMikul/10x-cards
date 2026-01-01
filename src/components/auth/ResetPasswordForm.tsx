import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardFooter } from "../ui/card";
import { FieldGroup } from "../ui/field";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Loader2, CheckCircle } from "lucide-react";
import { AuthLayoutCard } from "./AuthLayoutCard";
import { FormField } from "../ui/form-field";
import { FormAlertError } from "../ui/form-error";
import { resetPasswordSchema } from "../../lib/validation/auth.schema";
import type { ResetPasswordFormData } from "../../types";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";

export function ResetPasswordForm() {
  const { resetPassword, isLoading, error, clearError } = useAuth();
  const [success, setSuccess] = useState(false);

  // Clear success state when component mounts (user navigated to this page)
  React.useEffect(() => {
    setSuccess(false);
  }, []);

  const methods = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
    },
  });

  const {
    handleSubmit,
    formState: { errors },
    register,
    reset,
    watch,
  } = methods;

  // Clear success state when user starts typing a new email
  const watchedEmail = watch("email");
  React.useEffect(() => {
    if (watchedEmail && success) {
      setSuccess(false);
    }
  }, [watchedEmail, success]);

  const handleFormSubmit = async (data: ResetPasswordFormData) => {
    clearError();
    setSuccess(false);

    try {
      await resetPassword(data);
      setSuccess(true);
      reset(); // Clear form after success

      toast.success("Password reset instructions sent!", {
        description: "Check your email for instructions to reset your password.",
      });
    } catch {
      // Error is already handled by useAuth hook
    }
  };

  return (
    <AuthLayoutCard
      title="Reset password"
      description="Enter your email address and we'll send you password reset instructions."
    >
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" data-testid="reset-password-form">
          <FieldGroup>
            <FormField
              label="Email address"
              htmlFor="email"
              error={errors.email}
              hint="Enter the email address associated with your account"
              required
              data-testid="email-field"
            >
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                {...register("email")}
                disabled={isLoading}
                data-testid="email-input"
              />
            </FormField>
          </FieldGroup>

          <FormAlertError error={error} data-testid="reset-password-error-alert" />

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-green-800">Password reset instructions sent!</p>
                  <p className="text-sm text-green-700 mt-1">
                    If an account exists, we&apos;ve sent password reset instructions to the provided email address.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="text-sm text-green-600 hover:text-green-800 underline mt-2"
                    data-testid="try-again-button"
                  >
                    Didn&apos;t receive the email? Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          <CardFooter className="px-0 pb-0 mt-6">
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="send-instructions-button">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {success ? "Instructions sent" : "Send instructions"}
            </Button>
          </CardFooter>

          <div className="text-center text-sm">
            <a href="/auth/login" className="text-primary hover:underline" data-testid="back-to-login-link">
              Back to sign in
            </a>
          </div>
        </form>
      </FormProvider>
    </AuthLayoutCard>
  );
}
