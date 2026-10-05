"use client";

import Link from "next/link";

// THE DOCTOR DASHBOARD GREETING.
//
// Identity lives ONCE, in the global app-shell header (the clinic/role label
// and the user avatar menu, top-right) and in the sidebar brand lockup. This
// band therefore carries only the thing that is unique to the dashboard: a
// warm, dated greeting. It deliberately does NOT repeat the doctor photo, the
// clinic name or a Settings link — those were duplicates of the header chrome
// and the sidebar, and a doctor glancing at this page forty times a day does
// not need their own face and clinic name a second and third time.

export function CommandBand({
  greeting,
  dateLabel,
}: {
  greeting: string;
  dateLabel: string;
}) {
  return (
    <header className="min-w-0 pb-1">
      <h1
        suppressHydrationWarning
        className="text-balance font-serif text-[26px] leading-tight text-[color:var(--ink-primary)] sm:text-[30px]"
      >
        {greeting}
      </h1>
      <p suppressHydrationWarning className="mt-0.5 text-sm text-[color:var(--ink-tertiary)]">
        {dateLabel}
      </p>
    </header>
  );
}

export interface StatusFilterCount {
  key: string;
  label: string;
  value: number;
  /** Omitted when there is no destination page for this status yet. */
  href?: string;
  active?: boolean;
}

/**
 * "Patients requiring your attention" + the quiet Needs review / Approved /
 * Ordered / Shared counts.
 *
 * Deliberately not four KPI cards: the brief is explicit that this is a
 * worklist, not analytics, and a doctor should tell these four numbers apart
 * on sight, not by reading a card each. `active` marks the deck's current
 * filter (Needs review, always — see the header note on the dashboard client
 * for why the others are informational links rather than live filters).
 */
export function DashboardStatusFilters({ counts }: { counts: StatusFilterCount[] }) {
  return (
    <div className="space-y-2.5">
      <h2 className="text-[19px] font-medium text-[color:var(--ink-primary)]">
        Patients requiring your attention
      </h2>
      <div
        role="group"
        aria-label="Patient status"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[color:var(--v2-border-subtle)] pb-3"
      >
        {counts.map((c) => {
          const inner = (
            <>
              <span
                className="text-[15px] font-semibold tabular-nums"
                style={{ color: c.active ? "var(--brand-primary)" : "var(--ink-primary)" }}
              >
                {c.value}
              </span>
              <span className="ml-1.5 text-[13px] text-[color:var(--ink-tertiary)]">{c.label}</span>
            </>
          );
          if (c.href) {
            return (
              <Link
                key={c.key}
                href={c.href}
                className="inline-flex items-center rounded-full px-1 py-0.5 transition-colors hover:opacity-80"
                aria-current={c.active ? "true" : undefined}
              >
                {inner}
              </Link>
            );
          }
          return (
            <span key={c.key} className="inline-flex items-center px-1 py-0.5">
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}
