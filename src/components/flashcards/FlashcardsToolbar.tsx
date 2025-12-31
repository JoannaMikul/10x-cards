import { ChevronDownIcon, ChevronUpIcon, PlayIcon, PlusIcon, ShuffleIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { SearchInput } from "./SearchInput";

interface FlashcardsToolbarProps {
  searchValue: string;
  includeDeleted: boolean;
  canShowDeleted: boolean;
  includeDeletedCheckboxId: string;
  canStartReview: boolean;
  isManualSelectionMode: boolean;
  areFiltersExpanded: boolean;
  onSearchChange: (value: string) => void;
  onSearchDebouncedChange: (value: string) => void;
  onCreateClick: () => void;
  onSelectionModeToggle: () => void;
  onStartReview: () => void;
  onToggleFilters: () => void;
  onIncludeDeletedToggle: (checked: boolean) => void;
}

export function FlashcardsToolbar({
  searchValue,
  includeDeleted,
  canShowDeleted,
  includeDeletedCheckboxId,
  canStartReview,
  isManualSelectionMode,
  areFiltersExpanded,
  onSearchChange,
  onSearchDebouncedChange,
  onCreateClick,
  onSelectionModeToggle,
  onStartReview,
  onToggleFilters,
  onIncludeDeletedToggle,
}: FlashcardsToolbarProps) {
  const FiltersToggleIcon = areFiltersExpanded ? ChevronUpIcon : ChevronDownIcon;
  const filtersToggleLabel = areFiltersExpanded ? "Hide filters" : "Show filters";
  const selectionModeLabel = isManualSelectionMode ? "Use all filtered" : "Use manual selection";

  return (
    <div className="space-y-4" data-testid="flashcards-toolbar">
      <div className="flex gap-2" data-testid="toolbar-top-row">
        <div className="flex-1">
          <SearchInput
            value={searchValue}
            onChange={onSearchChange}
            onDebouncedChange={onSearchDebouncedChange}
            placeholder="Search by front or back…"
          />
        </div>
        <Button onClick={onCreateClick} data-testid="add-flashcard-button">
          <PlusIcon className="mr-2 size-4" />
          Add flashcard
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2" data-testid="toolbar-middle-row">
        <div className="flex gap-2" data-testid="toolbar-actions">
          <Button variant="outline" onClick={onSelectionModeToggle} data-testid="selection-mode-toggle">
            <ShuffleIcon className="mr-2 size-4" />
            {selectionModeLabel}
          </Button>
          <Button onClick={onStartReview} disabled={!canStartReview} data-testid="review-flashcards-button">
            <PlayIcon className="mr-2 size-4" />
            Review flashcards
          </Button>
        </div>
        {canShowDeleted && (
          <label
            htmlFor={includeDeletedCheckboxId}
            className="flex items-center gap-2 text-sm text-muted-foreground ml-auto"
            data-testid="show-deleted-label"
          >
            <Checkbox
              id={includeDeletedCheckboxId}
              checked={includeDeleted}
              onCheckedChange={(checked) => onIncludeDeletedToggle(Boolean(checked))}
              data-testid="show-deleted-checkbox"
            />
            <span>Show deleted</span>
          </label>
        )}
      </div>
      <div className="flex justify-start" data-testid="toolbar-bottom-row">
        <Button
          variant="outline"
          className="w-full md:w-auto"
          onClick={onToggleFilters}
          data-testid="toggle-filters-button"
        >
          <FiltersToggleIcon className="mr-2 size-4" />
          {filtersToggleLabel}
        </Button>
      </div>
    </div>
  );
}
