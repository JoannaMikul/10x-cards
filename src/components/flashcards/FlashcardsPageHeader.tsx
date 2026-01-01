import type { FlashcardAggregatesDTO } from "../../types";

interface FlashcardsPageHeaderProps {
  aggregates?: FlashcardAggregatesDTO;
}

export function FlashcardsPageHeader({ aggregates }: FlashcardsPageHeaderProps) {
  return (
    <div className="space-y-2 text-center md:text-left p-6" data-testid="flashcards-header">
      <h1 className="text-3xl font-semibold text-foreground" data-testid="flashcards-title">
        Flashcards
      </h1>
      <p className="text-muted-foreground" data-testid="flashcards-subtitle">
        Manage your personal collection, refine filters, and start review sessions faster.
      </p>
      {aggregates && (
        <p className="text-sm text-muted-foreground" data-testid="flashcards-count">
          {aggregates.total.toLocaleString()} flashcards in your workspace
        </p>
      )}
    </div>
  );
}
