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

const registerSchema = z
  .object({
    email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
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

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  redirect?: string;
  onSuccess?: (user: { id: string; email: string }) => void;
}

export function RegisterForm({ redirect, onSuccess }: RegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <AuthLayoutCard title="Sign up" description="Create a new account to start generating flashcards.">
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="your@email.com" {...register("email")} disabled={isLoading} />
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
              Sign up
            </Button>
          </CardFooter>

          <div className="text-center text-sm">
            <a href="/auth/login" className="text-primary hover:underline">
              Already have an account? Sign in
            </a>
          </div>
        </form>
      </FormProvider>
    </AuthLayoutCard>
  );
}
