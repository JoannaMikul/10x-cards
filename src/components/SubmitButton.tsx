import React from "react";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";

interface SubmitButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  hasActiveGeneration: boolean;
  label: string;
}

export function SubmitButton({ onClick, disabled, isLoading, hasActiveGeneration, label }: SubmitButtonProps) {
  return (
    <div className="flex flex-col space-y-2">
      <Button type="button" onClick={onClick} disabled={disabled} className="w-full" size="lg">
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {hasActiveGeneration ? "Generation in progress..." : label}
      </Button>

      {hasActiveGeneration && (
        <p className="text-sm text-muted-foreground text-center">
          Please wait for the current generation task to complete
        </p>
      )}
    </div>
  );
}
