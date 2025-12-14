import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardFooter } from "../ui/card";
import { FieldGroup, Field } from "../ui/field";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthLayoutCard } from "./AuthLayoutCard";
import { registerSchema } from "../../lib/validation/auth.schema";
import type { RegisterFormData } from "../../types";

interface RegisterFormProps {
  onSuccess?: (user: { id: string; email: string }) => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistrationSuccessful, setIsRegistrationSuccessful] = useState(false);

  const methods = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
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

  const handleFormSubmit = async (data: RegisterFormData) => {
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
        const errorData = await response.json();
        if (response.status === 409) {
          setError("Email address is already registered");
        } else if (response.status === 400) {
          setError(errorData.error || "An error occurred during registration");
        } else {
          setError("An error occurred during registration");
        }
        return;
      }

      const result = await response.json();

      setIsRegistrationSuccessful(true);

      onSuccess?.(result.user);
    } catch {
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = isValid && !isLoading;

  return (
    <AuthLayoutCard
      title={isRegistrationSuccessful ? "Registration successful!" : "Sign up"}
      description={
        isRegistrationSuccessful
          ? "Your account has been created successfully. You can now sign in."
          : "Create a new account to start generating flashcards."
      }
    >
      <FormProvider {...methods}>
        {!isRegistrationSuccessful && (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <FieldGroup>
              <Field>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  {...register("email")}
                  disabled={isLoading}
                />
                {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
              </Field>

              <Field>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
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
                <Label htmlFor="passwordConfirm">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="passwordConfirm"
                    type={showPasswordConfirm ? "text" : "password"}
                    placeholder="Confirm password"
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
                {errors.passwordConfirm && (
                  <p className="text-sm text-red-600 mt-1">{errors.passwordConfirm.message}</p>
                )}
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
                Sign up
              </Button>
            </CardFooter>

            <div className="text-center text-sm">
              <a href="/auth/login" className="text-primary hover:underline">
                Already have an account? Sign in
              </a>
            </div>
          </form>
        )}

        {isRegistrationSuccessful && (
          <div className="text-center">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => (window.location.href = "/auth/login")}
              disabled={isLoading}
            >
              Sign in
            </Button>
          </div>
        )}
      </FormProvider>
    </AuthLayoutCard>
  );
}
