import React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronDown } from "lucide-react";
import type { AdminGenerationErrorLogListItemVM, ApiErrorResponse } from "@/types";
import { GenerationErrorListItem } from "./GenerationErrorListItem";

interface GenerationErrorsListProps {
  items: AdminGenerationErrorLogListItemVM[];
  loading: boolean;
  error: ApiErrorResponse | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelect: (log: AdminGenerationErrorLogListItemVM) => void;
  onRetry: () => void;
}

export const GenerationErrorsList: React.FC<GenerationErrorsListProps> = ({
  items,
  loading,
  error,
  hasMore,
  onLoadMore,
  onSelect,
  onRetry,
}) => {
  if (loading && items.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error loading data</h3>
        <p className="text-muted-foreground mb-4">{error.error.message}</p>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold mb-2">No errors found for selected filters</h3>
        <p className="text-muted-foreground">Try changing the filter criteria or check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden lg:grid grid-cols-12 gap-4 p-4 bg-primary/90 rounded-lg font-medium text-sm text-primary-foreground">
        <div className="col-span-2">User</div>
        <div className="col-span-2">Model</div>
        <div className="col-span-3">Error Code</div>
        <div className="col-span-2">Hash</div>
        <div className="col-span-1">Length</div>
        <div className="col-span-1">Time</div>
        <div className="col-span-1">Actions</div>
      </div>

      {items.map((item) => (
        <GenerationErrorListItem key={item.id} item={item} onClick={onSelect} />
      ))}

      {hasMore && (
        <div className="text-center pt-4">
          <Button onClick={onLoadMore} disabled={loading} variant="outline">
            {loading ? (
              <>
                <ChevronDown className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
