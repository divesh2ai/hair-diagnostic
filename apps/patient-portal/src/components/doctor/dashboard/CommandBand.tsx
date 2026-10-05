"use client";

import Link from "next/link";
import { FileText, CheckCircle2, Package, Share2 } from "lucide-react";

// THE DOCTOR DASHBOARD HERO + STATUS TILES.
//
// Identity (photo, clinic, settings) lives once — in the app-shell header and
// the sidebar brand — so this surface carries only what is unique to the
// dashboard: a warm, dated welcome and the four worklist counts the doctor
// actually scans for.
//
// Colour follows the doctor token thesis (styles/doctor-tokens.css), not the
// mockup literally: amber = the doctor's turn (needs review), green = decided
// and saved (approved), plum = the order / treatment, teal = shared. Green is
// never spent on anything but a completed decision.

export function CommandBand({
  greetingTime,
  name,
  dateLabel,
}: {
  greetingTime: string;
  name: string;
  dateLabel: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)] px-6 py-6 shadow-[0_1px_2px_rgba(28,36,48,0.04)] sm:px-8 sm:py-7">
      {/* Soft champagne wash on the right — a luxury hairline of warmth, never
          a tinted block of meaning. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-[color:var(--hd-champagne-tint)] to-transparent"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--hd-eyebrow-ink)]">
            {greetingTime}
          </p>
          <h1
            suppressHydrationWarning
            className="mt-1 font-serif text-[30px] leading-[1.05] text-[color:var(--hd-text)] sm:text-[40px]"
          >
            {name}.
          </h1>
          <span className="mt-2.5 block h-[3px] w-12 rounded-full bg-[color:var(--hd-champagne)]" />
          <p
            suppressHydrationWarning
            className="mt-2.5 text-sm text-[color:var(--hd-text-muted)]"
          >
            {dateLabel}
          </p>
        </div>

        <p className="hidden max-w-[15rem] text-right font-serif text-lg italic leading-snug text-[color:var(--hd-text-secondary)] sm:block">
          Care today for
          <br />
          healthier tomorrows
        </p>
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

// Per-status icon + token colours. Keyed on the stable status key, never the
// display label, so a rename cannot silently recolour a tile.
const TILE_STYLE: Record<
  string,
  { icon: typeof FileText; ink: string; tint: string }
> = {
  "needs-review": { icon: FileText, ink: "var(--hd-st-action-ink)", tint: "var(--hd-st-action-tint)" },
  approved: { icon: CheckCircle2, ink: "var(--hd-success-ink)", tint: "var(--hd-success-tint)" },
  ordered: { icon: Package, ink: "var(--hd-primary)", tint: "var(--hd-primary-tint)" },
  shared: { icon: Share2, ink: "var(--hd-scalp-ink)", tint: "var(--hd-scalp-tint)" },
};

const FALLBACK_TILE = { icon: FileText, ink: "var(--hd-text)", tint: "var(--hd-surface-sunken)" };

/**
 * "Patients requiring your attention" + the four worklist counts as scannable
 * stat tiles — an icon that carries the status colour, the figure, and its
 * label. Big-number tiles are warranted here because these figures ARE the
 * point of the page (see the dashboard design rules). `active` marks the deck's
 * current filter.
 */
export function DashboardStatusFilters({ counts }: { counts: StatusFilterCount[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--hd-eyebrow-ink)]">
        Patients requiring your attention
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map((c) => {
          const style = TILE_STYLE[c.key] ?? FALLBACK_TILE;
          const Icon = style.icon;
          const tile = (
            <>
              <span
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: style.tint, color: style.ink }}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[26px] font-semibold leading-none tabular-nums text-[color:var(--hd-text)]">
                  {c.value}
                </span>
                <span className="mt-1 block truncate text-[13px] text-[color:var(--hd-text-muted)]">
                  {c.label}
                </span>
              </span>
            </>
          );
          const base =
            "flex items-center gap-3 rounded-2xl border bg-[color:var(--hd-surface)] px-4 py-3.5 transition-colors";
          const edge = c.active
            ? "border-[color:var(--hd-champagne)] shadow-[0_1px_2px_rgba(28,36,48,0.05)]"
            : "border-[color:var(--hd-border)]";
          if (c.href) {
            return (
              <Link
                key={c.key}
                href={c.href}
                aria-current={c.active ? "true" : undefined}
                className={`${base} ${edge} hover:border-[color:var(--hd-border-strong)]`}
              >
                {tile}
              </Link>
            );
          }
          return (
            <div key={c.key} className={`${base} ${edge}`}>
              {tile}
            </div>
          );
        })}
      </div>
    </section>
  );
}
