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
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthLayoutCard } from "./AuthLayoutCard";

const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password should contain at least one uppercase letter")
      .regex(/[a-z]/, "Password should contain at least one lowercase letter")
      .regex(/\d/, "Password should contain at least one digit"),
    passwordConfirm: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords must match",
    path: ["passwordConfirm"],
  });

type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;

export function UpdatePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
      passwordConfirm: "",
    },
  });

  const {
    handleSubmit,
    formState: { errors, isValid },
    register,
    watch,
  } = methods;

  const password = watch("password");

  const handleFormSubmit = async (data: UpdatePasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: data.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) {
          setError("Password reset session has expired. Please request a reset again.");
        } else if (response.status === 400) {
          setError(errorData.error || "Password does not meet security requirements");
        } else {
          setError("An error occurred while changing the password");
        }
        return;
      }

      // Redirect to login after success
      window.location.href = "/?message=password-updated";
    } catch {
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = isValid && !isLoading;

  return (
    <AuthLayoutCard title="Set new password" description="Enter a new password for your account.">
      <FormProvider {...methods}>
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
              {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
              {!errors.password && password && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Password should contain at least 8 characters, uppercase and lowercase letters, and digits
                </p>
              )}
            </Field>

            <Field>
              <Label htmlFor="passwordConfirm">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="passwordConfirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  placeholder="Confirm new password"
                  {...register("passwordConfirm")}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  disabled={isLoading}
                >
                  {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {!errors.passwordConfirm && (
                <p className="text-xs text-gray-500 mt-0.5">Re-enter your new password to confirm</p>
              )}
              {errors.passwordConfirm && <p className="text-sm text-red-600 mt-1">{errors.passwordConfirm.message}</p>}
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
              Change password
            </Button>
          </CardFooter>
        </form>
      </FormProvider>
    </AuthLayoutCard>
  );
}
