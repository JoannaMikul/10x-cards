import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field, FieldLabel, FieldError } from "../ui/field";
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupText } from "../ui/input-group";
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
  errors: string[];
}

export interface CandidateEditorRef {
  submit: () => void;
}

const CandidateEditorComponent = forwardRef<CandidateEditorRef, CandidateEditorProps>(
  ({ candidate, onSave, errors }, ref) => {
    const [frontCount, setFrontCount] = useState(candidate.front.length);
    const [backCount, setBackCount] = useState(candidate.back.length);

    const { control, handleSubmit, watch } = useForm<EditFormData>({
      resolver: zodResolver(editSchema),
      defaultValues: {
        front: candidate.front,
        back: candidate.back,
      },
      mode: "onBlur",
    });

    const watchedFront = watch("front");
    const watchedBack = watch("back");

    useEffect(() => {
      setFrontCount(watchedFront?.length || 0);
    }, [watchedFront]);

    useEffect(() => {
      setBackCount(watchedBack?.length || 0);
    }, [watchedBack]);

    const onSubmit = (data: EditFormData) => {
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Question Field */}
        <Controller
          name="front"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`front-${candidate.id}`}>Question</FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  {...field}
                  id={`front-${candidate.id}`}
                  placeholder="Enter question..."
                  className="min-h-[40px] resize-none"
                  aria-invalid={fieldState.invalid}
                />
                <InputGroupAddon align="block-end" className="justify-end">
                  <InputGroupText
                    id={`front-counter-${candidate.id}`}
                    className={`tabular-nums text-xs ${frontCount > 200 ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    {frontCount}/200
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />

        {/* Answer Field */}
        <Controller
          name="back"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`back-${candidate.id}`}>Answer</FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  {...field}
                  id={`back-${candidate.id}`}
                  placeholder="Enter answer..."
                  className="min-h-[120px] resize-none"
                  aria-invalid={fieldState.invalid}
                />
                <InputGroupAddon align="block-end" className="justify-end">
                  <InputGroupText
                    id={`back-counter-${candidate.id}`}
                    className={`tabular-nums text-xs ${backCount > 500 ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    {backCount}/500
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />

        {/* Form-level errors */}
        {errors.length > 0 && (
          <div className="text-sm text-red-600 space-y-1">
            {errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        )}
      </form>
    );
  }
);

CandidateEditorComponent.displayName = "CandidateEditor";

export const CandidateEditor = CandidateEditorComponent;
