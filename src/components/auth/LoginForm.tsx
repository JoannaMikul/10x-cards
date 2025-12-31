import React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "../../lib/validation/auth.schema";
import type { LoginFormData } from "../../types";
import { CardFooter } from "../ui/card";
import { FieldGroup } from "../ui/field";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { FormField } from "../ui/form-field";
import { FormAlertError } from "../ui/form-error";
import { Loader2 } from "lucide-react";
import { AuthLayoutCard } from "./AuthLayoutCard";
import { PasswordInput } from "../ui/password-input";
import { useAuth } from "../hooks/useAuth";
import { useFormSubmission } from "../hooks/useFormSubmission";

interface LoginFormProps {
  redirect?: string;
}

export function LoginForm({ redirect }: LoginFormProps) {
  const { login, isLoading, error, clearError } = useAuth();
  const { handleSubmit: handleFormSubmission } = useFormSubmission({ redirect });

  const methods = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const {
    handleSubmit,
    formState: { errors },
    register,
  } = methods;

  const handleFormSubmit = async (data: LoginFormData) => {
    clearError();
    await handleFormSubmission(() => login(data));
  };

  return (
    <AuthLayoutCard title="Sign in" description="Enter your credentials to access the application.">
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" data-testid="login-form">
          <FieldGroup>
            <FormField
              label="Email address"
              htmlFor="email"
              error={errors.email}
              hint="Enter a valid email address (e.g., user@example.com)"
              required
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
              hint="Enter your account password"
              required
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
          </FieldGroup>

          <FormAlertError error={error} data-testid="login-error-alert" />

          <CardFooter className="px-0 pb-0 mt-6">
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="sign-in-button">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </CardFooter>

          <div className="text-center text-sm">
            <a href="/auth/register" className="text-primary hover:underline" data-testid="register-link">
              Don&apos;t have an account? Sign up
            </a>
          </div>

          <div className="text-center text-sm">
            <a href="/auth/reset-password" className="text-primary hover:underline" data-testid="reset-password-link">
              Forgot your password?
            </a>
          </div>
        </form>
      </FormProvider>
    </AuthLayoutCard>
  );
}
