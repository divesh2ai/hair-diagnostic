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
    <header className="relative flex min-h-[204px] items-center overflow-hidden rounded-2xl border border-[color:var(--hd-border)] bg-gradient-to-br from-[color:var(--hd-champagne-tint)] via-[color:var(--hd-surface)] to-[color:var(--hd-surface)] px-6 py-8 shadow-[0_1px_2px_rgba(28,36,48,0.04)] sm:px-9">
      <HeroArtwork />

      <div className="relative flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6e562d]">
            {greetingTime}
          </p>
          <h1
            suppressHydrationWarning
            style={{ fontFamily: "var(--hd-font-display)" }}
            className="mt-1.5 text-[34px] leading-[1.02] tracking-tight text-[color:var(--hd-text)] sm:text-[46px]"
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

        <p
          style={{ fontFamily: "var(--hd-font-display)" }}
          className="hidden max-w-[15rem] text-right text-xl italic leading-snug text-[color:var(--hd-text-secondary)] sm:block"
        >
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

// Decorative hero background: the hand-traced flowing ribbons (ivory / cream /
// sage with twin champagne contour lines) that match the reference, plus the
// right-side editorial wash. Both are reused from the traced `decor` components
// — no silhouettes are redrawn here. Purely decorative, behind the greeting.
//
// The right third of the reference hero is a photographic stethoscope-on-desk
// still-life. No approved owned photo exists in the repo, so DoctorHeroComposition
// renders its warm-wash fallback: this is the one deliberate, documented visual
// mismatch vs. the reference (pass `src` once an asset is approved).
function HeroArtwork() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: "url(/doctor-art/doctor-hero-art.png)",
        backgroundSize: "cover",
        backgroundPosition: "right center",
        backgroundRepeat: "no-repeat",
      }}
    />
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
