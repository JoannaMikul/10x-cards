import React from "react";
import { Field } from "./field";
import { Label } from "./label";
import { FormError } from "./form-error";

interface FieldError {
  message?: string;
  type?: string;
}

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: FieldError;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  "data-testid"?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  "data-testid": testId,
}: FormFieldProps) {
  return (
    <Field data-testid={testId}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {!error && hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      <FormError error={error} />
    </Field>
  );
}
