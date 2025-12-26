import { ChevronDownIcon, ChevronUpIcon, FilterIcon, PlayIcon, PlusIcon, ShuffleIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Button } from "../ui/button";
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
import { SearchInput } from "./SearchInput";

interface FlashcardsPageProps {
  categories?: CategoryDTO[];
  tags?: TagDTO[];
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

  const handleRequestRestore = (card: FlashcardDTO) => {
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
        <div className="flex justify-between items-stretch gap-4">
          <div className="flex-1 space-y-6 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full flex-1 min-w-[240px] max-w-full">
                <SearchInput
                  value={filters.search}
                  onChange={handleSearchChange}
                  onDebouncedChange={handleSearchDebouncedChange}
                  placeholder="Search by front or back…"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setAreFiltersExpanded(!areFiltersExpanded)}>
                  {areFiltersExpanded ? (
                    <ChevronUpIcon className="mr-2 size-4" />
                  ) : (
                    <ChevronDownIcon className="mr-2 size-4" />
                  )}
                  {areFiltersExpanded ? "Hide filters" : "Show filters"}
                </Button>
                <Button variant="outline" className="md:hidden" onClick={() => setFiltersDrawerOpen(true)}>
                  <FilterIcon className="mr-2 size-4" />
                  Filters
                </Button>
                <Button variant="outline" onClick={handleSelectionModeToggle}>
                  <ShuffleIcon className="mr-2 size-4" />
                  {selectionState.mode === "manual" ? "Use all filtered" : "Use manual selection"}
                </Button>
              </div>
              <Separator orientation="vertical" className="hidden md:block h-6 bg-border/70" />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleOpenCreateModal}>
                  <PlusIcon className="mr-2 size-4" />
                  Add flashcard
                </Button>
                <Button className="self-end" onClick={handleStartReview} disabled={!canStartReview}>
                  <PlayIcon className="mr-2 size-4" />
                  Review flashcards
                </Button>
              </div>
            </div>
          </div>
        </div>

        {areFiltersExpanded && (
          <>
            <div className="pt-4 pb-4">
              <Separator className="bg-border/70" />
            </div>
            <FiltersForm
              filters={filters}
              categories={categories}
              tags={tags}
              sources={sources}
              aggregates={state.aggregates}
              canShowDeleted={canShowDeleted}
              onChange={handleFiltersChange}
              onReset={handleResetFilters}
              layout="panel"
            />
          </>
        )}
      </div>

      <div className="flex w-full shrink-0 self-stretch">
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm flex h-full w-full flex-col">
          <div>
            <p className="font-medium text-foreground">{selectionModeLabel}</p>
            <p className="text-muted-foreground">{selectionDescription}</p>
          </div>
          {filters.includeDeleted && (
            <Badge variant="outline" className="mt-3">
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
        />
      </div>

      <FiltersDrawer
        open={isFiltersDrawerOpen}
        onOpenChange={handleDrawerOpenChange}
        filters={filters}
        categories={categories}
        tags={tags}
        sources={sources}
        aggregates={state.aggregates}
        canShowDeleted={canShowDeleted}
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
