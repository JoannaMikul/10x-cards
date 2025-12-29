import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminGenerationErrorLogsFilters } from "@/types";

interface ErrorFiltersProps {
  filters: AdminGenerationErrorLogsFilters;
  onChange: (updater: (prev: AdminGenerationErrorLogsFilters) => AdminGenerationErrorLogsFilters) => void;
  onSubmit: () => void;
  onReset: () => void;
  validationErrors: string[];
}

export const ErrorFilters: React.FC<ErrorFiltersProps> = ({
  filters,
  onChange,
  onSubmit,
  onReset,
  validationErrors,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const handleReset = () => {
    onReset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="userId">User UUID</Label>
          <Input
            id="userId"
            type="text"
            placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
            value={filters.userId}
            onChange={(e) => onChange((prev) => ({ ...prev, userId: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            type="text"
            placeholder="e.g. gpt-4"
            value={filters.model}
            onChange={(e) => onChange((prev) => ({ ...prev, model: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="from">From Date</Label>
          <Input
            id="from"
            type="date"
            value={filters.from || ""}
            onChange={(e) => onChange((prev) => ({ ...prev, from: e.target.value || undefined }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to">To Date</Label>
          <Input
            id="to"
            type="date"
            value={filters.to || ""}
            onChange={(e) => onChange((prev) => ({ ...prev, to: e.target.value || undefined }))}
          />
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="text-sm text-destructive">
          <ul className="list-disc list-inside">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit">Apply Filters</Button>
        <Button type="button" variant="outline" onClick={handleReset}>
          Clear Filters
        </Button>
      </div>
    </form>
  );
};
