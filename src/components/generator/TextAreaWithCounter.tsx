import React, { useState, useEffect, useMemo } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Field, FieldLabel, FieldError, FieldDescription } from "../ui/field";
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupText } from "../ui/input-group";

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

  const formError = typeof errors.raw_input_text?.message === "string" ? errors.raw_input_text.message : undefined;
  const sanitizationError = getSanitizedText(rawInputText || "").error;
  const error = formError || sanitizationError;

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
              className="max-h-[220px] resize-none overflow-y-auto"
              aria-invalid={fieldState.invalid}
            />
            <InputGroupAddon align="block-end" className="justify-end">
              <InputGroupText id="text-counter" className="tabular-nums text-gray-500">
                {getCounterText()}
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <div className="min-h-[20px]">
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            {!fieldState.invalid && error && !rawInputText && <FieldDescription>{error}</FieldDescription>}
            {!fieldState.invalid && error && rawInputText && <FieldError>{error}</FieldError>}
          </div>
        </Field>
      )}
    />
  );
}
