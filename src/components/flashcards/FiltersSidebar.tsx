import { useMemo } from "react";
import type { ReactNode } from "react";
import { FormProvider, Controller } from "react-hook-form";
import type { FlashcardAggregatesDTO, FlashcardsFilters, CategoryDTO, TagDTO, SourceDTO } from "../../types";
import { useFiltersForm } from "../hooks/useFiltersForm";
import { createDefaultFlashcardsFilters } from "./constants";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SortDropdown } from "./SortDropdown";
import { cn } from "../../lib/utils";

const ALL_CATEGORIES_VALUE = "all-categories";
const ALL_SOURCES_VALUE = "all-sources";
const ALL_ORIGINS_VALUE = "all-origins";
const ORIGIN_OPTIONS: { value: NonNullable<FlashcardsFilters["origin"]>; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "ai-edited", label: "AI edited" },
  { value: "ai-full", label: "AI full" },
];

export interface FiltersControlsProps {
  filters: FlashcardsFilters;
  categories?: CategoryDTO[];
  tags?: TagDTO[];
  sources?: SourceDTO[];
  aggregates?: FlashcardAggregatesDTO;
  onChange: (next: FlashcardsFilters) => void;
  onReset: () => void;
}

interface FiltersSidebarProps extends FiltersControlsProps {
  variant?: "sidebar" | "panel";
}

export function FiltersSidebar({ variant = "sidebar", ...props }: FiltersSidebarProps) {
  const header = (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">Filters</h2>
      {props.aggregates && (
        <p className="text-sm text-muted-foreground">{props.aggregates.total.toLocaleString()} flashcards in total</p>
      )}
    </div>
  );

  if (variant === "panel") {
    return (
      <section className="w-full" aria-label="Flashcard filters">
        <div className="space-y-4 rounded-xl border bg-background/80 p-4 shadow-sm backdrop-blur">
          {header}
          <FiltersForm {...props} layout="panel" />
        </div>
      </section>
    );
  }

  return (
    <aside
      className="hidden md:block md:w-72 lg:w-80 md:shrink-0 md:sticky md:top-40 md:self-start"
      aria-label="Flashcard filters"
    >
      <div className="space-y-6 rounded-xl border p-5 shadow-sm bg-background/80 backdrop-blur">
        {header}
        <FiltersForm {...props} layout="sidebar" />
      </div>
    </aside>
  );
}

interface FiltersFormProps extends FiltersControlsProps {
  layout?: "sidebar" | "drawer" | "panel";
}

export function FiltersForm({
  filters,
  categories = [],
  tags = [],
  sources = [],
  aggregates,
  onChange,
  onReset,
  layout = "sidebar",
}: FiltersFormProps) {
  const isPanelLayout = layout === "panel";
  const originCounters = useMemo(() => aggregates?.by_origin ?? {}, [aggregates]);
  const defaultFilters = createDefaultFlashcardsFilters();

  const methods = useFiltersForm({ filters, onChange });

  const filterItemClass = "min-w-[180px] lg:flex-1";

  const filterFields = (
    <>
      <div className="grid w-full grid-cols-2 gap-4 pb-4 lg:flex lg:flex-nowrap">
        <Field className={filterItemClass}>
          <FieldLabel>Category</FieldLabel>
          <Controller
            name="categoryId"
            control={methods.control}
            render={({ field }) => (
              <Select
                value={typeof field.value === "number" ? String(field.value) : ALL_CATEGORIES_VALUE}
                onValueChange={(value) => {
                  field.onChange(value === ALL_CATEGORIES_VALUE ? undefined : Number(value));
                }}
              >
                <SelectTrigger aria-label="Filter by category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CATEGORIES_VALUE}>All categories</SelectItem>
                  <SelectSeparator />
                  <SelectGroupWithFallback
                    emptyLabel="No categories available"
                    items={categories}
                    renderItem={(category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    )}
                  />
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field className={filterItemClass}>
          <FieldLabel>Source</FieldLabel>
          <Controller
            name="contentSourceId"
            control={methods.control}
            render={({ field }) => (
              <Select
                value={typeof field.value === "number" ? String(field.value) : ALL_SOURCES_VALUE}
                onValueChange={(value) => {
                  field.onChange(value === ALL_SOURCES_VALUE ? undefined : Number(value));
                }}
              >
                <SelectTrigger aria-label="Filter by source">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SOURCES_VALUE}>All sources</SelectItem>
                  <SelectSeparator />
                  <SelectGroupWithFallback
                    emptyLabel="No sources available"
                    items={sources}
                    renderItem={(source) => (
                      <SelectItem key={source.id} value={String(source.id)}>
                        {source.name}
                      </SelectItem>
                    )}
                  />
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field className={filterItemClass}>
          <FieldLabel>Origin</FieldLabel>
          <Controller
            name="origin"
            control={methods.control}
            render={({ field }) => (
              <Select
                value={field.value ?? ALL_ORIGINS_VALUE}
                onValueChange={(value) => {
                  field.onChange(value === ALL_ORIGINS_VALUE ? undefined : value);
                }}
              >
                <SelectTrigger aria-label="Filter by origin">
                  <SelectValue placeholder="All origins" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ORIGINS_VALUE}>All origins</SelectItem>
                  <SelectSeparator />
                  {ORIGIN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{option.label}</span>
                        {typeof originCounters?.[option.value] === "number" && (
                          <Badge variant="outline" className="ml-auto">
                            {originCounters[option.value]}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field className={filterItemClass}>
          <FieldLabel>Sort order</FieldLabel>
          <Controller
            name="sort"
            control={methods.control}
            render={({ field }) => <SortDropdown value={field.value ?? "-created_at"} onChange={field.onChange} />}
          />
        </Field>
      </div>

      <Field className={isPanelLayout ? "md:col-span-2" : undefined}>
        <FieldLabel>Tags</FieldLabel>
        <Controller
          name="tagIds"
          control={methods.control}
          render={({ field }) => (
            <div className="flex flex-row flex-wrap gap-2">
              {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags available</p>}
              {tags.map((tag) => {
                const checked = field.value?.includes(tag.id) ?? false;
                return (
                  <label
                    key={tag.id}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1 text-sm cursor-pointer transition-colors",
                      checked
                        ? "border-primary bg-primary/10 text-primary shadow-sm dark:bg-primary/20 dark:text-primary-foreground"
                        : "border-border text-foreground hover:border-foreground/60 dark:text-foreground"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(checked) => {
                        const current = field.value ?? [];
                        if (checked) {
                          field.onChange([...current, tag.id]);
                        } else {
                          field.onChange(current.filter((id) => id !== tag.id));
                        }
                      }}
                      aria-label={`Toggle tag ${tag.name}`}
                    />
                    <span>{tag.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        />
      </Field>
    </>
  );

  const handleReset = () => {
    methods.reset(defaultFilters);
    onReset();
  };

  return (
    <FormProvider {...methods}>
      <form
        className={isPanelLayout ? "space-y-4" : "space-y-6"}
        aria-describedby={layout === "drawer" ? "filters-drawer-description" : undefined}
        onSubmit={(event) => event.preventDefault()}
        data-testid="filters-form"
      >
        {isPanelLayout ? <div>{filterFields}</div> : <FieldGroup>{filterFields}</FieldGroup>}

        <div
          className={`${isPanelLayout ? "flex flex-wrap justify-end gap-2" : "flex flex-col gap-2"} mt-4`}
          data-testid="filters-actions"
        >
          <Button
            type="button"
            variant="secondary"
            onClick={handleReset}
            className={isPanelLayout ? "w-full md:w-auto" : ""}
            data-testid="reset-filters-button"
          >
            Reset filters
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

interface SelectGroupWithFallbackProps<T> {
  items: T[];
  emptyLabel: string;
  renderItem: (item: T) => ReactNode;
}

function SelectGroupWithFallback<T>({ items, emptyLabel, renderItem }: SelectGroupWithFallbackProps<T>) {
  if (!items.length) {
    return <SelectLabel>{emptyLabel}</SelectLabel>;
  }

  return <>{items.map((item) => renderItem(item))}</>;
}
