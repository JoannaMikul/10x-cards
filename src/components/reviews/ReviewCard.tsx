import React from "react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import type { ReviewCardViewModel } from "../../types";

interface ReviewCardProps {
  card: ReviewCardViewModel | null;
  isAnswerRevealed: boolean;
  onRevealAnswer: () => void;
}

export function ReviewCard({ card, isAnswerRevealed, onRevealAnswer }: ReviewCardProps) {
  if (!card) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No card available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-100 shadow-md">
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2 text-black">Question</h3>
            <p className="font-light text-black leading-relaxed whitespace-pre-wrap">{card.card.front}</p>
          </div>

          {!isAnswerRevealed && (
            <div className="flex justify-center">
              <Button onClick={onRevealAnswer} size="lg">
                Show Answer
              </Button>
            </div>
          )}

          {isAnswerRevealed && (
            <div>
              <h3 className="font-semibold mb-2 text-black">Answer</h3>
              <p className="font-light text-black leading-relaxed whitespace-pre-wrap">{card.card.back}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
