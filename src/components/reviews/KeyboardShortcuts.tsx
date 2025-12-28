import React from "react";
import { useReviewKeyboardShortcuts } from "../hooks/useReviewKeyboardShortcuts";
import type { ReviewOutcomeUi, Grade0to5 } from "../../types";

interface KeyboardShortcutsProps {
  onRevealAnswer: () => void;
  onSelectOutcome: (outcome: ReviewOutcomeUi, grade: Grade0to5) => void;
  onGoNext: () => void;
  canGoNext: boolean;
  enabled: boolean;
}

export function KeyboardShortcuts({
  onRevealAnswer,
  onSelectOutcome,
  onGoNext,
  canGoNext,
  enabled,
}: KeyboardShortcutsProps) {
  useReviewKeyboardShortcuts({
    enabled,
    onRevealAnswer,
    onSelectOutcome,
    onGoNext,
    canGoNext,
  });

  return (
    <div className="text-center text-sm text-muted-foreground space-y-2">
      <p className="font-medium text-left">Keyboard Shortcuts: </p>
      <div className="grid grid-cols-[auto_1fr] gap-4 text-xs text-left items-center">
        <div>
          <kbd
            className="inline-block px-2 py-1 bg-muted rounded text-xs font-mono min-w-[60px] text-center"
            aria-keyshortcuts="Space"
          >
            Space
          </kbd>
        </div>
        <div>
          <span>Reveal answer</span>
        </div>

        <div>
          <kbd
            className="inline-block px-2 py-1 bg-muted rounded text-xs font-mono min-w-[60px] text-center"
            aria-keyshortcuts="Enter ArrowRight"
          >
            Enter/→
          </kbd>
        </div>
        <div>
          <span>Next card</span>
        </div>

        <div>
          <kbd
            className="inline-block px-2 py-1 bg-muted rounded text-xs font-mono min-w-[60px] text-center"
            aria-keyshortcuts="1 2 3 4 5"
          >
            1-5
          </kbd>
        </div>
        <div>
          <span>Select outcome</span>
        </div>

        <div className="col-span-2">
          <div className="flex flex-row gap-4 text-xs">
            <span>
              <kbd className="px-2 py-0.5 bg-red-600 rounded text-xs font-mono text-white">1</kbd> Again
            </span>
            <span>
              <kbd className="px-2 py-0.5 bg-amber-700 rounded text-xs font-mono text-white">2</kbd> Fail
            </span>
            <span>
              <kbd className="px-2 py-0.5 bg-amber-600 rounded text-xs font-mono text-white">3</kbd> Hard
            </span>
            <span>
              <kbd className="px-2 py-0.5 bg-emerald-600 rounded text-xs font-mono text-white">4</kbd> Good
            </span>
            <span>
              <kbd className="px-2 py-0.5 bg-blue-600 rounded text-xs font-mono text-white">5</kbd> Easy
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
