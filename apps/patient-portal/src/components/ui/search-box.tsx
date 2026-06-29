"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Controlled search box. Debouncing is the caller's job — we just render.
export function SearchBox({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onSubmit?: (v: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-background h-9 px-3 text-sm focus-within:ring-2 focus-within:ring-ring/40 transition-all",
        className,
      )}
    >
      <Search className="size-4 text-muted-foreground shrink-0" />
      <input
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) onSubmit(value);
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Clear"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
