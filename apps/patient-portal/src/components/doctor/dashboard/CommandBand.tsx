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
    <header className="relative flex min-h-[188px] items-center overflow-hidden rounded-2xl border border-[color:var(--hd-border)] bg-gradient-to-br from-[color:var(--hd-champagne-tint)] via-[color:var(--hd-surface)] to-[color:var(--hd-surface)] px-6 py-7 shadow-[0_1px_2px_rgba(28,36,48,0.04)] sm:px-9">
      <HeroArtwork />

      <div className="relative flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--hd-eyebrow-ink)]">
            {greetingTime}
          </p>
          <h1
            suppressHydrationWarning
            className="mt-1.5 font-serif text-[34px] leading-[1.02] tracking-tight text-[color:var(--hd-text)] sm:text-[46px]"
          >
            {name}.
          </h1>
          <span className="mt-3 block h-[3px] w-14 rounded-full bg-[color:var(--hd-champagne)]" />
          <p
            suppressHydrationWarning
            className="mt-3 text-sm text-[color:var(--hd-text-muted)]"
          >
            {dateLabel}
          </p>
        </div>

        <p className="hidden max-w-[15rem] text-right font-serif text-xl italic leading-snug text-[color:var(--hd-text-secondary)] sm:block">
          Care today
          <br />
          for healthier
          <br />
          tomorrows
        </p>
      </div>
    </header>
  );
}

// Flowing cream/sage ribbons with thin champagne contour lines, plus a faint
// botanical + stethoscope motif on the right — drawn as controlled SVG paths
// (never icons or a stock photo) so it stays crisp and carries no license. It
// sits behind the greeting at low opacity and is purely decorative.
function HeroArtwork() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Ribbon bands sweeping across the whole band. */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 220"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <path
          d="M-40 150 C 240 70, 470 196, 760 120 S 1180 70, 1260 126 L 1260 240 L -40 240 Z"
          fill="var(--hd-scalp-tint)"
          opacity="0.5"
        />
        <path
          d="M-40 178 C 300 112, 590 214, 900 150 S 1200 118, 1260 168 L 1260 240 L -40 240 Z"
          fill="var(--hd-champagne-tint)"
          opacity="0.85"
        />
        <path
          d="M-40 140 C 240 62, 500 188, 800 104 S 1210 64, 1280 120"
          stroke="var(--hd-champagne)"
          strokeWidth="1"
          opacity="0.55"
        />
        <path
          d="M-40 166 C 280 96, 600 206, 900 138 S 1210 102, 1280 152"
          stroke="var(--hd-champagne)"
          strokeWidth="0.8"
          opacity="0.35"
        />
      </svg>

      {/* Faint clinic motif, right side: a plant and a suggestion of a
          stethoscope, echoing the reference photo without using one. */}
      <svg
        className="absolute right-6 top-1/2 hidden h-[150px] -translate-y-1/2 opacity-[0.16] md:block"
        viewBox="0 0 160 150"
        fill="none"
      >
        {/* stethoscope */}
        <path
          d="M30 24 C 30 70, 64 92, 86 78 C 104 66, 100 44, 100 30"
          stroke="var(--hd-text-secondary)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="30" cy="20" r="5" stroke="var(--hd-text-secondary)" strokeWidth="3" />
        <circle cx="100" cy="26" r="5" stroke="var(--hd-text-secondary)" strokeWidth="3" />
        <circle cx="92" cy="104" r="15" stroke="var(--hd-text-secondary)" strokeWidth="3" />
        <circle cx="92" cy="104" r="6" fill="var(--hd-text-secondary)" />
        {/* potted plant */}
        <path d="M128 150 L121 118 L151 118 L144 150 Z" fill="var(--hd-scalp-edge)" />
        <path
          d="M136 118 C 136 96, 124 86, 116 82 C 128 86, 136 100, 136 118"
          fill="var(--hd-scalp-ink)"
        />
        <path
          d="M136 118 C 136 92, 150 82, 160 80 C 148 88, 140 100, 136 118"
          fill="var(--hd-scalp-ink)"
        />
        <path
          d="M136 118 C 134 98, 136 84, 138 74 C 140 86, 140 102, 138 118"
          fill="var(--hd-scalp-ink)"
        />
      </svg>
    </div>
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
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--hd-eyebrow-ink)]">
        Patients requiring your attention
      </h2>
      {/* One white strip, four equal groups split by hairline rules — not four
          separate cards. */}
      <div className="grid grid-cols-2 divide-[color:var(--hd-border)] overflow-hidden rounded-2xl border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)] shadow-[0_1px_2px_rgba(28,36,48,0.04)] [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-[color:var(--hd-border)] sm:grid-cols-4 sm:[&>*:nth-child(n+3)]:border-t-0 sm:[&>*:not(:first-child)]:border-l sm:[&>*:not(:first-child)]:border-[color:var(--hd-border)]">
        {counts.map((c) => {
          const style = TILE_STYLE[c.key] ?? FALLBACK_TILE;
          const Icon = style.icon;
          const inner = (
            <div className="flex items-center gap-3.5 px-5 py-5">
              <span
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: style.tint, color: style.ink }}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[28px] font-semibold leading-none tabular-nums text-[color:var(--hd-text)]">
                  {c.value}
                </span>
                <span className="mt-1.5 block truncate text-[13px] text-[color:var(--hd-text-muted)]">
                  {c.label}
                </span>
              </span>
            </div>
          );
          if (c.href) {
            return (
              <Link
                key={c.key}
                href={c.href}
                aria-current={c.active ? "true" : undefined}
                className="transition-colors hover:bg-[color:var(--hd-surface-alt)]"
              >
                {inner}
              </Link>
            );
          }
          return <div key={c.key}>{inner}</div>;
        })}
      </div>
    </section>
  );
}
