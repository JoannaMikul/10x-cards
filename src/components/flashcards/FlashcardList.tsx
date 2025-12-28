import { useMemo } from "react";
import type { ApiErrorResponse, CategoryDTO, FlashcardDTO, SourceDTO } from "../../types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Skeleton } from "../ui/skeleton";
import { FlashcardItem } from "./FlashcardItem";
import { LoadMoreButton } from "./LoadMoreButton";

interface FlashcardListProps {
  items: FlashcardDTO[];
  loading: boolean;
  error: ApiErrorResponse | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onEdit: (card: FlashcardDTO) => void;
  onDelete: (card: FlashcardDTO) => void;
  onRestore: (card: FlashcardDTO) => void;
  onToggleSelectForReview: (cardId: string) => void;
  selectedForReview: string[];
  onStartReviewFromCard?: (card: FlashcardDTO) => void;
  categories?: CategoryDTO[];
  sources?: SourceDTO[];
  canRestore?: boolean;
}

export function FlashcardList({
  items,
  loading,
  error,
  hasMore,
  onLoadMore,
  onEdit,
  onDelete,
  onRestore,
  onToggleSelectForReview,
  selectedForReview,
  onStartReviewFromCard,
  categories = [],
  sources = [],
  canRestore = false,
}: FlashcardListProps) {
  const selectedSet = useMemo(() => new Set(selectedForReview), [selectedForReview]);

  const categoriesById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const sourcesById = useMemo(() => {
    return new Map(sources.map((source) => [source.id, source]));
  }, [sources]);

  const showSkeletons = loading && items.length === 0;
  const showEmptyState = !loading && items.length === 0 && !error;

  return (
    <section aria-label="Flashcard list" aria-live="polite" className="space-y-4 pr-6 pl-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Cannot load flashcards</AlertTitle>
          <AlertDescription>{error.error.message}</AlertDescription>
        </Alert>
      )}

      {showSkeletons && <FlashcardListSkeleton />}

      {showEmptyState && (
        <div className="border-border/60 bg-muted/30 rounded-xl border p-8 text-center">
          <p className="text-lg font-semibold text-foreground">No flashcards found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Try adjusting your filters or search query to find different cards.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((card) => {
          const category = card.category_id ? categoriesById.get(card.category_id) : undefined;
          const source = card.content_source_id ? sourcesById.get(card.content_source_id) : undefined;
          return (
            <FlashcardItem
              key={card.id}
              card={card}
              categoryName={category?.name}
              sourceName={source?.name}
              sourceKind={source?.kind}
              selected={selectedSet.has(card.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onRestore={onRestore}
              onToggleSelectForReview={onToggleSelectForReview}
              onStartReviewFromCard={onStartReviewFromCard}
              canRestore={canRestore}
            />
          );
        })}
      </div>

      <LoadMoreButton loading={loading} hasMore={hasMore} onClick={onLoadMore} />
    </section>
  );
}

function FlashcardListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, index) => (
        <Skeleton key={index} className="h-40 w-full rounded-xl border" />
      ))}
    </div>
  );
}
