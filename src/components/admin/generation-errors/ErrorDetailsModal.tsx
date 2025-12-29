import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Copy } from "lucide-react";
import type { AdminGenerationErrorLogListItemVM } from "@/types";
import { toast } from "sonner";

interface ErrorDetailsModalProps {
  open: boolean;
  log: AdminGenerationErrorLogListItemVM | null;
  onClose: () => void;
}

export const ErrorDetailsModal: React.FC<ErrorDetailsModalProps> = ({ open, log, onClose }) => {
  const handleCopyHash = async () => {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(log.sourceTextHash);
      toast.success("Hash copied to clipboard");
    } catch {
      toast.error("Failed to copy hash");
    }
  };

  const handleCopyJson = async () => {
    if (!log) return;
    try {
      const jsonData = {
        id: log.id,
        userId: log.userId,
        model: log.model,
        errorCode: log.errorCode,
        errorMessage: log.errorMessage,
        sourceTextHash: log.sourceTextHash,
        sourceTextLength: log.sourceTextLength,
        createdAt: log.createdAt,
      };
      await navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
      toast.success("JSON data copied to clipboard");
    } catch {
      toast.error("Failed to copy JSON data");
    }
  };

  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generation Error Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">General Information</h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">ID:</span>
                <div className="font-mono text-muted-foreground">{log.id}</div>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">User:</span>
                <div className="font-mono text-muted-foreground">{log.userId}</div>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Model:</span>
                <div className="text-muted-foreground">{log.model}</div>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Created At:</span>
                <div className="text-muted-foreground">{log.createdAtFormatted}</div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-3">Error</h3>
            <div className="space-y-3">
              <div>
                <span className="font-medium">Error Code:</span>
                <div className="font-mono bg-muted px-3 py-2 rounded mt-1">{log.errorCode}</div>
              </div>
              <div>
                <span className="font-medium">Error Message:</span>
                <div className="bg-muted px-3 py-2 rounded mt-1 whitespace-pre-wrap">{log.errorMessage}</div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-3">Source Text</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Hash:</span>
                <div className="font-mono text-muted-foreground break-all">{log.sourceTextHash}</div>
                <Button variant="outline" size="sm" onClick={handleCopyHash} className="mt-2">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Hash
                </Button>
              </div>
              <div>
                <span className="font-medium">Text Length:</span>
                <div className="text-muted-foreground">{log.sourceTextLength} characters</div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleCopyJson}>
              <Copy className="mr-2 h-4 w-4" />
              Copy as JSON
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
