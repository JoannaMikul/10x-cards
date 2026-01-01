import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { filtersFormSchema, type FiltersFormData } from "../../lib/validation/flashcards.schema";
import type { FlashcardsFilters } from "../../types";

interface UseFiltersFormOptions {
  filters: FlashcardsFilters;
  onChange: (filters: FlashcardsFilters) => void;
}

export function useFiltersForm({ filters, onChange }: UseFiltersFormOptions) {
  const methods = useForm<FiltersFormData>({
    resolver: zodResolver(filtersFormSchema),
    defaultValues: filters,
    mode: "all",
  });

  const watchedValues = useWatch({ control: methods.control });
  const isUpdatingFromExternal = useRef(false);

  // Synchronize external state changes to RHF
  useEffect(() => {
    isUpdatingFromExternal.current = true;
    methods.reset(filters);
    // Reset the flag after the reset is complete
    setTimeout(() => {
      isUpdatingFromExternal.current = false;
    }, 0);
  }, [filters, methods]);

  // Propagate RHF changes to external state
  useEffect(() => {
    // Only propagate changes if they didn't come from external filters update
    if (!isUpdatingFromExternal.current && watchedValues && Object.keys(watchedValues).length > 0) {
      onChange(watchedValues as FlashcardsFilters);
    }
  }, [watchedValues, onChange]);

  return methods;
}
