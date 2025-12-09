import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type {
  GenerationCandidateDTO,
  GenerationCandidateListResponse,
  ApiErrorResponse,
  UpdateGenerationCandidateCommand,
  AcceptGenerationCandidateCommand,
} from "../../types";

interface UseCandidatesReturn {
  candidates: GenerationCandidateDTO[];
  loading: boolean;
  error: ApiErrorResponse | null;
  hasMore: boolean;
  nextCursor: string | null;
  loadMore: () => Promise<void>;
  updateCandidate: (id: string, command: UpdateGenerationCandidateCommand) => Promise<void>;
  acceptCandidate: (id: string, command?: AcceptGenerationCandidateCommand) => Promise<void>;
  rejectCandidate: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCandidates(generationId?: string): UseCandidatesReturn {
  const [candidates, setCandidates] = useState<GenerationCandidateDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchCandidates = useCallback(
    async (cursor: string | null = null, append = false) => {
      if (!generationId) return;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("generation_id", generationId);
        params.set("limit", "20");

        if (cursor) {
          params.set("cursor", cursor);
        }

        // Add status filter for proposed and accepted candidates
        params.append("status[]", "proposed");
        params.append("status[]", "accepted");

        const response = await fetch(`/api/generation-candidates?${params}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response.json();
          throw new Error(errorData.error.message);
        }

        const data: GenerationCandidateListResponse = await response.json();

        setCandidates((prev) => (append ? [...prev, ...data.data] : data.data));
        setNextCursor(data.page.next_cursor);
        setHasMore(data.page.has_more);
      } catch (err) {
        setError({
          error: {
            code: "fetch_error",
            message: err instanceof Error ? err.message : "Failed to fetch candidates",
          },
        });
      } finally {
        setLoading(false);
      }
    },
    [generationId]
  );

  const loadMore = useCallback(async () => {
    if (hasMore && nextCursor && !loading) {
      await fetchCandidates(nextCursor, true);
    }
  }, [hasMore, nextCursor, loading, fetchCandidates]);

  const updateCandidate = useCallback(async (id: string, command: UpdateGenerationCandidateCommand) => {
    try {
      const response = await fetch(`/api/generation-candidates/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.error.message);
      }

      const data = await response.json();
      const updatedCandidate: GenerationCandidateDTO = data.candidate;

      // Update the candidate in the local state
      setCandidates((prev) => prev.map((candidate) => (candidate.id === id ? updatedCandidate : candidate)));
      toast.success("Candidate updated", {
        description: "Flashcard candidate has been successfully updated.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update candidate";
      setError({
        error: {
          code: "update_error",
          message,
        },
      });
      toast.error("Update failed", {
        description: message,
      });
      throw err;
    }
  }, []);

  const acceptCandidate = useCallback(async (id: string, command?: AcceptGenerationCandidateCommand) => {
    try {
      const response = await fetch(`/api/generation-candidates/${id}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command || {}),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.error.message);
      }

      const data = await response.json();

      // Update the candidate status to accepted and set accepted_card_id
      setCandidates((prev) =>
        prev.map((candidate) =>
          candidate.id === id ? { ...candidate, status: "accepted" as const, accepted_card_id: data.id } : candidate
        )
      );
      toast.success("Candidate accepted", {
        description: "Flashcard candidate has been accepted and converted to a flashcard.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to accept candidate";
      setError({
        error: {
          code: "accept_error",
          message,
        },
      });
      toast.error("Accept failed", {
        description: message,
      });
      throw err;
    }
  }, []);

  const rejectCandidate = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/generation-candidates/${id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.error.message);
      }

      // Update the candidate status to rejected
      setCandidates((prev) =>
        prev.map((candidate) => (candidate.id === id ? { ...candidate, status: "rejected" as const } : candidate))
      );
      toast.success("Candidate rejected", {
        description: "Flashcard candidate has been rejected.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reject candidate";
      setError({
        error: {
          code: "reject_error",
          message,
        },
      });
      toast.error("Reject failed", {
        description: message,
      });
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchCandidates(null, false);
  }, [fetchCandidates]);

  // Initial load
  useEffect(() => {
    if (generationId) {
      fetchCandidates();
    }
  }, [generationId, fetchCandidates]);

  return {
    candidates,
    loading,
    error,
    hasMore,
    nextCursor,
    loadMore,
    updateCandidate,
    acceptCandidate,
    rejectCandidate,
    refresh,
  };
}
