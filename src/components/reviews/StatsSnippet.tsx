import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { RefreshCwIcon } from "lucide-react";
import type { ReviewStatsDTO, ApiErrorResponse, ReviewStatsListResponse } from "../../types";

interface StatsSnippetProps {
  cardId?: string;
}

export function StatsSnippet({ cardId }: StatsSnippetProps) {
  const [stats, setStats] = useState<ReviewStatsDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);

  const fetchStats = useCallback(
    async (isRetry = false) => {
      if (!cardId) return;

      setLoading(true);
      if (!isRetry) {
        setError(null);
        retryCountRef.current = 0;
      }

      try {
        const url = new URL("/api/review-stats", window.location.origin);
        url.searchParams.set("card_id", cardId);
        url.searchParams.set("limit", "1");
        // Note: URLSearchParams automatically converts to strings, but Zod will handle the conversion

        const response = await fetch(url.toString());

        if (!response.ok) {
          const errorData = (await response.json()) as ApiErrorResponse;
          throw new Error(errorData.error.message);
        }

        const data = (await response.json()) as ReviewStatsListResponse;
        setStats(data.data[0] || null);
        retryCountRef.current = 0;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load statistics";
        setError(errorMessage);

        if (
          retryCountRef.current < 2 &&
          !errorMessage.includes("not found") &&
          !errorMessage.includes("unauthorized")
        ) {
          retryCountRef.current += 1;
          setTimeout(() => fetchStats(true), 1000 * retryCountRef.current); // Exponential backoff
        }
      } finally {
        setLoading(false);
      }
    },
    [cardId]
  );

  const handleRetry = () => {
    fetchStats();
  };

  useEffect(() => {
    if (!cardId) {
      setStats(null);
      setError(null);
      retryCountRef.current = 0;
      return;
    }

    fetchStats();
  }, [cardId, fetchStats]);

  if (!cardId) {
    return (
      <Card className="bg-green-50 border border-green-800">
        <CardHeader>
          <CardTitle className="text-base text-black">Card Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-black">No card selected</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-green-50 border border-green-800">
        <CardHeader>
          <CardTitle className="text-base text-black">Card Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 h-full">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-green-50 border border-green-800">
        <CardHeader>
          <CardTitle className="text-base text-black">Card Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 h-full">
          <p className="text-sm text-black">{error}</p>
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={loading} className="w-full">
            <RefreshCwIcon className="mr-2 h-3 w-3" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="bg-green-50 border border-green-800">
        <CardHeader>
          <CardTitle className="text-base text-black">Card Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-black">No statistics available</p>
        </CardContent>
      </Card>
    );
  }

  const successRate =
    stats.successes > 0 && stats.total_reviews > 0 ? Math.round((stats.successes / stats.total_reviews) * 100) : 0;

  const nextReviewDate = stats.next_review_at ? new Date(stats.next_review_at).toLocaleDateString() : "Not scheduled";

  return (
    <Card className="bg-green-50 border border-green-800">
      <CardHeader>
        <CardTitle className="text-base text-black">Card Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-black">Total reviews:</span>
          <span className="font-medium text-black">{stats.total_reviews}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-black">Success rate:</span>
          <span className="font-medium text-black">{successRate}%</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-black">Current streak:</span>
          <span className="font-medium text-black">{stats.consecutive_successes}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-black">Next review:</span>
          <span className="font-medium text-black">{nextReviewDate}</span>
        </div>
      </CardContent>
    </Card>
  );
}
