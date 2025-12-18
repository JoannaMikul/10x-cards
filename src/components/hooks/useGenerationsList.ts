import { useState, useEffect, useCallback } from "react";
import type { GenerationDTO, ApiErrorResponse } from "../../types";

interface UseGenerationsListReturn {
  generations: GenerationDTO[];
  loading: boolean;
  error: ApiErrorResponse | null;
  refetch: () => Promise<void>;
}

export function useGenerationsList(): UseGenerationsListReturn {
  const [generations, setGenerations] = useState<GenerationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  const fetchGenerations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generations?all=true", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.error.message);
      }

      const data = await response.json();
      setGenerations(data.generations);
    } catch (err) {
      setError({
        error: {
          code: "fetch_error",
          message: err instanceof Error ? err.message : "Failed to fetch generations",
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchGenerations();
  }, [fetchGenerations]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  return {
    generations,
    loading,
    error,
    refetch,
  };
}
