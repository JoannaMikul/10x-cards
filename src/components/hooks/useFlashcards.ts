import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  ApiErrorResponse,
  CreateFlashcardCommand,
  FlashcardAggregatesDTO,
  FlashcardDTO,
  FlashcardListResponse,
  FlashcardsFilters,
  FlashcardsViewState,
  UpdateFlashcardCommand,
} from "../../types";
import { createDefaultFlashcardsFilters } from "../flashcards/constants";
import { flashcardsApiClient, ApiClientError } from "../../lib/api";

type FiltersUpdater = (prev: FlashcardsFilters) => FlashcardsFilters;

interface UseFlashcardsOptions {
  initialFilters?: FlashcardsFilters;
  filters?: FlashcardsFilters;
  onFiltersChange?: (updater: FiltersUpdater) => void;
}

interface UseFlashcardsReturn {
  state: FlashcardsViewState;
  setFilters: (updater: FiltersUpdater) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  createFlashcard: (payload: CreateFlashcardCommand) => Promise<void>;
  updateFlashcard: (id: string, payload: UpdateFlashcardCommand) => Promise<void>;
  deleteFlashcard: (id: string) => Promise<void>;
  restoreFlashcard: (id: string) => Promise<void>;
}

interface InternalListState {
  items: FlashcardDTO[];
  loading: boolean;
  error: ApiErrorResponse | null;
  nextCursor: string | null;
  hasMore: boolean;
  aggregates?: FlashcardAggregatesDTO;
}

interface FetchOptions {
  cursor?: string | null;
  append?: boolean;
  preserveItems?: boolean;
}

const FLASHCARDS_PAGE_LIMIT = 20;

export function useFlashcards(options?: UseFlashcardsOptions): UseFlashcardsReturn {
  const {
    initialFilters = createDefaultFlashcardsFilters(),
    filters: controlledFilters,
    onFiltersChange,
  } = options ?? {};
  const [localFilters, setLocalFilters] = useState<FlashcardsFilters>(() => cloneFilters(initialFilters));
  const filters = controlledFilters ?? localFilters;

  const setFilters = useCallback(
    (updater: FiltersUpdater) => {
      if (onFiltersChange) {
        onFiltersChange(updater);
        return;
      }
      setLocalFilters((prev) => cloneFilters(updater(prev)));
    },
    [onFiltersChange]
  );

  const [listState, setListState] = useState<InternalListState>({
    items: [],
    loading: false,
    error: null,
    nextCursor: null,
    hasMore: false,
    aggregates: undefined,
  });
  const listStateRef = useRef(listState);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchFlashcards = useCallback(
    async ({ cursor = null, append = false, preserveItems = false }: FetchOptions = {}) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setListState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        ...(append || preserveItems ? {} : { items: [] }),
      }));

      try {
        const data: FlashcardListResponse = await flashcardsApiClient.list(filters, cursor, FLASHCARDS_PAGE_LIMIT);

        setListState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          items: append ? [...prev.items, ...data.data] : data.data,
          nextCursor: data.page.next_cursor,
          hasMore: data.page.has_more,
          aggregates: data.aggregates ?? prev.aggregates,
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const apiError = error instanceof ApiClientError ? error.toApiErrorResponse() : createNetworkError(error);

        setListState((prev) => ({
          ...prev,
          loading: false,
          error: apiError,
        }));

        toast.error("Failed to fetch flashcards", {
          description: apiError.error.message,
        });
      }
    },
    [filters]
  );

  const loadMore = useCallback(async () => {
    if (!listState.hasMore || listState.loading || !listState.nextCursor) {
      return;
    }
    await fetchFlashcards({ cursor: listState.nextCursor, append: true, preserveItems: true });
  }, [fetchFlashcards, listState.hasMore, listState.loading, listState.nextCursor]);

  const refresh = useCallback(async () => {
    await fetchFlashcards({ cursor: null, append: false, preserveItems: true });
  }, [fetchFlashcards]);

  const createFlashcard = useCallback(
    async (payload: CreateFlashcardCommand) => {
      try {
        const created = await flashcardsApiClient.create(payload);

        if (filters.sort === "-created_at") {
          setListState((prev) => ({
            ...prev,
            items: [created, ...prev.items],
            aggregates: incrementAggregates(prev.aggregates, created.origin),
          }));
        } else {
          await fetchFlashcards({ cursor: null, append: false, preserveItems: false });
        }

        toast.success("Flashcard created");
      } catch (error) {
        const apiError = error instanceof ApiClientError ? error.toApiErrorResponse() : createNetworkError(error);

        toast.error("Failed to create flashcard", {
          description: apiError.error.message,
        });

        throw apiError;
      }
    },
    [fetchFlashcards, filters.sort]
  );

  const updateFlashcard = useCallback(async (id: string, payload: UpdateFlashcardCommand) => {
    try {
      const updatedCard = await flashcardsApiClient.update(id, payload);

      setListState((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === id ? updatedCard : item)),
      }));

      toast.success("Flashcard updated");
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error.toApiErrorResponse() : createNetworkError(error);

      toast.error("Failed to update flashcard", {
        description: apiError.error.message,
      });

      throw apiError;
    }
  }, []);

  const deleteFlashcard = useCallback(
    async (id: string) => {
      try {
        await flashcardsApiClient.deleteFlashcard(id);

        setListState((prev) => {
          const target = prev.items.find((item) => item.id === id);
          const updatedItems = filters.includeDeleted
            ? prev.items.map((item) => (item.id === id ? { ...item, deleted_at: new Date().toISOString() } : item))
            : prev.items.filter((item) => item.id !== id);

          return {
            ...prev,
            items: updatedItems,
            aggregates: filters.includeDeleted ? prev.aggregates : decrementAggregates(prev.aggregates, target?.origin),
          };
        });

        toast.success("Flashcard deleted");
      } catch (error) {
        const apiError = error instanceof ApiClientError ? error.toApiErrorResponse() : createNetworkError(error);

        toast.error("Failed to delete flashcard", {
          description: apiError.error.message,
        });

        throw apiError;
      }
    },
    [filters.includeDeleted]
  );

  const restoreFlashcard = useCallback(
    async (id: string) => {
      try {
        const restored = await flashcardsApiClient.restore(id);

        let listUpdated = false;
        setListState((prev) => {
          const hasCard = prev.items.some((item) => item.id === id);
          if (!hasCard) {
            return prev;
          }

          listUpdated = true;
          const shouldAdjustAggregates = !filters.includeDeleted;

          return {
            ...prev,
            items: prev.items.map((item) => (item.id === id ? restored : item)),
            aggregates: shouldAdjustAggregates
              ? incrementAggregates(prev.aggregates, restored.origin)
              : prev.aggregates,
          };
        });

        if (!listUpdated) {
          await fetchFlashcards({ cursor: null, append: false, preserveItems: true });
        }

        toast.success("Flashcard restored");
      } catch (error) {
        const apiError = error instanceof ApiClientError ? error.toApiErrorResponse() : createNetworkError(error);

        toast.error("Failed to restore flashcard", {
          description: apiError.error.message,
        });

        throw apiError;
      }
    },
    [fetchFlashcards, filters.includeDeleted]
  );

  useEffect(() => {
    listStateRef.current = listState;
  }, [listState]);

  useEffect(() => {
    fetchFlashcards();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchFlashcards]);

  const state = useMemo<FlashcardsViewState>(
    () => ({
      ...listState,
      filters,
    }),
    [listState, filters]
  );

  return {
    state,
    setFilters,
    loadMore,
    refresh,
    createFlashcard,
    updateFlashcard,
    deleteFlashcard,
    restoreFlashcard,
  };
}

function cloneFilters(filters: FlashcardsFilters): FlashcardsFilters {
  return {
    ...filters,
    tagIds: Array.isArray(filters.tagIds) ? [...filters.tagIds] : [],
  };
}

function createNetworkError(error: unknown): ApiErrorResponse {
  return {
    error: {
      code: "network_error",
      message: error instanceof Error ? error.message : "An unknown error occurred",
    },
  };
}

function incrementAggregates(aggregates: FlashcardAggregatesDTO | undefined, origin?: FlashcardDTO["origin"]) {
  if (!aggregates || !origin) {
    return aggregates;
  }

  const byOrigin = { ...(aggregates.by_origin ?? {}) };
  byOrigin[origin] = (byOrigin[origin] ?? 0) + 1;

  return {
    ...aggregates,
    total: aggregates.total + 1,
    by_origin: byOrigin,
  };
}

function decrementAggregates(
  aggregates: FlashcardAggregatesDTO | undefined,
  origin: FlashcardDTO["origin"] | undefined
): FlashcardAggregatesDTO | undefined {
  if (!aggregates || !origin) {
    return aggregates;
  }

  const byOrigin = { ...(aggregates.by_origin ?? {}) };
  byOrigin[origin] = Math.max(0, (byOrigin[origin] ?? 1) - 1);

  return {
    ...aggregates,
    total: Math.max(0, aggregates.total - 1),
    by_origin: byOrigin,
  };
}
