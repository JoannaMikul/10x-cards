import { useState, useEffect, useCallback, useRef } from "react";
import type { GenerationDTO, ApiErrorResponse, CandidatesSummary } from "../../types";

interface UseGenerationOptions {
  pollingInterval?: number;
}

interface UseGenerationReturn {
  generation: GenerationDTO | null;
  candidatesSummary: CandidatesSummary | null;
  isLoading: boolean;
  isPolling: boolean;
  error: ApiErrorResponse | null;
  startGeneration: (data: { model: string; sanitized_input_text: string; temperature?: number }) => Promise<void>;
  cancelGeneration: () => Promise<void>;
  clearError: () => void;
  resetGeneration: () => void;
  checkActiveGeneration: () => Promise<void>;
}

export function useGeneration(options: UseGenerationOptions = {}): UseGenerationReturn {
  const { pollingInterval = 5000 } = options;

  const [generation, setGeneration] = useState<GenerationDTO | null>(null);
  const [candidatesSummary, setCandidatesSummary] = useState<CandidatesSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const generationIdRef = useRef<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const pollGenerationStatus = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/generations/${id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response.json();
          throw new Error(errorData.error.message);
        }

        const data = (await response.json()) as { generation: GenerationDTO; candidates_summary: CandidatesSummary };
        const { generation: updatedGeneration, candidates_summary } = data;

        setGeneration(updatedGeneration);
        setCandidatesSummary(candidates_summary);

        // Stop polling if generation is completed, cancelled, or errored
        if (["succeeded", "cancelled", "failed"].includes(updatedGeneration.status)) {
          setIsPolling(false);

          // Clear stored generation ID when generation completes
          try {
            localStorage.removeItem("activeGenerationId");
          } catch (err) {
            console.warn("Failed to clear active generation ID from localStorage:", err);
          }

          // Auto-redirect to candidates page when generation succeeds
          if (updatedGeneration.status === "succeeded" && typeof window !== "undefined") {
            window.location.href = `/candidates?generation_id=${id}`;
          }

          return;
        }

        // Continue polling for active generations
        if (["pending", "running"].includes(updatedGeneration.status)) {
          pollingIntervalRef.current = setTimeout(() => pollGenerationStatus(id), pollingInterval);
        }
      } catch (err) {
        console.error("Error polling generation status:", err);
        setError({
          error: {
            code: "polling_error",
            message: err instanceof Error ? err.message : "Failed to poll generation status",
          },
        });
        setIsPolling(false);
      }
    },
    [pollingInterval]
  );

  const resetGeneration = useCallback(() => {
    // Stop any ongoing polling
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Reset all state
    setGeneration(null);
    setCandidatesSummary(null);
    setIsLoading(false);
    setIsPolling(false);
    setError(null);
    generationIdRef.current = null;

    // Clear stored generation ID
    try {
      localStorage.removeItem("activeGenerationId");
    } catch (err) {
      console.warn("Failed to clear active generation ID from localStorage:", err);
    }
  }, []);

  const checkActiveGeneration = useCallback(async () => {
    try {
      // First try to get from localStorage
      let activeGenerationId: string | null = null;
      try {
        activeGenerationId = localStorage.getItem("activeGenerationId");
      } catch (err) {
        console.warn("Failed to read from localStorage:", err);
      }

      // If we have a stored ID, try to check its status
      if (activeGenerationId) {
        try {
          const response = await fetch(`/api/generations/${activeGenerationId}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const data = (await response.json()) as {
              generation: GenerationDTO;
              candidates_summary: CandidatesSummary;
            };
            const { generation: updatedGeneration, candidates_summary } = data;

            // If generation is still active, resume polling
            if (["pending", "running"].includes(updatedGeneration.status)) {
              setGeneration(updatedGeneration);
              setCandidatesSummary(candidates_summary);
              generationIdRef.current = activeGenerationId;
              setIsPolling(true);
              pollingIntervalRef.current = setTimeout(() => {
                if (activeGenerationId) {
                  pollGenerationStatus(activeGenerationId);
                }
              }, pollingInterval);
              return;
            } else {
              // Generation completed, clear stored ID
              try {
                localStorage.removeItem("activeGenerationId");
              } catch (err) {
                console.warn("Failed to clear active generation ID from localStorage:", err);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to check stored generation status:", err);
          // Clear invalid stored ID
          try {
            localStorage.removeItem("activeGenerationId");
          } catch (storageErr) {
            console.warn("Failed to clear invalid generation ID from localStorage:", storageErr);
          }
        }
      }

      // TODO: As a fallback, we could fetch recent generations to find active ones
      // This would require adding a GET endpoint to /api/generations that returns user's generations
      // For now, we rely on localStorage persistence only
    } catch (err) {
      console.error("Error checking for active generation:", err);
    }
  }, [pollGenerationStatus, pollingInterval]);

  // Check for active generation on mount
  useEffect(() => {
    checkActiveGeneration();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startGeneration = useCallback(
    async (data: { model: string; sanitized_input_text: string; temperature?: number }) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response.json();
          console.warn("Generation request failed:", response.status, errorData);

          // If there's already an active generation, try to resume it
          if (
            response.status === 409 &&
            errorData.error.message.includes("active generation request is already in progress")
          ) {
            console.warn("Active generation detected, attempting to resume...");
            await checkActiveGeneration();
            return;
          }

          throw new Error(errorData.error.message);
        }

        const result = await response.json();
        const { id, status, enqueued_at } = result;

        // Set initial generation state
        const initialGeneration: GenerationDTO = {
          id,
          user_id: "", // Will be set by backend
          model: data.model,
          status: status as "pending",
          temperature: data.temperature || 0.7,
          prompt_tokens: null,
          sanitized_input_length: data.sanitized_input_text.length,
          sanitized_input_sha256: "", // Will be set by backend
          sanitized_input_text: data.sanitized_input_text,
          started_at: null,
          completed_at: null,
          created_at: enqueued_at,
          updated_at: enqueued_at,
          error_code: null,
          error_message: null,
        };

        setGeneration(initialGeneration);
        generationIdRef.current = id;

        // Store generation ID for persistence across page refreshes
        try {
          localStorage.setItem("activeGenerationId", id);
        } catch (err) {
          console.warn("Failed to store generation ID in localStorage:", err);
        }

        // Start polling
        setIsPolling(true);
        pollingIntervalRef.current = setTimeout(() => pollGenerationStatus(id), pollingInterval);
      } catch (err) {
        console.error("Error starting generation:", err);
        setError({
          error: {
            code: "start_generation_error",
            message: err instanceof Error ? err.message : "Failed to start generation",
          },
        });
      } finally {
        setIsLoading(false);
      }
    },
    [pollGenerationStatus, pollingInterval, checkActiveGeneration]
  );

  const cancelGeneration = useCallback(async () => {
    if (!generationIdRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/generations/${generationIdRef.current}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.error.message);
      }

      // Stop polling
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsPolling(false);

      // Update generation status locally
      setGeneration((prev) => (prev ? { ...prev, status: "cancelled" } : null));

      // Clear stored generation ID
      try {
        localStorage.removeItem("activeGenerationId");
      } catch (err) {
        console.warn("Failed to clear active generation ID from localStorage:", err);
      }
    } catch (err) {
      console.error("Error cancelling generation:", err);
      setError({
        error: {
          code: "cancel_generation_error",
          message: err instanceof Error ? err.message : "Failed to cancel generation",
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    generation,
    candidatesSummary,
    isLoading,
    isPolling,
    error,
    startGeneration,
    cancelGeneration,
    clearError,
    resetGeneration,
    checkActiveGeneration,
  };
}
