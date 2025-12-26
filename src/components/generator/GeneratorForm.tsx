import React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { MIN_SANITIZED_TEXT_LENGTH, MAX_SANITIZED_TEXT_LENGTH } from "../../lib/validation/generations.schema";
import type { CreateGenerationCommand } from "../../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../ui/card";
import { FieldGroup, Field } from "../ui/field";
import { TextAreaWithCounter } from "./TextAreaWithCounter";
import { ModelSelector } from "./ModelSelector";
import { TemperatureSlider } from "./TemperatureSlider";
import { SubmitButton } from "./SubmitButton";

const formSchema = z.object({
  raw_input_text: z.string().min(1, "Text is required"),
  model: z.string().min(1, "Model is required"),
  temperature: z.number().min(0).max(2),
});

type FormData = z.infer<typeof formSchema>;

interface ModelOption {
  label: string;
  value: string;
}

interface GeneratorFormProps {
  onSubmit: (data: CreateGenerationCommand) => void;
  isLoading: boolean;
  currentGenerationStatus?: string | null;
  availableModels: readonly ModelOption[];
  defaultModel: string;
}

export function GeneratorForm({
  onSubmit,
  isLoading,
  currentGenerationStatus,
  availableModels,
  defaultModel,
}: GeneratorFormProps) {
  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      raw_input_text: "",
      model: defaultModel,
      temperature: 0.7,
    },
  });

  const {
    handleSubmit,
    formState: { isValidating, errors },
    watch,
  } = methods;

  const rawInputText = watch("raw_input_text");

  const sanitizeInputText = (text: string): string => {
    const sanitized = sanitizeHtml(text, {
      allowedTags: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "span",
        "div",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "ul",
        "ol",
        "li",
        "a",
        "code",
        "pre",
        "blockquote",
        "hr",
        "mark",
        "sup",
        "sub",
      ],
      allowedAttributes: {
        a: ["href", "target", "rel", "title"],
        "*": ["class", "id", "style"],
      },
      allowedSchemes: ["http", "https", "ftp", "mailto"],
    });

    return sanitized
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const getSanitizedText = (rawText: string): { sanitized: string; isValid: boolean; error?: string } => {
    const sanitized = sanitizeInputText(rawText);

    if (sanitized.length < MIN_SANITIZED_TEXT_LENGTH) {
      return {
        sanitized,
        isValid: false,
        error: `Text must have at least ${MIN_SANITIZED_TEXT_LENGTH} characters (after cleaning)`,
      };
    }

    if (sanitized.length > MAX_SANITIZED_TEXT_LENGTH) {
      return {
        sanitized,
        isValid: false,
        error: `Text can have maximum ${MAX_SANITIZED_TEXT_LENGTH} characters (after cleaning)`,
      };
    }

    return { sanitized, isValid: true };
  };

  const handleFormSubmit = (data: FormData) => {
    const { sanitized, isValid: textValid } = getSanitizedText(data.raw_input_text);

    if (!textValid) {
      return;
    }

    const command: CreateGenerationCommand = {
      model: data.model,
      sanitized_input_text: sanitized,
      temperature: data.temperature === null ? undefined : data.temperature,
    };

    onSubmit(command);
  };

  const hasFormErrors = Object.keys(errors).length > 0;
  const isFormValid = !hasFormErrors && getSanitizedText(rawInputText).isValid;
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
                getSanitizedText={getSanitizedText}
              />
              <ModelSelector options={availableModels} />
              <TemperatureSlider min={0} max={2} step={0.1} />
            </FieldGroup>
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
