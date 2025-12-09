import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Check, X, AlertTriangle } from "lucide-react";

interface AcceptRejectBarProps {
  candidateId: string;
  onAccept: (candidateId: string) => Promise<void>;
  onReject: (candidateId: string) => Promise<void>;
  disabled?: boolean;
}

export function AcceptRejectBar({ candidateId, onAccept, onReject, disabled = false }: AcceptRejectBarProps) {
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(candidateId);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(candidateId);
      setIsRejectDialogOpen(false);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Button variant="outline" size="sm" onClick={handleAccept} disabled={disabled || isAccepting} className="gap-2">
        {isAccepting ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Accept
      </Button>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={disabled || isRejecting} className="gap-2">
            <X className="h-4 w-4" />
            Reject
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Rejection
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this flashcard candidate? This action cannot be undone. The candidate will
              be permanently removed from the list.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} disabled={isRejecting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isRejecting} className="gap-2">
              {isRejecting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Reject Candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
