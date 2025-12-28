import { memo, useMemo, useId } from "react";
import type { FlashcardDTO, SourceDTO, TagDTO } from "../../types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PencilLineIcon, TrashIcon, RotateCcwIcon, PlayIcon, AlertTriangleIcon } from "lucide-react";

interface FlashcardItemProps {
  card: FlashcardDTO;
  categoryName?: string;
  sourceName?: string;
  sourceKind?: SourceDTO["kind"];
  selected: boolean;
  onEdit: (card: FlashcardDTO) => void;
  onDelete: (card: FlashcardDTO) => void;
  onRestore: (card: FlashcardDTO) => void;
  onToggleSelectForReview: (cardId: string) => void;
  onStartReviewFromCard?: (card: FlashcardDTO) => void;
  canRestore?: boolean;
}

function FlashcardItemComponent({
  card,
  categoryName,
  sourceName,
  sourceKind,
  selected,
  onEdit,
  onDelete,
  onRestore,
  onToggleSelectForReview,
  onStartReviewFromCard,
  canRestore = false,
}: FlashcardItemProps) {
  const isDeleted = Boolean(card.deleted_at);
  const tags = card.tags ?? [];
  const nextReviewAt = card.review_stats?.next_review_at;
  const nextReviewLabel = nextReviewAt ? formatAbsoluteDate(nextReviewAt) : "Not scheduled";
  const createdAtLabel = formatRelativeDate(card.created_at);
  const originLabel = getOriginLabel(card.origin);
  const reviewCheckboxId = useId();

  const truncatedFront = useMemo(() => truncateText(card.front, 180), [card.front]);
  const truncatedBack = useMemo(() => truncateText(card.back, 260), [card.back]);

  return (
    <Card
      data-deleted={isDeleted}
      className={cn(
        "border-primary/30 bg-linear-to-br from-background via-muted/40 to-background/95 shadow-lg shadow-primary/10 transition-colors",
        isDeleted && "border-dashed bg-muted/40 opacity-85",
        selected && !isDeleted && "border-primary/70 ring-2 ring-primary/30"
      )}
    >
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="order-1 flex items-start gap-2 md:order-2 md:justify-end">
          <Label
            htmlFor={reviewCheckboxId}
            className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium"
          >
            <Checkbox
              id={reviewCheckboxId}
              checked={selected}
              onCheckedChange={() => onToggleSelectForReview(card.id)}
            />
            <span>Select for review</span>
          </Label>
        </div>
        <div className="order-2 space-y-2 md:order-1 md:flex-1">
          <CardTitle className="text-base leading-relaxed text-foreground">{truncatedFront}</CardTitle>
          <p className="text-sm font-normal text-muted-foreground leading-relaxed">{truncatedBack}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap gap-4">
            <div className="flex min-w-[120px] flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Origin</span>
              <Badge variant="outline" className={cn("border border-dotted", getOriginBadgeClass(card.origin))}>
                {originLabel}
              </Badge>
            </div>
            {categoryName && (
              <div className="flex min-w-[120px] flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Category</span>
                <Badge variant="outline" className={cn("border-dashed", getCategoryBadgeClass(categoryName))}>
                  {categoryName}
                </Badge>
              </div>
            )}
            {sourceName && (
              <div className="flex min-w-[120px] flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Source</span>
                <Badge variant="outline" className={cn("border-dotted", getSourceBadgeClass(sourceKind))}>
                  {sourceName}
                </Badge>
              </div>
            )}
            {isDeleted && (
              <div className="flex min-w-[120px] flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Status</span>
                <Badge variant="destructive">
                  <AlertTriangleIcon className="size-3" /> Deleted
                </Badge>
              </div>
            )}
          </div>
          <div className="min-w-[160px] shrink-0 sm:text-right">
            <MetadataRow label="Created" value={createdAtLabel} align="end" />
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Tags</p>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag: TagDTO) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="border-transparent bg-slate-600 text-xs font-medium text-white"
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/80">No tags yet</p>
            )}
          </div>
          <div className="min-w-[160px] shrink-0 sm:text-right">
            <div
              className={`flex flex-row gap-3 items-center text-sm text-muted-foreground ${
                !card.review_stats?.last_reviewed_at ? "justify-end" : ""
              }`}
            >
              <MetadataRow
                label="Next review"
                value={nextReviewLabel}
                className={card.review_stats?.last_reviewed_at ? "pr-3 border-r border-muted-foreground/30" : ""}
              />
              {card.review_stats?.last_reviewed_at && (
                <>
                  <MetadataRow
                    label="Last reviewed"
                    value={formatRelativeDate(card.review_stats.last_reviewed_at)}
                    className={card.deleted_at ? "pr-3 border-r border-muted-foreground/30" : ""}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(card)} disabled={isDeleted}>
            <PencilLineIcon className="size-4" /> Edit
          </Button>
          {!isDeleted && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(card)} className="text-destructive">
              <TrashIcon className="size-4" /> Delete
            </Button>
          )}
          {isDeleted && canRestore && (
            <Button variant="ghost" size="sm" onClick={() => onRestore(card)}>
              <RotateCcwIcon className="size-4" /> Restore
            </Button>
          )}
        </div>

        {onStartReviewFromCard && (
          <div className="flex flex-wrap gap-2">
            <Button variant="default" size="sm" onClick={() => onStartReviewFromCard(card)}>
              <PlayIcon className="size-4" /> Review this card
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function MetadataRow({
  label,
  value,
  align = "start",
  className,
}: {
  label: string;
  value: string;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", align === "end" && "items-end text-right", className)}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground/70">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function formatRelativeDate(dateInput: string | null | undefined): string {
  if (!dateInput) {
    return "—";
  }
  const date = new Date(dateInput);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAbsoluteDate(dateInput: string | null | undefined): string {
  console.log("dateInput", dateInput);
  if (!dateInput) {
    return "Not scheduled";
  }
  const date = new Date(dateInput);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getOriginLabel(origin: FlashcardDTO["origin"]): string {
  switch (origin) {
    case "manual":
      return "Manual";
    case "ai-full":
      return "AI (full)";
    case "ai-edited":
      return "AI (edited)";
    default:
      return origin;
  }
}

function getOriginBadgeClass(origin: FlashcardDTO["origin"]): string {
  switch (origin) {
    case "manual":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "ai-full":
      return "border-sky-300 bg-sky-50 text-sky-700";
    case "ai-edited":
      return "border-violet-300 bg-violet-50 text-violet-700";
    default:
      return "";
  }
}

function getSourceBadgeClass(kind?: SourceDTO["kind"]): string {
  switch (kind) {
    case "documentation":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "notes":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "article":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "book":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "course":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "url":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "other":
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
    default:
      return "";
  }
}

function getCategoryBadgeClass(name?: string): string {
  if (!name) {
    return "";
  }
  const normalized = name.trim().toLowerCase();
  if (normalized === "it") {
    return "border-[#473472]/60 bg-[#473472]/10 text-[#473472]";
  }
  if (normalized === "language") {
    return "border-[#f97316]/60 bg-[#f97316]/10 text-[#c2410c]";
  }
  return "";
}

export const FlashcardItem = memo(FlashcardItemComponent);
