"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

// Page-stepper, not numbered pages. Driven by total + pageSize + page; emits
// (page) on change. Idempotent re-render — safe to use in URL-driven flows.

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  className,
}: {
  page: number; // 1-based
  pageSize: number;
  total: number;
  onChange: (next: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const first = (safePage - 1) * pageSize + 1;
  const last = Math.min(total, safePage * pageSize);

  return (
    <div
      className={`flex items-center justify-between gap-3 text-sm text-muted-foreground ${className ?? ""}`}
    >
      <div>
        {total === 0 ? "0 of 0" : `${first}–${last} of ${total}`}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={safePage <= 1}
          onClick={() => onChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="px-2 tabular-nums">
          {safePage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={safePage >= totalPages}
          onClick={() => onChange(safePage + 1)}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
