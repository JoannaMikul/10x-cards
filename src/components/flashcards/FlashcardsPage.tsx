import { useCallback, useEffect, useId, useState } from "react";
import type { CategoryDTO, FlashcardDTO, FlashcardFormValues, FlashcardsFilters, SourceDTO, TagDTO } from "../../types";
import { Separator } from "../ui/separator";
import { Toaster } from "../ui/sonner";
import { useFlashcards } from "../hooks/useFlashcards";
import { useFlashcardSelection } from "../hooks/useFlashcardSelection";
import { useFlashcardModals } from "../hooks/useFlashcardModals";
import { ConfirmDialog } from "./ConfirmDialog";
import { FiltersDrawer } from "./FiltersDrawer";
import { FlashcardFormModal } from "./FlashcardFormModal";
import { FlashcardList } from "./FlashcardList";
import { FlashcardsFiltersProvider, useFlashcardsFilters } from "./FlashcardsFiltersContext";
import { FiltersForm } from "./FiltersSidebar";
import { FlashcardsToolbar } from "./FlashcardsToolbar";
import { FlashcardsPageHeader } from "./FlashcardsPageHeader";
import { FlashcardsSelectionPanel } from "./FlashcardsSelectionPanel";
import {
  buildReviewsUrl,
  cloneFilters,
  mapFormValuesToCreateCommand,
  mapFormValuesToUpdateCommand,
} from "../../lib/utils/flashcard-form-mappers";

interface FlashcardsPageProps {
  categories?: CategoryDTO[];
  tags?: TagDTO[];
  filterTags?: TagDTO[];
  sources?: SourceDTO[];
  canShowDeleted?: boolean;
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
  const [areFiltersExpanded, setAreFiltersExpanded] = useState(false);
  const includeDeletedCheckboxId = useId();

  const selection = useFlashcardSelection({
    items: state.items,
    aggregates: state.aggregates,
  });

  const modals = useFlashcardModals(canShowDeleted);

  const filtersSignature = JSON.stringify(filters);
  useEffect(() => {
    // Reset selection when filters change - this is handled internally by the hook
  }, [filtersSignature]);

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
    },
    [setFilters]
  );

  const handleResetFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

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

  const handleSubmitForm = async (values: FlashcardFormValues) => {
    if (modals.formState.mode === "create") {
      const payload = mapFormValuesToCreateCommand(values);
      await createFlashcard(payload);
      return;
    }

    if (!modals.formState.cardId) {
      return;
    }

    const payload = mapFormValuesToUpdateCommand(values);
    await updateFlashcard(modals.formState.cardId, payload);
  };

  const canRestoreCards = canShowDeleted;

  const handleConfirmAction = async () => {
    if (!modals.confirmState.card) {
      return;
    }

    modals.setConfirmProcessing(true);
    try {
      if (modals.confirmState.mode === "delete") {
        await deleteFlashcard(modals.confirmState.card.id);
      } else {
        await restoreFlashcard(modals.confirmState.card.id);
      }
      modals.closeConfirmDialog();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      modals.setConfirmProcessing(false);
    }
  };

  const handleStartReview = () => {
    if (!selection.canStartReview) {
      return;
    }
    const url = buildReviewsUrl(filters, selection.selectionState);
    window.location.href = url;
  };

  const handleStartReviewFromCard = (card: FlashcardDTO) => {
    const url = buildReviewsUrl(filters, { mode: "manual", selectedIds: [card.id] });
    window.location.href = url;
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setFiltersDrawerOpen(open);
  };

  return (
    <div className="space-y-6" data-testid="flashcards-content">
      <FlashcardsPageHeader aggregates={state.aggregates} />

      <div className="sticky top-0 z-20 w-full rounded-none border border-border/60 bg-muted p-4 shadow-md">
        <FlashcardsToolbar
          searchValue={filters.search ?? ""}
          includeDeleted={Boolean(filters.includeDeleted)}
          canShowDeleted={canShowDeleted}
          includeDeletedCheckboxId={includeDeletedCheckboxId}
          canStartReview={selection.canStartReview}
          isManualSelectionMode={selection.selectionState.mode === "manual"}
          areFiltersExpanded={areFiltersExpanded}
          onSearchChange={handleSearchChange}
          onSearchDebouncedChange={handleSearchDebouncedChange}
          onCreateClick={modals.handleOpenCreateModal}
          onSelectionModeToggle={selection.handleSelectionModeToggle}
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

      <FlashcardsSelectionPanel
        hasActiveSelection={selection.hasActiveSelection}
        selectionModeLabel={selection.selectionModeLabel}
        selectionDescription={selection.selectionDescription}
        showDeletedBadge={Boolean(filters.includeDeleted)}
      />

      <div className="space-y-6">
        <FlashcardList
          items={state.items}
          loading={state.loading}
          error={state.error}
          hasMore={state.hasMore}
          onLoadMore={loadMore}
          onEdit={modals.handleOpenEditModal}
          onDelete={modals.handleRequestDelete}
          onRestore={modals.handleRequestRestore}
          onToggleSelectForReview={selection.handleToggleSelectForReview}
          selectedForReview={selection.derivedSelectedIds}
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
        open={modals.formState.open}
        mode={modals.formState.mode}
        initialValues={modals.formState.initialValues}
        categories={categories}
        sources={sources}
        tags={tags}
        onClose={modals.handleCloseFormModal}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDialog
        open={modals.confirmState.open}
        mode={modals.confirmState.mode}
        card={modals.confirmState.card}
        onCancel={modals.closeConfirmDialog}
        onConfirm={handleConfirmAction}
        isProcessing={modals.confirmState.isProcessing}
      />

      <Toaster />
    </div>
  );
}
