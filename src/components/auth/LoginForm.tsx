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

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  redirect?: string;
  onSuccess?: (user: { id: string; email: string }) => void;
}

export function LoginForm({ redirect, onSuccess }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const {
    handleSubmit,
    formState: { errors, isValid },
    register,
  } = methods;

  const handleFormSubmit = async (data: LoginFormData) => {
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
        const errorData = await response.json();
        if (response.status === 401) {
          setError("Invalid email or password");
        } else {
          setError(errorData.error || "An error occurred during login");
        }
        return;
      }

      const result = await response.json();

      // Redirect after success
      const redirectUrl = redirect || "/generator";
      window.location.href = redirectUrl;

      onSuccess?.(result.user);
    } catch {
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = isValid && !isLoading;

  return (
    <AuthLayoutCard title="Sign in" description="Enter your credentials to access the application.">
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="your@email.com" {...register("email")} disabled={isLoading} />
              {!errors.email && (
                <p className="text-xs text-gray-500 mt-0.5">Enter a valid email address (e.g., user@example.com)</p>
              )}
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
              {!errors.password && <p className="text-xs text-gray-500 mt-0.5">Enter your account password</p>}
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
              Sign in
            </Button>
          </CardFooter>

          <div className="text-center text-sm">
            <a href="/auth/register" className="text-primary hover:underline">
              Don&apos;t have an account? Sign up
            </a>
          </div>

          <div className="text-center text-sm">
            <a href="/auth/reset-password" className="text-primary hover:underline">
              Forgot your password?
            </a>
          </div>
        </form>
      </FormProvider>
    </AuthLayoutCard>
  );
}
