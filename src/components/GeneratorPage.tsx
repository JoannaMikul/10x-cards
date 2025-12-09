import React from "react";
import { useGeneration } from "./hooks/useGeneration";
import { GeneratorForm } from "./GeneratorForm";
import { GenerationStatusPanel } from "./GenerationStatusPanel";
import type { CreateGenerationCommand } from "../types";

export function GeneratorPage() {
  const { generation, candidatesSummary, isLoading, isPolling, error, startGeneration, cancelGeneration, clearError } =
    useGeneration();

  const handleFormSubmit = async (data: CreateGenerationCommand) => {
    clearError();
    await startGeneration(data);
  };

  const handleCancel = async () => {
    if (generation?.id) {
      await cancelGeneration();
    }
  };

  const handleNavigateToCandidates = () => {
    if (generation?.id) {
      window.location.href = `/candidates?generation_id=${generation.id}`;
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Generator AI</h1>
        <p className="text-muted-foreground">
          Transform your texts into high-quality flashcards using artificial intelligence
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <GeneratorForm
            onSubmit={handleFormSubmit}
            isLoading={isLoading}
            currentGenerationStatus={generation?.status}
          />
        </div>

        <div className="space-y-6">
          <GenerationStatusPanel
            generation={generation}
            candidatesSummary={candidatesSummary}
            isPolling={isPolling}
            onCancel={handleCancel}
            onNavigateToCandidates={handleNavigateToCandidates}
            error={error}
            onClearError={clearError}
          />
        </div>
      </div>
    </div>
  );
}
