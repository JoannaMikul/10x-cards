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
import { FieldGroup } from "../../ui/field";
import { FormField } from "../../ui/form-field";
import { FormAlertError } from "../../ui/form-error";

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

function createCategoryFormSchema(mode: CategoryFormMode, existingSlugs: string[]) {
  return createCategoryBodySchema.extend({
    slug: createCategoryBodySchema.shape.slug.refine(
      (slug) => mode === "edit" || !existingSlugs.includes(slug),
      "Slug is already taken"
    ),
  });
}

export function CategoryFormModal({
  open,
  mode,
  initialValues,
  existingSlugs,
  onSubmit,
  onClose,
  submitting,
  apiError,
}: CategoryFormModalProps) {
  const categoryFormSchema = createCategoryFormSchema(mode, existingSlugs);

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

  const handleColorChange = (value: string) => {
    setValue("color", value, { shouldValidate: true, shouldDirty: true });
  };

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
  }, [open, initialValues, reset]);

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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <FormAlertError error={apiError ? { message: apiError.error.message } : null} />

          <FormProvider {...methods}>
            <FieldGroup>
              <FormField label="Name" htmlFor="category-name" error={errors.name} hint="e.g., Programming" required>
                <Input
                  id="category-name"
                  type="text"
                  disabled={submitting}
                  maxLength={100}
                  placeholder="e.g., Programming"
                  {...register("name")}
                />
              </FormField>

              <FormField
                label="Slug"
                htmlFor="category-slug"
                error={errors.slug}
                hint="Lowercase letters, numbers, and hyphens. Used in URLs and filters."
                required
              >
                <Input
                  id="category-slug"
                  type="text"
                  disabled={submitting}
                  maxLength={50}
                  placeholder="e.g., programming"
                  {...register("slug", {
                    setValueAs: (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  })}
                />
              </FormField>

              <FormField
                label="Description"
                htmlFor="category-description"
                error={errors.description}
                hint="Brief description of the category..."
              >
                <Textarea
                  id="category-description"
                  disabled={submitting}
                  maxLength={512}
                  placeholder="Brief description of the category..."
                  rows={3}
                  {...register("description")}
                />
              </FormField>

              <FormField
                label="Color"
                htmlFor="category-color"
                error={errors.color}
                hint="Optional color in hex format (#RRGGBB)."
              >
                <div className="flex gap-2">
                  <Input
                    id="category-color"
                    type="color"
                    disabled={submitting}
                    className="w-16 h-10 p-1 border rounded"
                    value={watchedColor || ""}
                    onChange={(e) => handleColorChange(e.target.value)}
                  />
                  <Input
                    id="category-color-text"
                    type="text"
                    disabled={submitting}
                    placeholder="#RRGGBB"
                    maxLength={7}
                    className="flex-1"
                    {...register("color", {
                      setValueAs: (value: string) => value || undefined,
                    })}
                    onChange={(e) => handleColorChange(e.target.value)}
                  />
                </div>
              </FormField>
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
