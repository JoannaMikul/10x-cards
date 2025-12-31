import React from "react";
import { Alert, AlertDescription } from "./alert";

interface FieldError {
  message?: string;
  type?: string;
}

interface FormErrorProps {
  error?: FieldError | { message: string } | null;
  "data-testid"?: string;
}

export function FormError({ error, "data-testid": testId }: FormErrorProps) {
  if (!error) return null;

  return (
    <p className="text-sm text-red-600 mt-1" data-testid={testId}>
      {error.message}
    </p>
  );
}

interface FormAlertErrorProps {
  error?: { message: string } | null;
  variant?: "destructive" | "default";
  "data-testid"?: string;
}

export function FormAlertError({ error, variant = "destructive", "data-testid": testId }: FormAlertErrorProps) {
  if (!error) return null;

  return (
    <Alert variant={variant} data-testid={testId}>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}
