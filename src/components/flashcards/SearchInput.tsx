import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "../ui/input-group";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onDebouncedChange: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
  label?: string;
}

const MAX_QUERY_LENGTH = 200;

function sanitizeQuery(value: string): string {
  if (!value) {
    return "";
  }
  return value.slice(0, MAX_QUERY_LENGTH);
}

export function SearchInput({
  value,
  onChange,
  onDebouncedChange,
  debounceMs = 300,
  placeholder = "Search flashcards…",
  label = "Search flashcards",
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(() => sanitizeQuery(value));

  useEffect(() => {
    setInternalValue(sanitizeQuery(value));
  }, [value]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      const trimmed = internalValue.trim();
      onDebouncedChange(trimmed.length ? trimmed : "");
    }, debounceMs);

    return () => window.clearTimeout(handler);
  }, [debounceMs, internalValue, onDebouncedChange]);

  const hasValue = useMemo(() => internalValue.trim().length > 0, [internalValue]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = sanitizeQuery(event.target.value);
    setInternalValue(nextValue);
    onChange(nextValue);
  };

  const handleClear = () => {
    setInternalValue("");
    onChange("");
    onDebouncedChange("");
  };

  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
      <span className="sr-only">{label}</span>
      <InputGroup className="bg-background dark:bg-input/30">
        <InputGroupAddon align="inline-start" className="text-muted-foreground">
          <SearchIcon className="size-4" aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={internalValue}
          placeholder={placeholder}
          onChange={handleChange}
          aria-label={label}
          maxLength={MAX_QUERY_LENGTH}
          autoComplete="off"
          className="[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText className="text-xs text-muted-foreground tabular-nums">
            {internalValue.length}/{MAX_QUERY_LENGTH}
          </InputGroupText>
          <InputGroupButton
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={handleClear}
            aria-label="Clear search"
            disabled={!hasValue}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </label>
  );
}
