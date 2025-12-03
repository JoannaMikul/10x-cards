import React, { useState, useEffect, useMemo } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Field, FieldLabel, FieldError, FieldDescription } from "./ui/field";
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupText } from "./ui/input-group";

interface TextAreaWithCounterProps {
  maxLength: number;
  placeholder?: string;
  getSanitizedText: (rawText: string) => { sanitized: string; isValid: boolean; error?: string };
}

export function TextAreaWithCounter({ maxLength, placeholder, getSanitizedText }: TextAreaWithCounterProps) {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext();
  const rawInputText = watch("raw_input_text");

  const [debouncedValue, setDebouncedValue] = useState(rawInputText || "");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(rawInputText || "");
    }, 300);

    return () => clearTimeout(timer);
  }, [rawInputText]);

  const sanitizedTextResult = useMemo(() => {
    return getSanitizedText(debouncedValue);
  }, [debouncedValue, getSanitizedText]);

  const getCounterText = () => {
    return `${sanitizedTextResult.sanitized.length}/${maxLength}`;
  };

  const error =
    (typeof errors.raw_input_text?.message === "string" ? errors.raw_input_text.message : undefined) ||
    getSanitizedText(rawInputText || "").error;

  return (
    <Controller
      name="raw_input_text"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="text-input">Source text</FieldLabel>
          <InputGroup>
            <InputGroupTextarea
              {...field}
              id="text-input"
              placeholder={placeholder}
              rows={6}
              className="min-h-[120px] resize-none"
              aria-invalid={fieldState.invalid}
            />
            <InputGroupAddon align="block-end" className="justify-end">
              <InputGroupText id="text-counter" className="tabular-nums text-gray-500">
                {getCounterText()}
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          {error && !rawInputText && <FieldDescription>{error}</FieldDescription>}
          {error && rawInputText && <FieldError>{error}</FieldError>}
        </Field>
      )}
    />
  );
}
