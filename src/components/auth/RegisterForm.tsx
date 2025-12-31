import React, { useEffect, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardFooter } from "../ui/card";
import { FieldGroup } from "../ui/field";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { AuthLayoutCard } from "./AuthLayoutCard";
import { PasswordInput } from "../ui/password-input";
import { FormField } from "../ui/form-field";
import { FormAlertError } from "../ui/form-error";
import { registerSchema } from "../../lib/validation/auth.schema";
import type { RegisterFormData } from "../../types";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";

interface RegisterFormProps {
  onSuccess?: (user: { id: string; email: string }) => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register: registerUser, login, isLoading, error, clearError } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  const methods = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });

  const {
    handleSubmit,
    formState: { errors },
    register,
    watch,
  } = methods;

  const password = watch("password");

  // Handle redirect when success
  useEffect(() => {
    if (shouldRedirect) {
      window.location.href = "/";
    }
  }, [shouldRedirect]);

  const handleFormSubmit = async (data: RegisterFormData) => {
    clearError();

    try {
      await registerUser(data);

      const loginResult = await login({ email: data.email, password: data.password });

      toast.success("Account created and logged in successfully!", {
        description: "Welcome to 10x-cards!",
      });

      onSuccess?.(loginResult.user);

      setTimeout(() => {
        setShouldRedirect(true);
      }, 1500);
    } catch {
      // Error is already handled by useAuth hook
    }
  };

  return (
    <AuthLayoutCard title="Sign up" description="Create a new account to start generating flashcards.">
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" data-testid="register-form">
          <FieldGroup>
            <FormField
              label="Email address"
              htmlFor="email"
              error={errors.email}
              hint="Enter a valid email address (e.g., user@example.com)"
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

            <FormField
              label="Password"
              htmlFor="password"
              error={errors.password}
              hint={
                !errors.password && password
                  ? "Password should contain at least 8 characters, uppercase and lowercase letters, and digits"
                  : "Enter a strong password"
              }
              required
              data-testid="password-field"
            >
              <PasswordInput
                id="password"
                placeholder="Enter password"
                {...register("password")}
                disabled={isLoading}
                data-testid="password-input"
                toggleTestId="toggle-password-visibility"
              />
            </FormField>

            <FormField
              label="Confirm password"
              htmlFor="passwordConfirm"
              error={errors.passwordConfirm}
              hint="Re-enter your password to confirm"
              required
              data-testid="password-confirm-field"
            >
              <PasswordInput
                id="passwordConfirm"
                placeholder="Confirm password"
                {...register("passwordConfirm")}
                disabled={isLoading}
                data-testid="password-confirm-input"
                toggleTestId="toggle-password-confirm-visibility"
              />
            </FormField>
          </FieldGroup>

          <FormAlertError error={error} data-testid="register-error-alert" />

          <CardFooter className="px-0 pb-0 mt-6">
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="sign-up-button">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign up
            </Button>
          </CardFooter>

          <div className="text-center text-sm">
            <a href="/auth/login" className="text-primary hover:underline" data-testid="login-link">
              Already have an account? Sign in
            </a>
          </div>
        </form>
      </FormProvider>
    </AuthLayoutCard>
  );
}
