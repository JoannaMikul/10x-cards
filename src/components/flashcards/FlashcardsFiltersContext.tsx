import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { FlashcardsFilters } from "../../types";
import { DEFAULT_FLASHCARDS_FILTERS, createDefaultFlashcardsFilters } from "./constants";
import { useUrlQueryState } from "../hooks/useUrlQueryState";

type FiltersUpdater = (prev: FlashcardsFilters) => FlashcardsFilters;

interface FlashcardsFiltersContextValue {
  filters: FlashcardsFilters;
  setFilters: (updater: FiltersUpdater) => void;
  resetFilters: () => void;
}

const FlashcardsFiltersContext = createContext<FlashcardsFiltersContextValue | null>(null);

interface FlashcardsFiltersProviderProps {
  children: ReactNode;
}

type FlashcardOrigin = NonNullable<FlashcardsFilters["origin"]>;

const SORT_VALUES = new Set<FlashcardsFilters["sort"]>(["created_at", "-created_at", "updated_at", "next_review_at"]);
const ORIGIN_VALUES = new Set<FlashcardOrigin>(["ai-full", "ai-edited", "manual"]);

export function FlashcardsFiltersProvider({ children }: FlashcardsFiltersProviderProps) {
  const parseFilters = useCallback((params: URLSearchParams): FlashcardsFilters => {
    return {
      search: (params.get("q") ?? "").slice(0, 200),
      categoryId: parsePositiveInt(params.get("categoryId")),
      contentSourceId: parsePositiveInt(params.get("sourceId")),
      tagIds: parseTagIds(params.get("tagIds")),
      origin: parseOrigin(params.get("origin")),
      includeDeleted: params.get("showDeleted") === "true",
      sort: parseSort(params.get("sort")),
    };
  }, []);

  const serializeFilters = useCallback((filters: FlashcardsFilters): URLSearchParams => {
    const params = new URLSearchParams();
    const trimmedSearch = filters.search.trim().slice(0, 200);
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
      params.set(
        "tagIds",
        filters.tagIds
          .filter((tagId) => Number.isInteger(tagId) && tagId > 0)
          .slice(0, 50)
          .join(",")
      );
    }

    if (isValidOrigin(filters.origin)) {
      params.set("origin", filters.origin);
    }

    if (filters.includeDeleted) {
      params.set("showDeleted", "true");
    }

    if (filters.sort && filters.sort !== DEFAULT_FLASHCARDS_FILTERS.sort) {
      params.set("sort", filters.sort);
    }

    return params;
  }, []);

  const [filters, updateFilters] = useUrlQueryState<FlashcardsFilters>({
    initialValue: createDefaultFlashcardsFilters(),
    parse: parseFilters,
    serialize: serializeFilters,
  });

  const setFilters = useCallback(
    (updater: FiltersUpdater) => {
      updateFilters((prev) => updater(prev));
    },
    [updateFilters]
  );

  const resetFilters = useCallback(() => {
    updateFilters(() => createDefaultFlashcardsFilters());
  }, [updateFilters]);

  const value = useMemo<FlashcardsFiltersContextValue>(
    () => ({
      filters,
      setFilters,
      resetFilters,
    }),
    [filters, resetFilters, setFilters]
  );

  return <FlashcardsFiltersContext.Provider value={value}>{children}</FlashcardsFiltersContext.Provider>;
}

export function useFlashcardsFilters(): FlashcardsFiltersContextValue {
  const context = useContext(FlashcardsFiltersContext);
  if (!context) {
    throw new Error("useFlashcardsFilters must be used within FlashcardsFiltersProvider");
  }
  return context;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function parseTagIds(value: string | null): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((tagId) => Number.isInteger(tagId) && tagId > 0)
    .slice(0, 50);
}

function parseOrigin(value: string | null): FlashcardsFilters["origin"] {
  if (!value) {
    return undefined;
  }

  return isValidOrigin(value as FlashcardsFilters["origin"]) ? (value as FlashcardsFilters["origin"]) : undefined;
}

function parseSort(value: string | null): FlashcardsFilters["sort"] {
  if (!value) {
    return DEFAULT_FLASHCARDS_FILTERS.sort;
  }

  return SORT_VALUES.has(value as FlashcardsFilters["sort"])
    ? (value as FlashcardsFilters["sort"])
    : DEFAULT_FLASHCARDS_FILTERS.sort;
}

function isValidOrigin(value: FlashcardsFilters["origin"]): value is FlashcardOrigin {
  if (typeof value !== "string") {
    return false;
  }

  return ORIGIN_VALUES.has(value as FlashcardOrigin);
}
