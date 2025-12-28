import { useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface AdminsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function AdminsToolbar({ search, onSearchChange }: AdminsToolbarProps) {
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onSearchChange(value);
    },
    [onSearchChange]
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <Label htmlFor="admin-search" className="sr-only">
          Search administrators
        </Label>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-search"
            type="text"
            placeholder="Search by User ID..."
            value={search}
            onChange={handleSearchInputChange}
            className="pl-9 h-9"
            maxLength={200}
          />
        </div>
      </div>
    </div>
  );
}
