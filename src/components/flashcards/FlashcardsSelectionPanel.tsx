import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface FlashcardsSelectionPanelProps {
  hasActiveSelection: boolean;
  selectionModeLabel: string;
  selectionDescription: string;
  showDeletedBadge: boolean;
}

export function FlashcardsSelectionPanel({
  hasActiveSelection,
  selectionModeLabel,
  selectionDescription,
  showDeletedBadge,
}: FlashcardsSelectionPanelProps) {
  return (
    <div className="flex w-full shrink-0 self-stretch pr-6 pl-6" data-testid="selection-panel">
      <div
        className={cn(
          "rounded-lg border px-4 py-3 text-sm flex h-full w-full flex-col transition-colors",
          hasActiveSelection
            ? "border-primary/60 bg-primary/10 shadow-sm dark:border-primary/50 dark:bg-primary/20"
            : "border-border bg-muted/30"
        )}
        data-testid="selection-status"
      >
        <div>
          <p
            className={cn("font-medium", hasActiveSelection ? "text-primary" : "text-foreground")}
            data-testid="selection-mode"
          >
            {selectionModeLabel}
          </p>
          <p
            className={cn(hasActiveSelection ? "text-primary/80 dark:text-primary/70" : "text-muted-foreground")}
            data-testid="selection-description"
          >
            {selectionDescription}
          </p>
        </div>
        {showDeletedBadge && (
          <Badge variant="default" className="mt-3" data-testid="deleted-cards-badge">
            Showing deleted cards
          </Badge>
        )}
      </div>
    </div>
  );
}
