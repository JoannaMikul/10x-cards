import React from "react";
import { Button } from "../ui/button";
import type { ReviewOutcomeUi, Grade0to5 } from "../../types";

interface OutcomeButtonsProps {
  disabled: boolean;
  onSelect: (outcome: ReviewOutcomeUi, grade: Grade0to5) => void;
}

interface OutcomeOption {
  outcome: ReviewOutcomeUi;
  grade: Grade0to5;
  label: string;
  color: string;
  hoverColor: string;
}

const OUTCOME_OPTIONS: OutcomeOption[] = [
  { outcome: "again", grade: 0, label: "Again (0)", color: "bg-red-600", hoverColor: "hover:bg-red-700" },
  { outcome: "fail", grade: 1, label: "Fail (1)", color: "bg-amber-800", hoverColor: "hover:bg-amber-700" },
  { outcome: "hard", grade: 2, label: "Hard (2)", color: "bg-amber-700", hoverColor: "hover:bg-amber-600" },
  { outcome: "good", grade: 3, label: "Good (3)", color: "bg-emerald-700", hoverColor: "hover:bg-emerald-700" },
  { outcome: "easy", grade: 4, label: "Easy (4)", color: "bg-blue-600", hoverColor: "hover:bg-blue-700" },
];

export function OutcomeButtons({ disabled, onSelect }: OutcomeButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {OUTCOME_OPTIONS.map(({ outcome, grade, label, color, hoverColor }) => (
        <Button
          key={outcome}
          onClick={() => onSelect(outcome, grade)}
          disabled={disabled}
          className={`${color} ${hoverColor} text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          size="sm"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
