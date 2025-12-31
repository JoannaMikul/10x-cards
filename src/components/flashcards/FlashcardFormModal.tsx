import { useEffect, useMemo, useState } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  ApiErrorResponse,
  CategoryDTO,
  FlashcardFormMode,
  FlashcardFormValues,
  SourceDTO,
  TagDTO,
} from "../../types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { FormError } from "../common/FormError";
import { cn } from "../../lib/utils";

const MAX_TAGS = 50;
const NO_CATEGORY_VALUE = "no-category";
const NO_SOURCE_VALUE = "no-source";

const formSchema = z.object({
  front: z.string().trim().min(1, "Front is required").max(200, "Front cannot exceed 200 characters"),
  back: z.string().trim().min(1, "Back is required").max(500, "Back cannot exceed 500 characters"),
  categoryId: z.number().int().positive().optional(),
  contentSourceId: z.number().int().positive().optional(),
  origin: z.enum(["manual", "ai-full", "ai-edited"]),
  tagIds: z.array(z.number().int().positive()).max(MAX_TAGS, `You can select up to ${MAX_TAGS} tags`),
  metadataJson: z.string().optional(),
});

type FlashcardFormFields = z.infer<typeof formSchema>;

interface FlashcardFormModalProps {
  open: boolean;
  mode: FlashcardFormMode;
  initialValues?: FlashcardFormValues;
  categories?: CategoryDTO[];
  sources?: SourceDTO[];
  tags?: TagDTO[];
  onClose: () => void;
  onSubmit: (values: FlashcardFormValues) => Promise<void>;
}

export function FlashcardFormModal({
  open,
  mode,
  initialValues,
  categories = [],
  sources = [],
  tags = [],
  onClose,
  onSubmit,
}: FlashcardFormModalProps) {
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues = useMemo(() => createDefaultValues(initialValues), [initialValues]);

  const form = useForm<FlashcardFormFields>({
    resolver: zodResolver(formSchema),
    mode: "all",
    defaultValues,
  });

  const { register, handleSubmit, reset, setValue, setError, watch, clearErrors, formState } = form;
  const { isValid } = formState;

  const selectedTags = watch("tagIds") ?? [];
  const categoryId = watch("categoryId");
  const contentSourceId = watch("contentSourceId");
  const originValue = watch("origin");

  useEffect(() => {
    if (open) {
      reset(createDefaultValues(initialValues));
      setServerErrors([]);
    }
  }, [initialValues, open, reset]);

  const handleTagToggle = (tagId: number) => {
    const current = form.getValues("tagIds");
    const exists = current.includes(tagId);

    if (exists) {
      setValue(
        "tagIds",
        current.filter((id) => id !== tagId)
      );
      return;
    }

    if (current.length >= MAX_TAGS) {
      setError("tagIds", { type: "manual", message: `You can select up to ${MAX_TAGS} tags` });
      return;
    }

    setValue("tagIds", [...current, tagId]);
  };

  const handleCategoryChange = (value: string) => {
    if (value === NO_CATEGORY_VALUE) {
      setValue("categoryId", undefined);
      return;
    }
    setValue("categoryId", Number(value));
  };

  const handleSourceChange = (value: string) => {
    if (value === NO_SOURCE_VALUE) {
      setValue("contentSourceId", undefined);
      return;
    }
    setValue("contentSourceId", Number(value));
  };

  const handleOriginChange = (value: string) => {
    if (!value) {
      return;
    }
    setValue("origin", value as FlashcardFormValues["origin"]);
  };

  const onSubmitForm = async (values: FlashcardFormFields) => {
    setServerErrors([]);
    clearErrors("metadataJson");
    setIsSubmitting(true);

    const metadataResult = parseMetadata(values.metadataJson);
    if (!metadataResult.success) {
      setError("metadataJson", { type: "manual", message: metadataResult.error });
      setIsSubmitting(false);
      return;
    }

    const payload: FlashcardFormValues = {
      front: values.front.trim(),
      back: values.back.trim(),
      categoryId: values.categoryId,
      contentSourceId: values.contentSourceId,
      origin: values.origin,
      tagIds: values.tagIds,
      metadata: metadataResult.metadata,
    };

    try {
      await onSubmit(payload);
      reset(createDefaultValues());
      onClose();
    } catch (error) {
      if (isApiErrorResponse(error)) {
        const errors = mapApiErrors(error, setError);
        if (errors.length) {
          setServerErrors(errors);
        }
      } else {
        setServerErrors(["Something went wrong. Please try again."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === "create" ? "Add flashcard" : "Edit flashcard";
  const description =
    mode === "create"
      ? "Create a manual flashcard by providing the front, back and metadata."
      : "Update the content or metadata of your flashcard.";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="flashcard-form-modal">
        <DialogHeader>
          <DialogTitle data-testid="flashcard-form-title">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmitForm)} data-testid="flashcard-form">
          <FormError errors={serverErrors} visible={serverErrors.length > 0} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="front">Front</FieldLabel>
              <Textarea id="front" rows={3} maxLength={200} {...register("front")} data-testid="front-textarea" />
              <FieldDescription>Maximum 200 characters</FieldDescription>
              <FieldError errors={[formState.errors.front]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="back">Back</FieldLabel>
              <Textarea id="back" rows={4} maxLength={500} {...register("back")} data-testid="back-textarea" />
              <FieldDescription>Maximum 500 characters</FieldDescription>
              <FieldError errors={[formState.errors.back]} />
            </Field>

            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select
                value={typeof categoryId === "number" ? String(categoryId) : NO_CATEGORY_VALUE}
                onValueChange={handleCategoryChange}
                data-testid="category-select"
              >
                <SelectTrigger data-testid="category-select-trigger">
                  <SelectValue placeholder="Select category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY_VALUE}>No category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[formState.errors.categoryId]} />
            </Field>

            <Field>
              <FieldLabel>Source</FieldLabel>
              <Select
                value={typeof contentSourceId === "number" ? String(contentSourceId) : NO_SOURCE_VALUE}
                onValueChange={handleSourceChange}
                data-testid="source-select"
              >
                <SelectTrigger data-testid="source-select-trigger">
                  <SelectValue placeholder="Select source (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SOURCE_VALUE}>No source</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={String(source.id)}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[formState.errors.contentSourceId]} />
            </Field>

            <Field>
              <FieldLabel>Origin</FieldLabel>
              <Select value={originValue} onValueChange={handleOriginChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ai-edited">AI edited</SelectItem>
                  <SelectItem value="ai-full">AI full</SelectItem>
                </SelectContent>
              </Select>
              <FieldError errors={[formState.errors.origin]} />
            </Field>

            <Field>
              <FieldLabel>Tags</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags available</p>}
                {tags.map((tag) => {
                  const checked = selectedTags.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className={cn(
                        "flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                        checked
                          ? "border-primary bg-primary/10 text-primary shadow-sm dark:bg-primary/20 dark:text-primary-foreground"
                          : "border-border text-foreground hover:border-foreground/60 dark:text-foreground"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleTagToggle(tag.id)}
                        aria-label={`Toggle tag ${tag.name}`}
                      />
                      <span>{tag.name}</span>
                    </label>
                  );
                })}
              </div>
              <FieldDescription>
                {selectedTags.length}/{MAX_TAGS} tags selected
              </FieldDescription>
              <FieldError errors={[formState.errors.tagIds]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="metadata">Metadata (JSON)</FieldLabel>
              <Textarea id="metadata" rows={3} placeholder='e.g. { "language": "EN" }' {...register("metadataJson")} />
              <FieldDescription>Optional JSON object with custom metadata.</FieldDescription>
              <FieldError errors={[formState.errors.metadataJson]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="cancel-button">
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting} data-testid="submit-button">
              {isSubmitting ? "Saving..." : mode === "create" ? "Create" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function createDefaultValues(initialValues?: FlashcardFormValues): FlashcardFormFields {
  return {
    front: initialValues?.front ?? "",
    back: initialValues?.back ?? "",
    categoryId: initialValues?.categoryId,
    contentSourceId: initialValues?.contentSourceId,
    origin: initialValues?.origin ?? "manual",
    tagIds: initialValues?.tagIds ?? [],
    metadataJson: initialValues?.metadata ? JSON.stringify(initialValues.metadata, null, 2) : "",
  };
}

function parseMetadata(metadataJson?: string) {
  if (!metadataJson || metadataJson.trim().length === 0) {
    return { success: true, metadata: undefined as FlashcardFormValues["metadata"] };
  }

  try {
    const parsed = JSON.parse(metadataJson);
    if (parsed === null || typeof parsed !== "object") {
      return { success: false, error: "Metadata must be a valid JSON object." };
    }
    return { success: true, metadata: parsed };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid metadata JSON.",
    };
  }
}

function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
  return Boolean(error && typeof error === "object" && "error" in error);
}

function mapApiErrors(error: ApiErrorResponse, setError: UseFormSetError<FlashcardFormFields>): string[] {
  const messages: string[] = [];
  const code = error.error.code;

  switch (code) {
    case "duplicate_flashcard":
      setError("front", { type: "server", message: "A flashcard with the same front already exists." });
      setError("back", { type: "server", message: "A flashcard with the same back already exists." });
      break;
    case "category_not_found":
      setError("categoryId", { type: "server", message: "Selected category no longer exists." });
      break;
    case "source_not_found":
      setError("contentSourceId", { type: "server", message: "Selected source no longer exists." });
      break;
    case "tag_not_found":
      setError("tagIds", { type: "server", message: "One of the selected tags no longer exists." });
      break;
    case "invalid_body":
    case "unprocessable_entity":
      messages.push("Submitted data is invalid. Please review highlighted fields.");
      break;
    default:
      messages.push(error.error.message);
  }

  return messages;
}
