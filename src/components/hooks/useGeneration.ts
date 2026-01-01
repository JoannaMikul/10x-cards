import { useState, useEffect, useCallback, useRef } from "react";
import type { GenerationDTO, ApiErrorResponse, CandidatesSummary, CreateGenerationCommand } from "../../types";
import { generationsApiClient, ApiClientError } from "../../lib/api";

interface UseGenerationOptions {
  pollingInterval?: number;
}

interface UseGenerationReturn {
  generation: GenerationDTO | null;
  candidatesSummary: CandidatesSummary | null;
  isLoading: boolean;
  isPolling: boolean;
  error: ApiErrorResponse | null;
  startGeneration: (data: CreateGenerationCommand) => Promise<void>;
  cancelGeneration: () => Promise<void>;
  clearError: () => void;
  resetGeneration: () => void;
  checkActiveGeneration: () => Promise<void>;
}

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  },
};

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
        const data = await generationsApiClient.getById(id);
        const { generation: updatedGeneration, candidates_summary } = data;

        setGeneration(updatedGeneration);
        setCandidatesSummary(candidates_summary);

        if (["succeeded", "cancelled", "failed"].includes(updatedGeneration.status)) {
          setIsPolling(false);
          safeLocalStorage.removeItem("activeGenerationId");
          return;
        }

        if (["pending", "running"].includes(updatedGeneration.status)) {
          pollingIntervalRef.current = setTimeout(() => pollGenerationStatus(id), pollingInterval);
        }
      } catch (err) {
        console.error("Error polling generation status:", err);
        const apiError =
          err instanceof ApiClientError
            ? err.toApiErrorResponse()
            : {
                error: {
                  code: "polling_error",
                  message: err instanceof Error ? err.message : "Failed to poll generation status",
                },
              };
        setError(apiError);
        setIsPolling(false);
      }
    },
    [pollingInterval]
  );

  const resetGeneration = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setGeneration(null);
    setCandidatesSummary(null);
    setIsLoading(false);
    setIsPolling(false);
    setError(null);
    generationIdRef.current = null;
    safeLocalStorage.removeItem("activeGenerationId");
  }, []);

  const checkActiveGeneration = useCallback(async () => {
    try {
      const activeGenerationId = safeLocalStorage.getItem("activeGenerationId");

      if (activeGenerationId) {
        try {
          const data = await generationsApiClient.getById(activeGenerationId);
          const { generation: updatedGeneration, candidates_summary } = data;

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
            safeLocalStorage.removeItem("activeGenerationId");
          }
        } catch (err) {
          console.warn("Failed to check stored generation status:", err);
          safeLocalStorage.removeItem("activeGenerationId");
        }
      }
    } catch (err) {
      console.error("Error checking for active generation:", err);
    }
  }, [pollGenerationStatus, pollingInterval]);

  useEffect(() => {
    checkActiveGeneration();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startGeneration = useCallback(
    async (data: CreateGenerationCommand) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await generationsApiClient.create(data);
        const { id, status, enqueued_at } = result;

        const initialGeneration: GenerationDTO = {
          id,
          user_id: "",
          model: data.model,
          status: status as "pending",
          temperature: data.temperature || 0.7,
          prompt_tokens: null,
          sanitized_input_length: data.sanitized_input_text.length,
          sanitized_input_sha256: "",
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
        safeLocalStorage.setItem("activeGenerationId", id);

        try {
          await generationsApiClient.process();
        } catch (err) {
          console.warn("Failed to trigger generation processing:", err);
        }

        setIsPolling(true);
        pollingIntervalRef.current = setTimeout(() => pollGenerationStatus(id), pollingInterval);
      } catch (err) {
        console.error("Error starting generation:", err);

        // Handle 409 conflict - active generation already exists
        if (err instanceof ApiClientError && err.statusCode === 409) {
          await checkActiveGeneration();
          return;
        }

        const apiError =
          err instanceof ApiClientError
            ? err.toApiErrorResponse()
            : {
                error: {
                  code: "start_generation_error",
                  message: err instanceof Error ? err.message : "Failed to start generation",
                },
              };
        setError(apiError);
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
      await generationsApiClient.update(generationIdRef.current, { status: "cancelled" });

      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsPolling(false);

      setGeneration((prev) => (prev ? { ...prev, status: "cancelled" } : null));
      safeLocalStorage.removeItem("activeGenerationId");
    } catch (err) {
      console.error("Error cancelling generation:", err);
      const apiError =
        err instanceof ApiClientError
          ? err.toApiErrorResponse()
          : {
              error: {
                code: "cancel_generation_error",
                message: err instanceof Error ? err.message : "Failed to cancel generation",
              },
            };
      setError(apiError);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
