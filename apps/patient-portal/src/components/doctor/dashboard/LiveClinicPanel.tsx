"use client";

import { elapsedLabel } from "@/lib/format/waitingTime";
import type { InClinicVisit } from "@/lib/doctor/clinicVisits";

// LIVE IN CLINIC — who is in the building answering questions right now.
//
// ── Honesty note ────────────────────────────────────────────────────────────
// The concept shows per-patient workflow states (Filling assessment /
// Generating report / Uploading images) and per-row sparklines. The data does
// not support that: an open ClinicVisit carries a name and a start time and
// nothing else. Inventing distinct states or per-patient measurements would be
// fabricating backend events. So every row reads the one true state — an
// assessment in progress — and the sparkline is a single fixed decorative motif
// meaning "this session is live", identical on every row, not a chart of any
// per-patient value.

const PREVIEW = 6;

// Soft avatar tints, deterministic per name (decorative only).
const TINTS = [
  "bg-rose-100 text-rose-500",
  "bg-sky-100 text-sky-600",
  "bg-violet-100 text-violet-600",
  "bg-amber-100 text-amber-600",
  "bg-emerald-100 text-emerald-600",
  "bg-teal-100 text-teal-600",
];
function tint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

export function LiveClinicPanel({
  visits,
  total,
  tick,
}: {
  visits: InClinicVisit[];
  total: number;
  /** Minute clock — read only, keeps "started N ago" current. */
  tick: number;
}) {
  void tick;
  const shown = visits.slice(0, PREVIEW);
  const overflow = total - shown.length;

  return (
    <section
      aria-labelledby="live-clinic-heading"
      className="flex h-full flex-col rounded-2xl border border-stone-200/70 bg-white p-5"
    >
      <div className="flex items-center gap-2">
        <h2
          id="live-clinic-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
        >
          Live in clinic
        </h2>
        {total > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[11px] font-semibold tabular-nums text-emerald-700">
            {total}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-sm text-stone-400">No active clinic sessions.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-1">
          {shown.map((visit) => (
            <li
              key={visit.id}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-stone-50"
            >
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${tint(
                  visit.displayName,
                )}`}
              >
                {initialsOf(visit.displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {visit.displayName}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/60 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="truncate">Filling assessment</span>
                </p>
              </div>
              {/* Server-rendered now, and read a moment later in the browser:
                  a minute-level elapsed value may legitimately differ by one
                  between the two renders. */}
              <span suppressHydrationWarning className="shrink-0 text-xs tabular-nums text-stone-400">
                {elapsedLabel(visit.startedAt)}
              </span>
              <Sparkline />
            </li>
          ))}
          {overflow > 0 && (
            <li className="px-2 pt-1 text-xs text-stone-400">
              +{overflow} more in clinic
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

// A fixed decorative "live" motif. Identical on every row on purpose — it does
// not chart any per-patient value, it just signals an active session.
function Sparkline() {
  return (
    <svg
      className="hidden h-5 w-16 shrink-0 text-emerald-500 sm:block"
      viewBox="0 0 64 20"
      fill="none"
      aria-hidden
    >
      <polyline
        points="0,14 8,12 14,15 20,6 28,13 34,9 42,16 48,7 56,12 64,10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "•"
  );
}
