import { useCallback, useMemo, useState } from "react";
import type { FlashcardDTO, FlashcardSelectionState, FlashcardAggregatesDTO } from "../../types";

interface UseFlashcardSelectionOptions {
  items: FlashcardDTO[];
  aggregates?: FlashcardAggregatesDTO;
}

interface UseFlashcardSelectionReturn {
  selectionState: FlashcardSelectionState;
  derivedSelectedIds: string[];
  totalSelectedCount: number;
  canStartReview: boolean;
  hasActiveSelection: boolean;
  selectionModeLabel: string;
  selectionDescription: string;
  handleToggleSelectForReview: (cardId: string) => void;
  handleSelectionModeToggle: () => void;
}

export function useFlashcardSelection({
  items,
  aggregates,
}: UseFlashcardSelectionOptions): UseFlashcardSelectionReturn {
  const [selectionState, setSelectionState] = useState<FlashcardSelectionState>({
    selectedIds: [],
    mode: "manual",
  });

  const derivedSelectedIds = useMemo(
    () => (selectionState.mode === "all-filtered" ? items.map((card) => card.id) : selectionState.selectedIds),
    [selectionState.mode, selectionState.selectedIds, items]
  );

  const totalSelectedCount = useMemo(
    () =>
      selectionState.mode === "all-filtered" ? (aggregates?.total ?? items.length) : selectionState.selectedIds.length,
    [selectionState.mode, selectionState.selectedIds.length, aggregates?.total, items.length]
  );

  const canStartReview = useMemo(
    () =>
      selectionState.mode === "all-filtered"
        ? (aggregates?.total ?? items.length) > 0
        : selectionState.selectedIds.length > 0,
    [selectionState.mode, selectionState.selectedIds.length, aggregates?.total, items.length]
  );

  const hasActiveSelection = canStartReview;

  const selectionModeLabel = selectionState.mode === "manual" ? "Manual selection" : "All filtered cards";

  const selectionDescription = useMemo(() => {
    if (selectionState.mode === "manual") {
      return `${totalSelectedCount} card${totalSelectedCount === 1 ? "" : "s"} selected`;
    }
    return `Using all cards that match current filters (${totalSelectedCount.toLocaleString()} total)`;
  }, [selectionState.mode, totalSelectedCount]);

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

  return {
    selectionState,
    derivedSelectedIds,
    totalSelectedCount,
    canStartReview,
    hasActiveSelection,
    selectionModeLabel,
    selectionDescription,
    handleToggleSelectForReview,
    handleSelectionModeToggle,
  };
}
