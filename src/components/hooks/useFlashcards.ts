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
  TagDTO,
  UpdateFlashcardCommand,
} from "../../types";
import { createDefaultFlashcardsFilters } from "../flashcards/constants";

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
const LOGIN_PATH = "/auth/login";
const ALLOWED_ORIGINS = new Set(["ai-full", "ai-edited", "manual"] as const);
const NETWORK_ERROR_MESSAGE = "A network error occurred.";

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
        const params = buildFlashcardsQuery(filters, cursor);
        const response = await fetch(`/api/flashcards?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            redirectToLogin();
            return;
          }

          const errorData = await parseApiError(response);
          setListState((prev) => ({
            ...prev,
            loading: false,
            error: errorData,
          }));
          toast.error("Failed to fetch flashcards", {
            description: errorData.error.message,
          });
          return;
        }

        const data: FlashcardListResponse = await response.json();

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

        const fallbackError: ApiErrorResponse = {
          error: {
            code: "network_error",
            message: error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE,
          },
        };

        setListState((prev) => ({
          ...prev,
          loading: false,
          error: fallbackError,
        }));

        toast.error("Network error", {
          description: fallbackError.error.message,
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
        const response = await fetch("/api/flashcards", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          if (response.status === 401) {
            redirectToLogin();
            return;
          }

          const errorData = await parseApiError(response);
          toast.error("Failed to create flashcard", {
            description: errorData.error.message,
          });
          throw errorData;
        }

        const created: FlashcardDTO = await response.json();

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
        if (isApiError(error)) {
          throw error;
        }
        const fallbackError: ApiErrorResponse = {
          error: {
            code: "network_error",
            message: error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE,
          },
        };
        toast.error("Failed to create flashcard", {
          description: fallbackError.error.message,
        });
        throw fallbackError;
      }
    },
    [fetchFlashcards, filters.sort]
  );

  const updateFlashcard = useCallback(
    async (id: string, payload: UpdateFlashcardCommand) => {
      const { tag_ids, ...rest } = payload;
      const basePayload = sanitizeBaseUpdatePayload(rest);
      const shouldPatch = Object.keys(basePayload).length > 0;

      try {
        let updatedCard: FlashcardDTO | null = null;

        if (shouldPatch) {
          const response = await fetch(`/api/flashcards/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(basePayload),
          });

          if (!response.ok) {
            if (response.status === 401) {
              redirectToLogin();
              return;
            }

            const errorData = await parseApiError(response);
            toast.error("Failed to update flashcard", {
              description: errorData.error.message,
            });
            throw errorData;
          }

          updatedCard = await response.json();
        } else {
          const snapshot = listStateRef.current.items.find((item) => item.id === id);
          updatedCard = snapshot ? { ...snapshot } : null;
        }

        if (tag_ids !== undefined) {
          const response = await fetch(`/api/flashcards/${id}/tags`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ tag_ids }),
          });

          if (!response.ok) {
            if (response.status === 401) {
              redirectToLogin();
              return;
            }

            const errorData = await parseApiError(response);
            toast.error("Failed to update flashcard tags", {
              description: errorData.error.message,
            });
            throw errorData;
          }

          const updatedTags: TagDTO[] = await response.json();
          if (updatedCard) {
            updatedCard = { ...updatedCard, tags: updatedTags };
          }
        }

        if (!updatedCard) {
          await fetchFlashcards({ cursor: null, append: false, preserveItems: true });
          toast.success("Flashcard updated");
          return;
        }

        const nextCard = updatedCard;
        setListState((prev) => ({
          ...prev,
          items: prev.items.map((item) => (item.id === id ? nextCard : item)),
        }));

        toast.success("Flashcard updated");
      } catch (error) {
        if (isApiError(error)) {
          throw error;
        }
        const fallbackError: ApiErrorResponse = {
          error: {
            code: "network_error",
            message: error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE,
          },
        };
        toast.error("Failed to update flashcard", {
          description: fallbackError.error.message,
        });
        throw fallbackError;
      }
    },
    [fetchFlashcards]
  );

  const deleteFlashcard = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/flashcards/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          if (response.status === 401) {
            redirectToLogin();
            return;
          }

          const errorData = await parseApiError(response);
          toast.error("Failed to delete flashcard", {
            description: errorData.error.message,
          });
          throw errorData;
        }

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
        if (isApiError(error)) {
          throw error;
        }
        const fallbackError: ApiErrorResponse = {
          error: {
            code: "network_error",
            message: error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE,
          },
        };
        toast.error("Failed to delete flashcard", {
          description: fallbackError.error.message,
        });
        throw fallbackError;
      }
    },
    [filters.includeDeleted]
  );

  const restoreFlashcard = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/flashcards/${id}/restore`, {
          method: "POST",
        });

        if (!response.ok) {
          if (response.status === 401) {
            redirectToLogin();
            return;
          }

          const errorData = await parseApiError(response);
          toast.error("Failed to restore flashcard", {
            description: errorData.error.message,
          });
          throw errorData;
        }

        const restored: FlashcardDTO = await response.json();

        setListState((prev) => {
          const wasRemovedFromList = !filters.includeDeleted;
          return {
            ...prev,
            items: prev.items.map((item) => (item.id === id ? restored : item)),
            aggregates: wasRemovedFromList ? incrementAggregates(prev.aggregates, restored.origin) : prev.aggregates,
          };
        });

        toast.success("Flashcard restored");
      } catch (error) {
        if (isApiError(error)) {
          throw error;
        }
        const fallbackError: ApiErrorResponse = {
          error: {
            code: "network_error",
            message: error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE,
          },
        };
        toast.error("Failed to restore flashcard", {
          description: fallbackError.error.message,
        });
        throw fallbackError;
      }
    },
    [filters.includeDeleted]
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

function buildFlashcardsQuery(filters: FlashcardsFilters, cursor: string | null) {
  const params = new URLSearchParams();
  params.set("limit", String(FLASHCARDS_PAGE_LIMIT));

  if (cursor) {
    params.set("cursor", cursor);
  }

  const trimmedSearch = filters.search.trim().slice(0, 200);
  if (trimmedSearch.length > 0) {
    params.set("search", trimmedSearch);
  }

  if (typeof filters.categoryId === "number" && filters.categoryId > 0) {
    params.set("category_id", String(filters.categoryId));
  }

  if (typeof filters.contentSourceId === "number" && filters.contentSourceId > 0) {
    params.set("content_source_id", String(filters.contentSourceId));
  }

  filters.tagIds
    .filter((tagId) => Number.isInteger(tagId) && tagId > 0)
    .slice(0, 50)
    .forEach((tagId) => params.append("tag_ids[]", String(tagId)));

  if (filters.origin && ALLOWED_ORIGINS.has(filters.origin)) {
    params.set("origin", filters.origin);
  }

  if (filters.sort) {
    params.set("sort", filters.sort);
  } else {
    params.set("sort", "-created_at");
  }

  if (filters.includeDeleted) {
    params.set("include_deleted", "true");
  }

  return params;
}

async function parseApiError(response: Response): Promise<ApiErrorResponse> {
  try {
    return await response.json();
  } catch {
    return {
      error: {
        code: "unknown_error",
        message: `Request failed with status ${response.status}.`,
      },
    };
  }
}

function redirectToLogin(): void {
  if (typeof window === "undefined") {
    return;
  }

  const currentPath = window.location.pathname + window.location.search;
  const searchParams = new URLSearchParams();
  searchParams.set("returnTo", currentPath || "/flashcards");

  window.location.href = `${LOGIN_PATH}?${searchParams.toString()}`;
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

function isApiError(error: unknown): error is ApiErrorResponse {
  return Boolean(error && typeof error === "object" && "error" in error);
}

type BaseUpdatePayload = Omit<UpdateFlashcardCommand, "tag_ids">;

function sanitizeBaseUpdatePayload(payload: BaseUpdatePayload): Partial<BaseUpdatePayload> {
  const next: Partial<Record<keyof BaseUpdatePayload, BaseUpdatePayload[keyof BaseUpdatePayload]>> = {};
  (Object.keys(payload) as (keyof BaseUpdatePayload)[]).forEach((key) => {
    const value = payload[key];
    if (value === undefined) {
      return;
    }
    next[key] = value;
  });
  return next as Partial<BaseUpdatePayload>;
}
