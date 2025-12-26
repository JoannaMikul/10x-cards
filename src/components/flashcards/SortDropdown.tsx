import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { FlashcardsSort } from "../../types";

interface SortDropdownProps {
  value: FlashcardsSort;
  onChange: (value: FlashcardsSort) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

const SORT_OPTIONS: { value: FlashcardsSort; label: string }[] = [
  { value: "-created_at", label: "Newest" },
  { value: "created_at", label: "Oldest" },
  { value: "updated_at", label: "Recently updated" },
  { value: "next_review_at", label: "Next reviews" },
];

export function SortDropdown({
  value,
  onChange,
  label = "Sort flashcards",
  placeholder = "Sort by…",
  disabled,
}: SortDropdownProps) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as FlashcardsSort)} disabled={disabled}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          <SelectSeparator />
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
