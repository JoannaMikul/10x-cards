import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ApiErrorResponse, CategoryFormMode, CategoryFormValues } from "../../../types";
import { createCategoryBodySchema } from "../../../lib/validation/categories.schema";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { FieldGroup, Field, FieldLabel, FieldDescription, FieldError } from "../../ui/field";
import { FormError } from "../../common/FormError";

interface CategoryFormModalProps {
  open: boolean;
  mode: CategoryFormMode;
  initialValues?: CategoryFormValues;
  existingSlugs: string[];
  onSubmit: (values: CategoryFormValues) => void;
  onClose: () => void;
  submitting: boolean;
  apiError?: ApiErrorResponse;
  fieldErrors?: string[];
}

type CategoryFormData = z.infer<typeof createCategoryBodySchema>;

export function CategoryFormModal({
  open,
  mode,
  initialValues,
  existingSlugs,
  onSubmit,
  onClose,
  submitting,
  apiError,
  fieldErrors = [],
}: CategoryFormModalProps) {
  const categoryFormSchema = createCategoryBodySchema.extend({
    slug: createCategoryBodySchema.shape.slug.refine(
      (slug) => mode === "edit" || !existingSlugs.includes(slug),
      "Slug is already taken"
    ),
  });

  const methods = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    mode: "all",
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      color: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
    watch,
  } = methods;

  const watchedColor = watch("color");
  const isFormValid = isValid;

  useEffect(() => {
    if (open) {
      reset(
        initialValues ?? {
          name: "",
          slug: "",
          description: "",
          color: "",
        }
      );
    }
  }, [open, initialValues, reset, mode]);

  const handleFormSubmit = (data: CategoryFormData) => {
    onSubmit(data as CategoryFormValues);
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const title = mode === "create" ? "Add Category" : "Edit Category";
  const description =
    mode === "create" ? "Create a new category that will be available to all users." : "Modify an existing category.";

  const allErrors = [
    ...fieldErrors,
    ...(apiError ? [apiError.error.message] : []),
    ...(errors.name?.message ? [errors.name.message] : []),
    ...(errors.slug?.message ? [errors.slug.message] : []),
    ...(errors.description?.message ? [errors.description.message] : []),
    ...(errors.color?.message ? [errors.color.message] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <FormError errors={allErrors} />

          <FormProvider {...methods}>
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="category-name">Name *</FieldLabel>
                <Input
                  id="category-name"
                  type="text"
                  disabled={submitting}
                  maxLength={100}
                  placeholder="e.g., Programming"
                  {...register("name")}
                />
                {errors.name && <FieldError errors={[errors.name]} />}
              </Field>

              <Field data-invalid={!!errors.slug}>
                <FieldLabel htmlFor="category-slug">Slug *</FieldLabel>
                <Input
                  id="category-slug"
                  type="text"
                  disabled={submitting}
                  maxLength={50}
                  placeholder="e.g., programming"
                  {...register("slug", {
                    onChange: (e) => {
                      e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
                    },
                  })}
                />
                <FieldDescription>Lowercase letters, numbers, and hyphens. Used in URLs and filters.</FieldDescription>
                {errors.slug && <FieldError errors={[errors.slug]} />}
              </Field>

              <Field data-invalid={!!errors.description}>
                <FieldLabel htmlFor="category-description">Description</FieldLabel>
                <Textarea
                  id="category-description"
                  disabled={submitting}
                  maxLength={512}
                  placeholder="Brief description of the category..."
                  rows={3}
                  {...register("description")}
                />
                {errors.description && <FieldError errors={[errors.description]} />}
              </Field>

              <Field data-invalid={!!errors.color}>
                <FieldLabel htmlFor="category-color">Color</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="category-color"
                    type="color"
                    disabled={submitting}
                    className="w-16 h-10 p-1 border rounded"
                    value={watchedColor || ""}
                    onChange={(e) => setValue("color", e.target.value)}
                  />
                  <Input
                    id="category-color-text"
                    type="text"
                    disabled={submitting}
                    placeholder="#RRGGBB"
                    maxLength={7}
                    className="flex-1"
                    value={watchedColor || ""}
                    onChange={(e) => setValue("color", e.target.value)}
                  />
                </div>
                <FieldDescription>Optional color in hex format (#RRGGBB).</FieldDescription>
                {errors.color && <FieldError errors={[errors.color]} />}
              </Field>
            </FieldGroup>
          </FormProvider>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !isFormValid}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
