import type {
  CreateFlashcardCommand,
  FlashcardDTO,
  FlashcardFormValues,
  FlashcardSelectionState,
  FlashcardsFilters,
  UpdateFlashcardCommand,
} from "../../types";

export function cloneFilters(filters: FlashcardsFilters): FlashcardsFilters {
  return {
    ...filters,
    tagIds: Array.isArray(filters.tagIds) ? [...filters.tagIds] : [],
  };
}

export function createEmptyFormValues(): FlashcardFormValues {
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

export function mapCardToFormValues(card: FlashcardDTO): FlashcardFormValues {
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

export function mapFormValuesToCreateCommand(values: FlashcardFormValues): CreateFlashcardCommand {
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

export function mapFormValuesToUpdateCommand(values: FlashcardFormValues): UpdateFlashcardCommand {
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

export function buildReviewsUrl(filters: FlashcardsFilters, selection: FlashcardSelectionState): string {
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
