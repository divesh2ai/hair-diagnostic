"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Simple horizontal filter bar — caller provides Select/SearchBox elements
// as children. Adds responsive wrapping + consistent spacing + an optional
// "Clear all" action so we don't reinvent the layout on every screen.

export function FilterBar({
  className,
  children,
  onClear,
  clearLabel = "Clear",
}: {
  className?: string;
  children: ReactNode;
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/40 p-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {children}
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
}
