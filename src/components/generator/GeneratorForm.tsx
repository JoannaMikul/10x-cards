import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  generatorFormSchema,
  DEFAULT_GENERATOR_FORM_DATA,
  type GeneratorFormData,
} from "../../lib/validation/generator-form.schema";
import { MAX_SANITIZED_TEXT_LENGTH } from "../../lib/validation/generations.schema";
import { useTextValidation } from "../hooks/useTextValidation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../ui/card";
import { FieldGroup, Field } from "../ui/field";
import { FormAlertError } from "../ui/form-error";
import { TextAreaWithCounter } from "./TextAreaWithCounter";
import { ModelSelector } from "./ModelSelector";
import { TemperatureSlider } from "./TemperatureSlider";
import { SubmitButton } from "./SubmitButton";

interface ModelOption {
  label: string;
  value: string;
}

interface GeneratorFormProps {
  onSubmit: (data: { model: string; sanitized_input_text: string; temperature?: number }) => Promise<void>;
  currentGenerationStatus?: string | null;
  availableModels: readonly ModelOption[];
  defaultModel: string;
}

export function GeneratorForm({
  onSubmit,
  currentGenerationStatus,
  availableModels,
  defaultModel,
}: GeneratorFormProps) {
  const { sanitizeAndValidate, isValidLength } = useTextValidation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);

  const methods = useForm<GeneratorFormData>({
    resolver: zodResolver(generatorFormSchema),
    defaultValues: {
      ...DEFAULT_GENERATOR_FORM_DATA,
      model: defaultModel,
    },
  });

  const {
    handleSubmit,
    formState: { isValidating, errors },
    watch,
  } = methods;

  const rawInputText = watch("raw_input_text");

  const handleFormSubmit = async (data: GeneratorFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const { sanitized, isValid: textValid } = sanitizeAndValidate(data.raw_input_text);

      if (!textValid) {
        return;
      }

      await onSubmit({
        model: data.model,
        sanitized_input_text: sanitized,
        temperature: data.temperature,
      });
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasFormErrors = Object.keys(errors).length > 0;
  const isFormValid = !hasFormErrors && isValidLength(rawInputText);
  const isDisabled =
    isLoading ||
    currentGenerationStatus === "pending" ||
    currentGenerationStatus === "running" ||
    isValidating ||
    !isFormValid;

  return (
    <FormProvider {...methods}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Generate flashcards with AI</CardTitle>
          <CardDescription>
            Paste your source text, choose an AI model and start generating intelligent flashcards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <FieldGroup>
              <TextAreaWithCounter
                maxLength={MAX_SANITIZED_TEXT_LENGTH}
                placeholder="Paste your source text here (article, book, notes)..."
                getSanitizedText={sanitizeAndValidate}
              />
              <ModelSelector options={availableModels} />
              <TemperatureSlider min={0} max={2} step={0.1} />
            </FieldGroup>

            <FormAlertError error={error} data-testid="generation-error-alert" />
          </form>
        </CardContent>
        <CardFooter>
          <Field>
            <SubmitButton
              onClick={handleSubmit(handleFormSubmit)}
              disabled={isDisabled}
              isLoading={isLoading}
              hasActiveGeneration={currentGenerationStatus === "pending" || currentGenerationStatus === "running"}
              label="Start generation"
            />
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  );
}
