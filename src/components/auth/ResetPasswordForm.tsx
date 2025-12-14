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
import { Loader2, CheckCircle } from "lucide-react";
import { AuthLayoutCard } from "./AuthLayoutCard";
import { resetPasswordSchema } from "../../lib/validation/auth.schema";

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const methods = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const {
    handleSubmit,
    formState: { errors, isValid },
    register,
    reset,
  } = methods;

  const handleFormSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "An error occurred while sending password reset instructions");
        return;
      }

      setSuccess(true);
      reset(); // Clear form after success
    } catch {
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = isValid && !isLoading;

  return (
    <AuthLayoutCard
      title="Reset password"
      description="Enter your email address and we'll send you password reset instructions."
    >
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                {...register("email")}
                disabled={isLoading || success}
              />
              {!errors.email && (
                <p className="text-xs text-gray-500 mt-0.5">Enter the email address associated with your account</p>
              )}
              {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
            </Field>
          </FieldGroup>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                If an account exists, we&apos;ve sent password reset instructions to the provided email address.
              </AlertDescription>
            </Alert>
          )}

          <CardFooter className="px-0 pb-0 mt-6">
            <Button type="submit" className="w-full" disabled={!isFormValid || success}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {success ? "Instructions sent" : "Send instructions"}
            </Button>
          </CardFooter>

          <div className="text-center text-sm">
            <a href="/auth/login" className="text-primary hover:underline">
              Back to sign in
            </a>
          </div>
        </form>
      </FormProvider>
    </AuthLayoutCard>
  );
}
