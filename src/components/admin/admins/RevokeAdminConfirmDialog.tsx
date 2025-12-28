import { UserX } from "lucide-react";
import type { RevokeAdminDialogState } from "../../../types";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";

interface RevokeAdminConfirmDialogProps {
  state: RevokeAdminDialogState | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RevokeAdminConfirmDialog({ state, onConfirm, onCancel }: RevokeAdminConfirmDialogProps) {
  if (!state) return null;

  return (
    <Dialog open={state.open} onOpenChange={(open) => !state.isSubmitting && !open && onCancel()}>
      <DialogContent showCloseButton={!state.isSubmitting}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-destructive" />
            Revoke Administrator Role
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-muted-foreground text-sm space-y-2">
              <p>
                Are you sure you want to revoke administrator privileges from user{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{state.userId}</code>?
              </p>
              <p>
                The user will lose access to the admin panel and all administrative functions.
                {state.isSelf && (
                  <span className="text-destructive font-medium">
                    {" "}
                    You are revoking your own administrator privileges.
                  </span>
                )}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={state.isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={state.isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {state.isSubmitting ? "Revoking..." : "Revoke Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
