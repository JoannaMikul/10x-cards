import React, { forwardRef, useImperativeHandle } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupText } from "../ui/input-group";
import { FormField } from "../ui/form-field";
import { FormAlertError } from "../ui/form-error";
import type { GenerationCandidateDTO } from "../../types";

const editSchema = z.object({
  front: z.string().min(1, "Question is required").max(200, "Question cannot exceed 200 characters"),
  back: z.string().min(1, "Answer is required").max(500, "Answer cannot exceed 500 characters"),
});

type EditFormData = z.infer<typeof editSchema>;

interface CandidateEditorProps {
  candidate: GenerationCandidateDTO;
  onSave: (changes: { front: string; back: string }) => void;
  onCancel: () => void;
  errors: readonly string[];
}

export interface CandidateEditorRef {
  submit: () => void;
}

interface CharacterCountResult {
  count: number;
  isOverLimit: boolean;
  counterText: string;
  counterClassName: string;
}

function useCharacterCount(value: string | undefined, maxLength: number): CharacterCountResult {
  const count = value?.length || 0;
  const isOverLimit = count > maxLength;

  return {
    count,
    isOverLimit,
    counterText: `${count}/${maxLength}`,
    counterClassName: `tabular-nums text-xs ${isOverLimit ? "text-red-500" : "text-muted-foreground"}`,
  };
}

const CandidateEditorComponent = forwardRef<CandidateEditorRef, CandidateEditorProps>(
  ({ candidate, onSave, errors }, ref) => {
    const methods = useForm<EditFormData>({
      resolver: zodResolver(editSchema),
      defaultValues: {
        front: candidate.front,
        back: candidate.back,
      },
      mode: "all",
    });

    const { control, handleSubmit, watch } = methods;
    const { front: watchedFront, back: watchedBack } = watch();

    const frontCounter = useCharacterCount(watchedFront, 200);
    const backCounter = useCharacterCount(watchedBack, 500);

    const onSubmit = (data: EditFormData): void => {
      onSave({
        front: data.front.trim(),
        back: data.back.trim(),
      });
    };

    useImperativeHandle(ref, () => ({
      submit: () => {
        handleSubmit(onSubmit)();
      },
    }));

    return (
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="candidate-editor-form">
          <Controller
            name="front"
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                label="Question"
                htmlFor={`front-${candidate.id}`}
                error={fieldState.error}
                hint={`Enter your question (${frontCounter.counterText})`}
                required
                data-testid="question-field"
              >
                <InputGroup>
                  <InputGroupTextarea
                    {...field}
                    id={`front-${candidate.id}`}
                    placeholder="Enter question..."
                    className="min-h-[40px] resize-none"
                    aria-invalid={fieldState.invalid}
                    data-testid="question-input"
                  />
                  <InputGroupAddon align="block-end" className="justify-end">
                    <InputGroupText
                      id={`front-counter-${candidate.id}`}
                      className={frontCounter.counterClassName}
                      data-testid="question-counter"
                    >
                      {frontCounter.counterText}
                    </InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </FormField>
            )}
          />
          <Controller
            name="back"
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                label="Answer"
                htmlFor={`back-${candidate.id}`}
                error={fieldState.error}
                hint={`Enter your answer (${backCounter.counterText})`}
                required
                data-testid="answer-field"
              >
                <InputGroup>
                  <InputGroupTextarea
                    {...field}
                    id={`back-${candidate.id}`}
                    placeholder="Enter answer..."
                    className="min-h-[120px] resize-none"
                    aria-invalid={fieldState.invalid}
                    data-testid="answer-input"
                  />
                  <InputGroupAddon align="block-end" className="justify-end">
                    <InputGroupText
                      id={`back-counter-${candidate.id}`}
                      className={backCounter.counterClassName}
                      data-testid="answer-counter"
                    >
                      {backCounter.counterText}
                    </InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </FormField>
            )}
          />
          {errors.length > 0 && (
            <FormAlertError error={{ message: errors.join(", ") }} data-testid="candidate-editor-error-alert" />
          )}
        </form>
      </FormProvider>
    );
  }
);

export const CandidateEditor = CandidateEditorComponent;
