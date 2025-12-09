import React from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface FormErrorProps {
  errors: string[];
  visible?: boolean;
  title?: string;
}

export function FormError({ errors, visible = true, title = "Validation Error" }: FormErrorProps) {
  if (!visible || errors.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc list-inside space-y-1">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
