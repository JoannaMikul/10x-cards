import React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Field, FieldLabel, FieldError } from "../ui/field";

interface ModelOption {
  label: string;
  value: string;
}

interface ModelSelectorProps {
  options: readonly ModelOption[];
}

export function ModelSelector({ options }: ModelSelectorProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const error = typeof errors.model?.message === "string" ? errors.model.message : undefined;

  return (
    <Controller
      name="model"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="model-select">AI Model</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="model-select">
              <SelectValue placeholder="Select AI model" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          {error && !fieldState.invalid && <FieldError>{error}</FieldError>}
        </Field>
      )}
    />
  );
}
