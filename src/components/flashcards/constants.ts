import type { FlashcardsFilters } from "../../types";

export const DEFAULT_FLASHCARDS_FILTERS: FlashcardsFilters = {
  search: "",
  categoryId: undefined,
  contentSourceId: undefined,
  tagIds: [],
  origin: undefined,
  includeDeleted: false,
  sort: "-created_at",
};

export function createDefaultFlashcardsFilters(): FlashcardsFilters {
  return {
    search: "",
    categoryId: undefined,
    contentSourceId: undefined,
    tagIds: [],
    origin: undefined,
    includeDeleted: false,
    sort: "-created_at",
  };
}
