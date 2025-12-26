import { Loader2Icon } from "lucide-react";
import { Button } from "../ui/button";

interface LoadMoreButtonProps {
  loading: boolean;
  hasMore: boolean;
  onClick: () => void;
}

export function LoadMoreButton({ loading, hasMore, onClick }: LoadMoreButtonProps) {
  if (!hasMore) {
    return null;
  }

  return (
    <div className="flex justify-center pt-2">
      <Button type="button" variant="outline" onClick={onClick} disabled={loading}>
        {loading && <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />}
        Load more
      </Button>
    </div>
  );
}
