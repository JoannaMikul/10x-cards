import { useEffect } from "react";
import type { ReviewOutcomeUi, Grade0to5 } from "../../types";

interface UseReviewKeyboardShortcutsOptions {
  enabled: boolean;
  onRevealAnswer: () => void;
  onSelectOutcome: (outcome: ReviewOutcomeUi, grade: Grade0to5) => void;
  onGoNext: () => void;
  canGoNext: boolean;
}

const outcomeMap: Record<string, { outcome: ReviewOutcomeUi; grade: Grade0to5 }> = {
  Digit1: { outcome: "again", grade: 0 },
  Digit2: { outcome: "fail", grade: 1 },
  Digit3: { outcome: "hard", grade: 2 },
  Digit4: { outcome: "good", grade: 3 },
  Digit5: { outcome: "easy", grade: 4 },
};

export function useReviewKeyboardShortcuts(options: UseReviewKeyboardShortcutsOptions): void {
  const { enabled, onRevealAnswer, onSelectOutcome, onGoNext, canGoNext } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }

      const shouldPreventDefault = [
        "Space",
        "Digit1",
        "Digit2",
        "Digit3",
        "Digit4",
        "Digit5",
        "Enter",
        "ArrowRight",
      ].includes(event.code);

      if (shouldPreventDefault) {
        event.preventDefault();
      }

      switch (event.code) {
        case "Space":
          onRevealAnswer();
          break;

        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5": {
          const mapping = outcomeMap[event.code];
          if (mapping) {
            onSelectOutcome(mapping.outcome, mapping.grade);
          }
          break;
        }

        case "Enter":
        case "ArrowRight":
          if (canGoNext) {
            onGoNext();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onRevealAnswer, onSelectOutcome, onGoNext, canGoNext]);
}
