import { FormProvider } from "react-hook-form";
import type { CategoryDTO, FlashcardFormMode, FlashcardFormValues, SourceDTO, TagDTO } from "../../types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { FormError } from "../common/FormError";
import { cn } from "../../lib/utils";
import { useFlashcardForm, NO_CATEGORY_VALUE, NO_SOURCE_VALUE, MAX_TAGS } from "../hooks/useFlashcardForm";

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
  const {
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
  } = useFlashcardForm({
    mode,
    initialValues,
    onSubmit,
    onClose,
  });

  const { register, handleSubmit, formState } = methods;
  const { isValid } = formState;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="flashcard-form-modal">
        <DialogHeader>
          <DialogTitle data-testid="flashcard-form-title">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form className="space-y-5" onSubmit={handleSubmit(handleFormSubmit)} data-testid="flashcard-form">
            <FormError errors={serverErrors} visible={serverErrors.length > 0} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="front">Front</FieldLabel>
                <Textarea id="front" rows={3} maxLength={200} {...register("front")} data-testid="front-textarea" />
                <FieldDescription>Maximum 200 characters</FieldDescription>
                <FieldError errors={[methods.formState.errors.front]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="back">Back</FieldLabel>
                <Textarea id="back" rows={4} maxLength={500} {...register("back")} data-testid="back-textarea" />
                <FieldDescription>Maximum 500 characters</FieldDescription>
                <FieldError errors={[methods.formState.errors.back]} />
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
                <FieldError errors={[methods.formState.errors.categoryId]} />
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
                <FieldError errors={[methods.formState.errors.contentSourceId]} />
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
                <FieldError errors={[methods.formState.errors.origin]} />
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
                <FieldError errors={[methods.formState.errors.tagIds]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="metadata">Metadata (JSON)</FieldLabel>
                <Textarea
                  id="metadata"
                  rows={3}
                  placeholder='e.g. { "language": "EN" }'
                  {...register("metadataJson")}
                />
                <FieldDescription>Optional JSON object with custom metadata.</FieldDescription>
                <FieldError errors={[methods.formState.errors.metadataJson]} />
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
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
