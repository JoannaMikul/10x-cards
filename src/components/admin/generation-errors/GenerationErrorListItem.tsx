import React from "react";
import { Button } from "@/components/ui/button";
import { Copy, Eye } from "lucide-react";
import type { AdminGenerationErrorLogListItemVM } from "@/types";
import { toast } from "sonner";

interface GenerationErrorListItemProps {
  item: AdminGenerationErrorLogListItemVM;
  onClick: (item: AdminGenerationErrorLogListItemVM) => void;
}

export const GenerationErrorListItem: React.FC<GenerationErrorListItemProps> = ({ item, onClick }) => {
  const handleCopyHash = async () => {
    try {
      await navigator.clipboard.writeText(item.sourceTextHash);
      toast.success("Hash copied to clipboard");
    } catch {
      toast.error("Failed to copy hash");
    }
  };

  const handleDetails = () => {
    onClick(item);
  };

  return (
    <>
      <div className="hidden lg:grid grid-cols-12 gap-2 lg:gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors items-center">
        <div className="col-span-2 lg:col-span-2 md:col-span-3 text-sm font-mono min-w-0">
          <span className="truncate block" title={item.userId}>
            {item.userId.slice(0, 8)}...
          </span>
          <span className="sr-only">full UUID: {item.userId}</span>
        </div>
        <div className="col-span-2 lg:col-span-2 md:col-span-2 text-sm min-w-0 truncate" title={item.model}>
          {item.model}
        </div>
        <div className="col-span-3 lg:col-span-3 md:col-span-3 text-sm min-w-0 flex items-center">
          <span className="font-mono bg-muted px-2 py-1 rounded text-xs truncate" title={item.errorCode}>
            {item.errorCode}
          </span>
        </div>
        <div className="col-span-2 lg:col-span-2 md:col-span-2 text-sm font-mono min-w-0 flex items-center gap-1">
          <span className="truncate flex-1" title={item.sourceTextHash}>
            {item.sourceTextHash.slice(0, 8)}...
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyHash}
            className="shrink-0 h-6 w-6 p-0"
            aria-label="Copy hash"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <div
          className="col-span-1 lg:col-span-1 md:col-span-1 text-sm min-w-0 truncate"
          title={item.sourceTextLength.toString()}
        >
          {item.sourceTextLength}
        </div>
        <div
          className="col-span-1 lg:col-span-1 md:col-span-2 text-sm text-muted-foreground min-w-0 truncate"
          title={item.createdAtFormatted}
        >
          {item.createdAtFormatted}
        </div>
        <div className="col-span-1 lg:col-span-1 md:col-span-1 flex justify-end items-center">
          <Button variant="outline" size="sm" onClick={handleDetails} className="shrink-0" aria-label="View details">
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="lg:hidden p-4 border rounded-lg space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-mono">User: {item.userId.slice(0, 8)}...</div>
            <div className="text-sm text-muted-foreground">{item.createdAtFormatted}</div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDetails} aria-label="View details">
            <Eye className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          <div className="text-sm">
            <span className="font-medium">Model:</span> {item.model}
          </div>
          <div className="text-sm">
            <span className="font-medium">Error Code:</span>{" "}
            <span className="font-mono bg-muted px-2 py-1 rounded text-xs">{item.errorCode}</span>
          </div>
          <div className="text-sm">
            <span className="font-medium">Hash:</span>{" "}
            <span className="font-mono">{item.sourceTextHash.slice(0, 8)}...</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyHash}
              className="ml-2 h-6 w-6 p-0"
              aria-label="Copy hash"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-sm">
            <span className="font-medium">Text Length:</span> {item.sourceTextLength}
          </div>
        </div>
      </div>
    </>
  );
};
