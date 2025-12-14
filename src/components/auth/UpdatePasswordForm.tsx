import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CardFooter } from "../ui/card";
import { FieldGroup, Field } from "../ui/field";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { AuthLayoutCard } from "./AuthLayoutCard";
import { updatePasswordSchema } from "../../lib/validation/auth.schema";

type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;

export function UpdatePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const methods = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
    },
  });

  const {
    handleSubmit,
    formState: { errors, isValid },
    register,
  } = methods;

  const handleFormSubmit = async (data: UpdatePasswordFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const urlParams = new URLSearchParams(window.location.search);
    const tokenHash = urlParams.get("token_hash");
    const token = urlParams.get("token");

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          ...(tokenHash && { tokenHash }),
          ...(token && { token }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 400) {
          setError(errorData.error?.message || "An error occurred while updating password");
        } else {
          setError("An error occurred while updating password");
        }
        return;
      }

      setSuccess(true);

      // Redirect to login after successful password update
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
    } catch {
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = isValid && !isLoading;

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
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <FieldGroup>
              <Field>
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    {...register("password")}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {!errors.password && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Password must be at least 8 characters with uppercase, lowercase, and digit
                  </p>
                )}
                {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
              </Field>
            </FieldGroup>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <CardFooter className="px-0 pb-0 mt-6">
              <Button type="submit" className="w-full" disabled={!isFormValid}>
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
