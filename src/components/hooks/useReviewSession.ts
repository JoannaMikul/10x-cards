import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  ApiErrorResponse,
  CreateReviewSessionCommand,
  Grade0to5,
  ReviewCardViewModel,
  ReviewOutcomeUi,
  ReviewSessionConfig,
  ReviewSessionEntryViewModel,
  ReviewSessionState,
} from "../../types";

interface UseReviewSessionOptions {
  config: ReviewSessionConfig;
}

interface UseReviewSessionReturn {
  sessionState: ReviewSessionState;

  currentCard: ReviewCardViewModel | null;
  isAnswerRevealed: boolean;
  progress: { currentIndex: number; total: number };

  revealAnswer: () => void;
  recordOutcome: (outcome: ReviewOutcomeUi, grade: Grade0to5) => void;
  goNext: () => void;
  submitSession: () => Promise<void>;

  canSubmit: boolean;
  canGoNext: boolean;
}

const MAX_CARDS_PER_SESSION = 100;

export function useReviewSession(options: UseReviewSessionOptions): UseReviewSessionReturn {
  const { config } = options;

  const answerRevealedAtRef = useRef<number | null>(null);
  const [isAnswerRevealedState, setIsAnswerRevealedState] = useState(false);

  const [sessionState, setSessionState] = useState<ReviewSessionState>(() => {
    const sessionId = crypto.randomUUID();
    const cards: ReviewCardViewModel[] = config.cards.slice(0, MAX_CARDS_PER_SESSION).map((card, index) => ({
      card,
      index,
    }));

    return {
      sessionId,
      cards,
      currentIndex: 0,
      startedAt: new Date().toISOString(),
      entries: [],
      status: "in-progress",
    };
  });

  const currentCard =
    sessionState.currentIndex < sessionState.cards.length ? sessionState.cards[sessionState.currentIndex] : null;

  const isAnswerRevealed = sessionState.status === "in-progress" && isAnswerRevealedState;

  const progress = {
    currentIndex: sessionState.entries.length,
    total: sessionState.cards.length,
  };

  const canSubmit = sessionState.entries.length > 0 && sessionState.status !== "submitting";
  const canGoNext = sessionState.status === "in-progress" && isAnswerRevealed && currentCard !== null;

  const revealAnswer = useCallback(() => {
    if (sessionState.status !== "in-progress" || !currentCard) {
      return;
    }

    answerRevealedAtRef.current = Date.now();
    setIsAnswerRevealedState(true);
  }, [sessionState.status, currentCard]);

  const goNext = useCallback(() => {
    if (!canGoNext) {
      return;
    }

    setSessionState((prev) => {
      const nextIndex = prev.currentIndex + 1;
      const isComplete = nextIndex >= prev.cards.length;

      return {
        ...prev,
        currentIndex: nextIndex,
        completedAt: isComplete ? new Date().toISOString() : prev.completedAt,
        status: isComplete ? "completed" : prev.status,
      };
    });

    answerRevealedAtRef.current = null;
    setIsAnswerRevealedState(false);
  }, [canGoNext]);

  const recordOutcome = useCallback(
    (outcome: ReviewOutcomeUi, grade: Grade0to5) => {
      if (sessionState.status !== "in-progress" || !currentCard || !isAnswerRevealed) {
        return;
      }

      const responseTimeMs = answerRevealedAtRef.current ? Date.now() - answerRevealedAtRef.current : undefined;

      const entry: ReviewSessionEntryViewModel = {
        cardId: currentCard.card.id,
        outcome,
        grade,
        responseTimeMs,
      };

      setSessionState((prev) => {
        const newEntries = [...prev.entries, entry];
        const nextIndex = prev.currentIndex + 1;
        const isComplete = nextIndex >= prev.cards.length;

        return {
          ...prev,
          entries: newEntries,
          currentIndex: nextIndex,
          completedAt: isComplete ? new Date().toISOString() : prev.completedAt,
          status: isComplete ? "completed" : prev.status,
        };
      });

      answerRevealedAtRef.current = null;
      setIsAnswerRevealedState(false);
    },
    [sessionState.status, currentCard, isAnswerRevealed]
  );

  const submitSession = useCallback(
    async (retryCount = 0) => {
      if (!canSubmit) {
        return;
      }

      setSessionState((prev) => ({ ...prev, status: "submitting" }));

      try {
        const command: CreateReviewSessionCommand = {
          session_id: sessionState.sessionId,
          started_at: sessionState.startedAt,
          completed_at: sessionState.completedAt || new Date().toISOString(),
          reviews: sessionState.entries.map((entry) => ({
            card_id: entry.cardId,
            outcome: entry.outcome,
            response_time_ms: entry.responseTimeMs,
            prev_interval_days: undefined,
            next_interval_days: undefined,
            was_learning_step: entry.wasLearningStep,
            payload: entry.payload,
          })),
        };

        const response = await fetch("/api/review-sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(command),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as ApiErrorResponse;
          throw new Error(errorData.error.message);
        }

        const result = (await response.json()) as { logged: number };

        setSessionState((prev) => ({ ...prev, status: "completed" }));

        toast.success(`Session saved successfully (${result.logged} cards)`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save session";

        if (retryCount < 2 && (message.includes("network") || message.includes("fetch"))) {
          setTimeout(() => submitSession(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }

        setSessionState((prev) => ({
          ...prev,
          status: "error",
          error: { error: { code: "submit_failed", message } },
        }));
        toast.error(message);
      }
    },
    [canSubmit, sessionState.sessionId, sessionState.startedAt, sessionState.completedAt, sessionState.entries]
  );

  return {
    sessionState,
    currentCard,
    isAnswerRevealed,
    progress,
    revealAnswer,
    recordOutcome,
    goNext,
    submitSession,
    canSubmit,
    canGoNext,
  };
}
