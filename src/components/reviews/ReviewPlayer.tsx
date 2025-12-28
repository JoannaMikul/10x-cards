import React from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { ProgressBar } from "./ProgressBar";
import { ReviewCard } from "./ReviewCard";
import { OutcomeButtons } from "./OutcomeButtons";
import { StatsSnippet } from "./StatsSnippet";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import type { ReviewCardViewModel, ReviewSessionState, ReviewOutcomeUi, Grade0to5 } from "../../types";

interface ReviewPlayerProps {
  cards: ReviewCardViewModel[];
  sessionState: ReviewSessionState;
  isAnswerRevealed: boolean;
  progress: { currentIndex: number; total: number };
  onRevealAnswer: () => void;
  onRecordOutcome: (outcome: ReviewOutcomeUi, grade: Grade0to5) => void;
  onGoNext: () => void;
  onSubmitSession: () => Promise<void>;
  canGoNext: boolean;
}

export function ReviewPlayer({
  cards,
  sessionState,
  isAnswerRevealed,
  progress,
  onRevealAnswer,
  onRecordOutcome,
  onGoNext,
  onSubmitSession,
  canGoNext,
}: ReviewPlayerProps) {
  const currentCard = sessionState.currentIndex < cards.length ? cards[sessionState.currentIndex] : null;
  const canSubmit = sessionState.entries.length > 0 && sessionState.status !== "submitting";

  const handleSubmitSession = async () => {
    try {
      await onSubmitSession();
    } catch {
      toast.error("Failed to submit session", {
        description: "Please try again later",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Review Session</h1>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <ProgressBar current={progress.currentIndex} total={progress.total} />
          <StatsSnippet cardId={currentCard?.card.id} />

          <ReviewCard card={currentCard} isAnswerRevealed={isAnswerRevealed} onRevealAnswer={onRevealAnswer} />

          {currentCard && isAnswerRevealed && <OutcomeButtons disabled={false} onSelect={onRecordOutcome} />}

          {sessionState.currentIndex >= cards.length && (
            <div className="text-center space-y-4">
              <p className="text-lg font-semibold">Session completed!</p>
              <div className="space-x-4">
                <Button onClick={() => (window.location.href = "/flashcards")} variant="outline" size="lg">
                  Back to Flashcards
                </Button>
                <Button
                  onClick={handleSubmitSession}
                  disabled={!canSubmit || sessionState.status === "submitting"}
                  size="lg"
                >
                  {sessionState.status === "submitting" ? "Saving..." : "Save Session"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="sticky top-6 h-fit border-l border-border pl-6">
          <KeyboardShortcuts
            onRevealAnswer={onRevealAnswer}
            onSelectOutcome={onRecordOutcome}
            onGoNext={onGoNext}
            canGoNext={canGoNext}
            enabled={sessionState.status === "in-progress"}
          />
        </div>
      </div>
    </div>
  );
}
