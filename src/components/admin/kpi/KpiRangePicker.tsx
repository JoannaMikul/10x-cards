import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { AdminKpiRange } from "@/lib/analytics-kpi.types";

interface KpiRangePickerProps {
  range: AdminKpiRange;
  customFrom?: Date | null;
  customTo?: Date | null;
  rangeError?: string;
  onRangeChange: (range: AdminKpiRange) => void;
  onCustomRangeChange: (from: Date | null, to: Date | null) => void;
}

export function KpiRangePicker({
  range,
  customFrom,
  customTo,
  rangeError,
  onRangeChange,
  onCustomRangeChange,
}: KpiRangePickerProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  return (
    <div className="space-y-2 w-full">
      <label className="text-sm font-medium" htmlFor="time-range-select">
        Time Range
      </label>

      <Select value={range} onValueChange={(value) => onRangeChange(value as AdminKpiRange)}>
        <SelectTrigger className="w-full sm:w-48" id="time-range-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>

      {range === "custom" && (
        <div className="flex gap-2 items-center">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="from-date-button">
              From
            </label>
            <Popover open={fromOpen} onOpenChange={setFromOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="from-date-button"
                  variant="outline"
                  className={cn("w-32 justify-start text-left font-normal", !customFrom && "text-muted-foreground")}
                  aria-label="Select start date for custom range"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customFrom ? format(customFrom, "MM/dd/yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customFrom || undefined}
                  onSelect={(date) => {
                    onCustomRangeChange(date || null, customTo || null);
                    setFromOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="to-date-button">
              To
            </label>
            <Popover open={toOpen} onOpenChange={setToOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="to-date-button"
                  variant="outline"
                  className={cn("w-32 justify-start text-left font-normal", !customTo && "text-muted-foreground")}
                  aria-label="Select end date for custom range"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customTo ? format(customTo, "MM/dd/yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customTo || undefined}
                  onSelect={(date) => {
                    onCustomRangeChange(customFrom || null, date || null);
                    setToOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {rangeError && <FieldError>{rangeError}</FieldError>}
    </div>
  );
}
