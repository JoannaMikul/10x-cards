import { AlertTriangleIcon } from "lucide-react";
import type { FlashcardDTO } from "../../types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  mode: "delete" | "restore";
  card?: FlashcardDTO;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function ConfirmDialog({ open, mode, card, onConfirm, onCancel, isProcessing = false }: ConfirmDialogProps) {
  const isDelete = mode === "delete";
  const actionLabel = isDelete ? "Delete flashcard" : "Restore flashcard";
  const description = isDelete
    ? "This will move the flashcard to the deleted state. You can restore it later if needed."
    : "This will restore the flashcard back to your collection.";

  return (
    <Dialog open={open} onOpenChange={(next) => !isProcessing && !next && onCancel()}>
      <DialogContent showCloseButton={!isProcessing}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangleIcon className="size-4 text-yellow-500" aria-hidden="true" />
            {isDelete ? "Delete flashcard?" : "Restore flashcard?"}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium text-foreground">{card?.front ?? "No flashcard selected"}</p>
          {card?.back && <p className="mt-2 line-clamp-3 text-muted-foreground">{card.back}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={isDelete ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isProcessing || !card}
          >
            {isProcessing ? "Processing…" : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
