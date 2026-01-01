import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useMemo } from "react";
import { z } from "zod";
import type { ApiErrorResponse, FlashcardFormMode, FlashcardFormValues } from "../../types";

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

export type FlashcardFormData = z.infer<typeof formSchema>;

interface UseFlashcardFormOptions {
  mode: FlashcardFormMode;
  initialValues?: FlashcardFormValues;
  onSubmit: (values: FlashcardFormValues) => Promise<void>;
  onClose: () => void;
}

interface UseFlashcardFormReturn {
  methods: ReturnType<typeof useForm<FlashcardFormData>>;
  serverErrors: string[];
  isSubmitting: boolean;
  selectedTags: number[];
  categoryId: number | undefined;
  contentSourceId: number | undefined;
  originValue: FlashcardFormValues["origin"];
  handleTagToggle: (tagId: number) => void;
  handleCategoryChange: (value: string) => void;
  handleSourceChange: (value: string) => void;
  handleOriginChange: (value: string) => void;
  handleFormSubmit: (data: FlashcardFormData) => Promise<void>;
  title: string;
  description: string;
}

function createDefaultValues(initialValues?: FlashcardFormValues): FlashcardFormData {
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

function mapApiErrors(
  error: ApiErrorResponse,
  setError: (field: keyof FlashcardFormData, error: { type: string; message: string }) => void
): string[] {
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

export function useFlashcardForm({
  mode,
  initialValues,
  onSubmit,
  onClose,
}: UseFlashcardFormOptions): UseFlashcardFormReturn {
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<FlashcardFormData>({
    resolver: zodResolver(formSchema),
    mode: "all",
    defaultValues: useMemo(() => createDefaultValues(initialValues), [initialValues]),
  });

  const { setValue, setError, clearErrors, reset } = methods;

  const selectedTags = useWatch({ control: methods.control, name: "tagIds" }) ?? [];
  const categoryId = useWatch({ control: methods.control, name: "categoryId" });
  const contentSourceId = useWatch({ control: methods.control, name: "contentSourceId" });
  const originValue = useWatch({ control: methods.control, name: "origin" });

  // Reset form when modal opens with new initial values
  useEffect(() => {
    reset(createDefaultValues(initialValues));
    setServerErrors([]);
  }, [initialValues, reset]);

  const handleTagToggle = (tagId: number) => {
    const current = methods.getValues("tagIds");
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

  const handleFormSubmit = async (data: FlashcardFormData) => {
    setServerErrors([]);
    clearErrors("metadataJson");
    setIsSubmitting(true);

    const metadataResult = parseMetadata(data.metadataJson);
    if (!metadataResult.success) {
      setError("metadataJson", { type: "manual", message: metadataResult.error });
      setIsSubmitting(false);
      return;
    }

    const payload: FlashcardFormValues = {
      front: data.front.trim(),
      back: data.back.trim(),
      categoryId: data.categoryId,
      contentSourceId: data.contentSourceId,
      origin: data.origin,
      tagIds: data.tagIds,
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

  return {
    methods,
    serverErrors,
    isSubmitting,
    selectedTags,
    categoryId,
    contentSourceId,
    originValue,
    handleTagToggle,
    handleCategoryChange,
    handleSourceChange,
    handleOriginChange,
    handleFormSubmit,
    title,
    description,
  };
}

export { MAX_TAGS, NO_CATEGORY_VALUE, NO_SOURCE_VALUE };
