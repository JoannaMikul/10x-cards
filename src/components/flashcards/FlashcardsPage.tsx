import { useCallback, useEffect, useMemo, useState, useId } from "react";
import type {
  CategoryDTO,
  CreateFlashcardCommand,
  FlashcardDTO,
  FlashcardFormMode,
  FlashcardFormValues,
  FlashcardSelectionState,
  FlashcardsFilters,
  SourceDTO,
  TagDTO,
  UpdateFlashcardCommand,
} from "../../types";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Toaster } from "../ui/sonner";
import { useFlashcards } from "../hooks/useFlashcards";
import { ConfirmDialog } from "./ConfirmDialog";
import { FiltersDrawer } from "./FiltersDrawer";
import { FlashcardFormModal } from "./FlashcardFormModal";
import { FlashcardList } from "./FlashcardList";
import { FlashcardsFiltersProvider, useFlashcardsFilters } from "./FlashcardsFiltersContext";
import { FiltersForm } from "./FiltersSidebar";
import { FlashcardsToolbar } from "./FlashcardsToolbar";
import { cn } from "../../lib/utils";

interface FlashcardsPageProps {
  categories?: CategoryDTO[];
  tags?: TagDTO[];
  filterTags?: TagDTO[];
  sources?: SourceDTO[];
  canShowDeleted?: boolean;
}

interface FormState {
  open: boolean;
  mode: FlashcardFormMode;
  cardId?: string;
  initialValues?: FlashcardFormValues;
}

interface ConfirmState {
  open: boolean;
  mode: "delete" | "restore";
  card?: FlashcardDTO;
  isProcessing: boolean;
}

export function FlashcardsPage(props: FlashcardsPageProps) {
  return (
    <FlashcardsFiltersProvider>
      <FlashcardsPageContent {...props} />
    </FlashcardsFiltersProvider>
  );
}

function FlashcardsPageContent({
  categories = [],
  tags = [],
  filterTags = [],
  sources = [],
  canShowDeleted = false,
}: FlashcardsPageProps) {
  const { filters, setFilters, resetFilters } = useFlashcardsFilters();
  const { state, loadMore, createFlashcard, updateFlashcard, deleteFlashcard, restoreFlashcard } = useFlashcards({
    filters,
    onFiltersChange: setFilters,
  });

  const [isFiltersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "create",
    initialValues: createEmptyFormValues(),
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    mode: "delete",
    isProcessing: false,
  });
  const [selectionState, setSelectionState] = useState<FlashcardSelectionState>({
    selectedIds: [],
    mode: "manual",
  });
  const [areFiltersExpanded, setAreFiltersExpanded] = useState(false);
  const includeDeletedCheckboxId = useId();

  const filtersSignature = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => {
    setSelectionState({ selectedIds: [], mode: "manual" });
  }, [filtersSignature]);

  const derivedSelectedIds =
    selectionState.mode === "all-filtered" ? state.items.map((card) => card.id) : selectionState.selectedIds;
  const totalSelectedCount =
    selectionState.mode === "all-filtered"
      ? (state.aggregates?.total ?? state.items.length)
      : selectionState.selectedIds.length;
  const canStartReview =
    selectionState.mode === "all-filtered"
      ? (state.aggregates?.total ?? state.items.length) > 0
      : selectionState.selectedIds.length > 0;
  const hasActiveSelection = canStartReview;

  const handleSearchChange = useCallback(
    (value: string) => {
      setFilters((prev) => ({ ...prev, search: value }));
    },
    [setFilters]
  );

  const handleSearchDebouncedChange = useCallback(
    (value: string) => {
      setFilters((prev) => ({ ...prev, search: value }));
    },
    [setFilters]
  );

  const handleFiltersChange = useCallback(
    (next: FlashcardsFilters) => {
      setFilters(() => cloneFilters(next));
      setSelectionState({ selectedIds: [], mode: "manual" });
    },
    [setFilters]
  );

  const handleResetFilters = useCallback(() => {
    resetFilters();
    setSelectionState({ selectedIds: [], mode: "manual" });
  }, [resetFilters]);

  const handleToggleSelectForReview = useCallback((cardId: string) => {
    setSelectionState((prev) => {
      if (prev.mode === "all-filtered") {
        const exists = prev.selectedIds.includes(cardId);
        return {
          mode: "manual",
          selectedIds: exists ? prev.selectedIds.filter((id) => id !== cardId) : [...prev.selectedIds, cardId],
        };
      }

      const exists = prev.selectedIds.includes(cardId);
      return {
        ...prev,
        selectedIds: exists ? prev.selectedIds.filter((id) => id !== cardId) : [...prev.selectedIds, cardId],
      };
    });
  }, []);

  const handleSelectionModeToggle = useCallback(() => {
    setSelectionState((prev) => ({
      ...prev,
      mode: prev.mode === "manual" ? "all-filtered" : "manual",
    }));
  }, []);

  const handleIncludeDeletedToggle = useCallback(
    (checked: boolean) => {
      handleFiltersChange({
        ...filters,
        includeDeleted: checked,
      });
    },
    [filters, handleFiltersChange]
  );

  const toggleFiltersExpansion = useCallback(() => {
    setAreFiltersExpanded((prev) => !prev);
  }, []);

  const handleOpenCreateModal = () => {
    setFormState({
      open: true,
      mode: "create",
      initialValues: createEmptyFormValues(),
    });
  };

  const handleOpenEditModal = (card: FlashcardDTO) => {
    setFormState({
      open: true,
      mode: "edit",
      cardId: card.id,
      initialValues: mapCardToFormValues(card),
    });
  };

  const handleCloseFormModal = () => {
    setFormState((prev) => ({ ...prev, open: false }));
  };

  const handleSubmitForm = async (values: FlashcardFormValues) => {
    if (formState.mode === "create") {
      const payload = mapFormValuesToCreateCommand(values);
      await createFlashcard(payload);
      return;
    }

    if (!formState.cardId) {
      return;
    }

    const payload = mapFormValuesToUpdateCommand(values);
    await updateFlashcard(formState.cardId, payload);
  };

  const handleRequestDelete = (card: FlashcardDTO) => {
    setConfirmState({
      open: true,
      mode: "delete",
      card,
      isProcessing: false,
    });
  };

  const canRestoreCards = canShowDeleted;

  const handleRequestRestore = (card: FlashcardDTO) => {
    if (!canRestoreCards) {
      return;
    }
    setConfirmState({
      open: true,
      mode: "restore",
      card,
      isProcessing: false,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmState((prev) => ({
      ...prev,
      open: false,
      isProcessing: false,
    }));
  };

  const handleConfirmAction = async () => {
    if (!confirmState.card) {
      return;
    }

    setConfirmState((prev) => ({ ...prev, isProcessing: true }));
    try {
      if (confirmState.mode === "delete") {
        await deleteFlashcard(confirmState.card.id);
      } else {
        await restoreFlashcard(confirmState.card.id);
      }
      closeConfirmDialog();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      setConfirmState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  const handleStartReview = () => {
    if (!canStartReview) {
      return;
    }
    const url = buildReviewsUrl(filters, selectionState);
    window.location.href = url;
  };

  const handleStartReviewFromCard = (card: FlashcardDTO) => {
    const url = buildReviewsUrl(filters, { mode: "manual", selectedIds: [card.id] });
    window.location.href = url;
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setFiltersDrawerOpen(open);
  };

  const selectionModeLabel = selectionState.mode === "manual" ? "Manual selection" : "All filtered cards";
  const selectionDescription =
    selectionState.mode === "manual"
      ? `${totalSelectedCount} card${totalSelectedCount === 1 ? "" : "s"} selected`
      : `Using all cards that match current filters (${totalSelectedCount.toLocaleString()} total)`;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center md:text-left">
        <h1 className="text-3xl font-semibold text-foreground">Flashcards</h1>
        <p className="text-muted-foreground">
          Manage your personal collection, refine filters, and start review sessions faster.
        </p>
        {state.aggregates && (
          <p className="text-sm text-muted-foreground">
            {state.aggregates.total.toLocaleString()} flashcards in your workspace
          </p>
        )}
      </div>

      <div className="sticky top-0 z-20 w-full rounded-none border border-border/60 bg-muted p-4 shadow-md">
        <FlashcardsToolbar
          searchValue={filters.search ?? ""}
          includeDeleted={Boolean(filters.includeDeleted)}
          canShowDeleted={canShowDeleted}
          includeDeletedCheckboxId={includeDeletedCheckboxId}
          canStartReview={canStartReview}
          isManualSelectionMode={selectionState.mode === "manual"}
          areFiltersExpanded={areFiltersExpanded}
          onSearchChange={handleSearchChange}
          onSearchDebouncedChange={handleSearchDebouncedChange}
          onCreateClick={handleOpenCreateModal}
          onSelectionModeToggle={handleSelectionModeToggle}
          onStartReview={handleStartReview}
          onToggleFilters={toggleFiltersExpansion}
          onIncludeDeletedToggle={handleIncludeDeletedToggle}
        />

        {areFiltersExpanded && (
          <>
            <div className="pt-4 pb-4">
              <Separator className="bg-border/70" />
            </div>
            <FiltersForm
              filters={filters}
              categories={categories}
              tags={filterTags}
              sources={sources}
              aggregates={state.aggregates}
              onChange={handleFiltersChange}
              onReset={handleResetFilters}
              layout="panel"
            />
          </>
        )}
      </div>

      <div className="flex w-full shrink-0 self-stretch">
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm flex h-full w-full flex-col transition-colors",
            hasActiveSelection
              ? "border-primary/60 bg-primary/10 shadow-sm dark:border-primary/50 dark:bg-primary/20"
              : "border-border bg-muted/30"
          )}
        >
          <div>
            <p className={cn("font-medium", hasActiveSelection ? "text-primary" : "text-foreground")}>
              {selectionModeLabel}
            </p>
            <p className={cn(hasActiveSelection ? "text-primary/80 dark:text-primary/70" : "text-muted-foreground")}>
              {selectionDescription}
            </p>
          </div>
          {filters.includeDeleted && (
            <Badge variant="default" className="mt-3">
              Showing deleted cards
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <FlashcardList
          items={state.items}
          loading={state.loading}
          error={state.error}
          hasMore={state.hasMore}
          onLoadMore={loadMore}
          onEdit={handleOpenEditModal}
          onDelete={handleRequestDelete}
          onRestore={handleRequestRestore}
          onToggleSelectForReview={handleToggleSelectForReview}
          selectedForReview={derivedSelectedIds}
          onStartReviewFromCard={handleStartReviewFromCard}
          categories={categories}
          sources={sources}
          canRestore={canRestoreCards}
        />
      </div>

      <FiltersDrawer
        open={isFiltersDrawerOpen}
        onOpenChange={handleDrawerOpenChange}
        filters={filters}
        categories={categories}
        tags={filterTags}
        sources={sources}
        aggregates={state.aggregates}
        onChange={(next) => {
          handleFiltersChange(next);
        }}
        onReset={() => {
          handleResetFilters();
        }}
      />

      <FlashcardFormModal
        open={formState.open}
        mode={formState.mode}
        initialValues={formState.initialValues}
        categories={categories}
        sources={sources}
        tags={tags}
        onClose={handleCloseFormModal}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDialog
        open={confirmState.open}
        mode={confirmState.mode}
        card={confirmState.card}
        onCancel={closeConfirmDialog}
        onConfirm={handleConfirmAction}
        isProcessing={confirmState.isProcessing}
      />

      <Toaster />
    </div>
  );
}

function cloneFilters(filters: FlashcardsFilters): FlashcardsFilters {
  return {
    ...filters,
    tagIds: Array.isArray(filters.tagIds) ? [...filters.tagIds] : [],
  };
}

function createEmptyFormValues(): FlashcardFormValues {
  return {
    front: "",
    back: "",
    categoryId: undefined,
    contentSourceId: undefined,
    origin: "manual",
    tagIds: [],
    metadata: undefined,
  };
}

function mapCardToFormValues(card: FlashcardDTO): FlashcardFormValues {
  return {
    front: card.front,
    back: card.back,
    categoryId: card.category_id ?? undefined,
    contentSourceId: card.content_source_id ?? undefined,
    origin: card.origin,
    tagIds: (card.tags ?? []).map((tag) => tag.id),
    metadata: card.metadata ?? undefined,
  };
}

function mapFormValuesToCreateCommand(values: FlashcardFormValues): CreateFlashcardCommand {
  return {
    front: values.front,
    back: values.back,
    category_id: values.categoryId,
    content_source_id: values.contentSourceId,
    origin: values.origin,
    metadata: values.metadata,
    tag_ids: values.tagIds,
  };
}

function mapFormValuesToUpdateCommand(values: FlashcardFormValues): UpdateFlashcardCommand {
  return {
    front: values.front,
    back: values.back,
    category_id: values.categoryId,
    content_source_id: values.contentSourceId,
    origin: values.origin,
    metadata: values.metadata,
    tag_ids: values.tagIds,
  };
}

function buildReviewsUrl(filters: FlashcardsFilters, selection: FlashcardSelectionState): string {
  const params = new URLSearchParams();

  if (selection.mode === "manual" && selection.selectedIds.length > 0) {
    params.set("cardIds", selection.selectedIds.join(","));
  } else {
    const trimmedSearch = filters.search.trim();
    if (trimmedSearch.length > 0) {
      params.set("q", trimmedSearch);
    }
    if (typeof filters.categoryId === "number") {
      params.set("categoryId", String(filters.categoryId));
    }
    if (typeof filters.contentSourceId === "number") {
      params.set("sourceId", String(filters.contentSourceId));
    }
    if (filters.tagIds.length > 0) {
      params.set("tagIds", filters.tagIds.join(","));
    }
    if (filters.origin) {
      params.set("origin", filters.origin);
    }
    if (filters.includeDeleted) {
      params.set("showDeleted", "true");
    }
    if (filters.sort && filters.sort !== "-created_at") {
      params.set("sort", filters.sort);
    }
  }

  const query = params.toString();
  return query.length > 0 ? `/reviews?${query}` : "/reviews";
}
