import React from "react";
import { useReviewSession } from "../hooks/useReviewSession";
import { ReviewPlayer } from "./ReviewPlayer";
import { Button } from "../ui/button";
import type { ReviewSessionConfig } from "../../types";

interface ReviewsPageProps {
  initialConfig?: ReviewSessionConfig;
  error?: string;
}

export default function ReviewsPage({ initialConfig, error }: ReviewsPageProps) {
  const hasValidConfig = initialConfig && initialConfig.cards.length > 0;

  const defaultConfig: ReviewSessionConfig = { cards: [] };
  const config = hasValidConfig ? initialConfig : defaultConfig;

  const { sessionState, isAnswerRevealed, progress, revealAnswer, recordOutcome, goNext, submitSession, canGoNext } =
    useReviewSession({ config });

  if (error) {
    return (
      <div className="border-border/60 bg-destructive/10 rounded-xl border p-8 text-center">
        <div className="text-destructive mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <p className="text-lg font-semibold text-foreground mb-2">Failed to load review session</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <div className="space-x-4">
          <Button asChild>
            <a href="/flashcards">Back to flashcards</a>
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!hasValidConfig) {
    return (
      <div className="border-border/60 bg-muted/30 rounded-xl border p-8 text-center">
        <p className="text-lg font-semibold text-foreground">No cards available for review</p>
        <p className="text-sm text-muted-foreground mt-2">
          You don&apos;t have any flashcards yet, or none are due for review. Create some flashcards first to start
          reviewing.
        </p>
        <div className="mt-4 space-x-4">
          <Button asChild>
            <a href="/flashcards">Go to flashcards</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/generator">Generate cards</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ReviewPlayer
      cards={sessionState.cards}
      sessionState={sessionState}
      isAnswerRevealed={isAnswerRevealed}
      progress={progress}
      onRevealAnswer={revealAnswer}
      onRecordOutcome={recordOutcome}
      onGoNext={goNext}
      onSubmitSession={submitSession}
      canGoNext={canGoNext}
    />
  );
}
