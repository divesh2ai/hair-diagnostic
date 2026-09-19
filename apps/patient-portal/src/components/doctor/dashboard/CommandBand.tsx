"use client";

import Link from "next/link";
import Image from "next/image";
import { UserRound } from "lucide-react";

// THE DOCTOR HEADER — V2.
//
// ── What this replaced ──────────────────────────────────────────────────────
// The V1 band was the one deliberate exception to "no large tinted block": a
// dark ink panel with a radial plum glow, a filled hero CTA and a five-metric
// instrument rail. It read as a console, which was the point at the time —
// but "no giant welcome hero", "no glowing elements" and "teal as emphasis,
// not wallpaper" are now the explicit brief, and a full-bleed gradient panel
// is exactly what those rule out.
//
// This is the plain header the brief asks for: identity on the left, clinic
// context on the right, nothing filled, nothing glowing. The five-count
// instrument rail moves to DashboardStatusFilters, directly below — quiet
// counts a doctor scans in under three seconds, not cards.

export function CommandBand({
  greeting,
  clinicName,
  dateLabel,
  photoUrl,
}: {
  greeting: string;
  clinicName: string | null;
  dateLabel: string;
  photoUrl: string | null;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-1">
      <div className="min-w-0">
        <h1
          suppressHydrationWarning
          className="text-balance font-serif text-[26px] leading-tight text-[color:var(--ink-primary)] sm:text-[30px]"
        >
          {greeting}
        </h1>
        <p suppressHydrationWarning className="mt-0.5 text-sm text-[color:var(--ink-tertiary)]">
          {dateLabel}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {clinicName && (
          <span className="hidden text-sm text-[color:var(--ink-secondary)] sm:inline">
            {clinicName}
          </span>
        )}
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[color:var(--surface-muted)] ring-1 ring-[color:var(--v2-border-default)]">
          {photoUrl ? (
            <Image src={photoUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[color:var(--ink-tertiary)]">
              <UserRound className="h-4.5 w-4.5" />
            </span>
          )}
        </span>
        <Link
          href="/doctor/settings"
          className="hidden text-xs font-medium text-[color:var(--ink-tertiary)] underline decoration-transparent underline-offset-2 transition-colors hover:text-[color:var(--brand-primary)] hover:decoration-current sm:inline"
        >
          Settings
        </Link>
      </div>
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
