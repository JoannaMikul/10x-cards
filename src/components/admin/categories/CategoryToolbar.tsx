import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface CategoryToolbarProps {
  search: string;
  onChange?: (value: string) => void;
  onDebouncedChange: (value: string) => void;
  onCreateClick: () => void;
  debounceMs?: number;
}

export function CategoryToolbar({
  search,
  onChange,
  onDebouncedChange,
  onCreateClick,
  debounceMs = 300,
}: CategoryToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      const trimmed = localSearch.trim();
      onDebouncedChange(trimmed.length ? trimmed : "");
    }, debounceMs);

    return () => window.clearTimeout(handler);
  }, [debounceMs, localSearch, onDebouncedChange]);

  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSearch(value);
      onChange?.(value);
    },
    [onChange]
  );

  const handleCreateClick = useCallback(() => {
    onCreateClick();
  }, [onCreateClick]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <Label htmlFor="category-search" className="sr-only">
          Search categories
        </Label>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="category-search"
            type="text"
            placeholder="Search by name or slug..."
            value={localSearch}
            onChange={handleSearchInputChange}
            className="pl-9 h-9"
            maxLength={200}
          />
        </div>
      </div>

      <Button onClick={handleCreateClick} className="shrink-0">
        <Plus className="h-4 w-4 mr-2" />
        Add Category
      </Button>
    </div>
  );
}
