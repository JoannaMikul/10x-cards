import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardFooter } from "../ui/card";
import { FieldGroup } from "../ui/field";
import { Button } from "../ui/button";
import { Loader2, CheckCircle } from "lucide-react";
import { AuthLayoutCard } from "./AuthLayoutCard";
import { PasswordInput } from "../ui/password-input";
import { FormField } from "../ui/form-field";
import { FormAlertError } from "../ui/form-error";
import { updatePasswordSchema } from "../../lib/validation/auth.schema";
import type { UpdatePasswordFormData } from "../../types";
import { useAuth } from "../hooks/useAuth";
import { useFormSubmission } from "../hooks/useFormSubmission";
import { toast } from "sonner";

export function UpdatePasswordForm() {
  const [success, setSuccess] = useState(false);
  const { updatePassword, isLoading, error, clearError } = useAuth();

  const { handleSubmit: handleFormSubmission } = useFormSubmission({
    onSuccess: () => {
      setSuccess(true);
      toast.success("Password updated successfully!", {
        description: "You will be redirected to the login page.",
      });
    },
    redirect: "/auth/login",
    successRedirectDelay: 2000,
  });

  const methods = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    mode: "onSubmit",
    defaultValues: {
      password: "",
    },
  });

  const {
    handleSubmit,
    formState: { errors },
    register,
  } = methods;

  const handleFormSubmit = async (data: UpdatePasswordFormData) => {
    clearError();

    const urlParams = new URLSearchParams(window.location.search);
    const tokenHash = urlParams.get("token_hash");
    const token = urlParams.get("token");

    await handleFormSubmission(() =>
      updatePassword({
        ...data,
        ...(tokenHash && { tokenHash }),
        ...(token && { token }),
      })
    );
  };

  return (
    <AuthLayoutCard
      title={success ? "Password updated!" : "Update password"}
      description={
        success
          ? "Your password has been successfully updated. You will be redirected to the login page."
          : "Enter your new password to complete the password reset process."
      }
    >
      <FormProvider {...methods}>
        {!success && (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" data-testid="update-password-form">
            <FieldGroup>
              <FormField
                label="New password"
                htmlFor="password"
                error={errors.password}
                hint={
                  !errors.password
                    ? "Password must be at least 8 characters with uppercase, lowercase, and digit"
                    : undefined
                }
                required
                data-testid="password-field"
              >
                <PasswordInput
                  id="password"
                  placeholder="Enter new password"
                  {...register("password")}
                  disabled={isLoading}
                  data-testid="password-input"
                  toggleTestId="toggle-password-visibility"
                />
              </FormField>
            </FieldGroup>

            <FormAlertError error={error} data-testid="update-password-error-alert" />

            <CardFooter className="px-0 pb-0 mt-6">
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="update-password-button">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </CardFooter>
          </form>
        )}

        {success && (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Redirecting to login page...</p>
          </div>
        )}
      </FormProvider>
    </AuthLayoutCard>
  );
}
