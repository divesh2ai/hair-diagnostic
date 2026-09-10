"use client";

import Link from "next/link";
import { ArrowRight, Clock, Package } from "lucide-react";
import { absoluteTimestamp, elapsedLabel } from "@/lib/format/waitingTime";
import { useHydrated } from "@/lib/format/useHydrated";
import type { ChipColor, DeckCardModel } from "@/lib/doctor/patientDeck";

// One clinical patient card — the front of the deck, and the geometry every
// card behind it borrows so nothing shifts as the stack advances.
//
// It carries only what a doctor needs BEFORE opening the review: who, how long
// they have waited, the clinical family, and the single action. No
// questionnaire, no narrative, no fabricated tags.

const CHIP_CLASS: Record<ChipColor, string> = {
  amber: "bg-amber-50 text-amber-800 ring-amber-200/70",
  violet: "bg-violet-50 text-violet-700 ring-violet-200/70",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  rose: "bg-rose-50 text-rose-700 ring-rose-200/70",
  sky: "bg-sky-50 text-sky-700 ring-sky-200/70",
  stone: "bg-stone-100 text-stone-600 ring-stone-200/70",
  red: "bg-red-50 text-red-700 ring-red-200/70",
};

// Soft avatar tints, chosen deterministically from the name so a patient keeps
// the same colour across refreshes. Decorative only — never encodes clinical
// meaning.
const AVATAR_TINTS = [
  "bg-rose-100 text-rose-500",
  "bg-sky-100 text-sky-600",
  "bg-violet-100 text-violet-600",
  "bg-amber-100 text-amber-600",
  "bg-emerald-100 text-emerald-600",
  "bg-teal-100 text-teal-600",
];

function avatarTint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}

export function PatientDeckCard({
  card,
  recommendedKits,
  tick,
  interactive,
}: {
  card: DeckCardModel;
  /** From the RECOMMENDATIONS artifact upstream; null hides the line honestly. */
  recommendedKits: number | null;
  /** Minute clock — read only, so waiting text re-renders without a request. */
  tick: number;
  /**
   * Front card is interactive (real link + focus). Cards behind it are inert
   * and aria-hidden so the deck exposes exactly one action to keyboard and
   * screen-reader users.
   */
  interactive: boolean;
}) {
  void tick;
  // The deck now server-renders (see app/doctor/page.tsx), so anything the two
  // runtimes format differently has to wait for the browser. The tooltip is a
  // `toLocaleString`, which the server would render in UTC and in ITS locale;
  // the elapsed label is UTC arithmetic against `Date.now()`, correct on both
  // sides but read a moment apart, so a minute-level value can legitimately
  // differ by one. The first is withheld until hydration, the second is
  // allowed to differ.
  const hydrated = useHydrated();

  return (
    <div
      className="flex h-full flex-col justify-between overflow-hidden rounded-[24px] border border-stone-200/70 bg-white p-6 shadow-[0_2px_4px_rgba(15,23,42,0.03),0_28px_56px_-32px_rgba(15,23,42,0.30)] sm:p-7"
      aria-hidden={interactive ? undefined : true}
    >
      <div className="space-y-5">
        {/* Status + waiting */}
        <div className="flex items-start justify-between gap-4">
          <span className="inline-flex items-center rounded-full border border-amber-300/80 bg-amber-50/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
            Ready for review
          </span>
          <span
            className="flex shrink-0 items-start gap-1.5 text-right text-stone-400"
            title={
              hydrated && card.submittedAt
                ? `Submitted ${absoluteTimestamp(card.submittedAt)}`
                : undefined
            }
          >
            <Clock className="mt-0.5 h-3.5 w-3.5" aria-hidden />
            <span className="leading-tight">
              <span suppressHydrationWarning className="block text-[13px] font-semibold text-stone-600">
                {card.submittedAt ? elapsedLabel(card.submittedAt) : "—"}
              </span>
              <span className="block text-[11px]">waiting</span>
            </span>
          </span>
        </div>

        {/* Identity */}
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTint(
              card.name,
            )}`}
          >
            {card.initials}
          </span>
          <div className="min-w-0">
            <p className="font-serif text-[22px] leading-tight text-slate-900">
              <span className="align-middle">{card.name}</span>
              {card.demographic && (
                <span className="text-[17px] text-stone-400"> · {card.demographic}</span>
              )}
            </p>
            {/* No "Assessment completed" line here.
                Every card in this deck is by definition a submitted assessment
                waiting for review, and the badge two rows up already says
                "Ready for review". A second, vaguer restatement of the same
                fact is text the doctor has to read and learn nothing from. The
                clinic the case belongs to is a fact this row did NOT carry, and
                on a multi-branch account that is the one thing missing. */}
            {card.clinicName && (
              <p className="mt-0.5 truncate text-sm text-stone-500">{card.clinicName}</p>
            )}
          </div>
        </div>

        {/* Clinical chips — real signals only, colour-coded by family */}
        {card.chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {card.chips.map((chip) => (
              <span
                key={`${chip.tone}-${chip.label}`}
                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] ring-1 ${
                  CHIP_CLASS[chip.color]
                }`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}

        {/* One deterministic interpretation line, or a truthful fallback */}
        <p className="text-[15px] leading-relaxed text-stone-600">
          {card.interpretation ??
            "Assessment complete and awaiting your clinical read."}
          {card.attention?.reason ? (
            <span className="mt-1 block text-sm text-red-700">
              {card.attention.reason}
            </span>
          ) : null}
        </p>
      </div>

      {/* Footer: recommendation count + primary action */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-stone-100 pt-4">
        {recommendedKits != null && recommendedKits > 0 ? (
          <span className="flex items-center gap-2 text-sm text-stone-500">
            <Package className="h-4 w-4 text-stone-400" aria-hidden />
            {recommendedKits} recommended {recommendedKits === 1 ? "kit" : "kits"}
          </span>
        ) : (
          <span aria-hidden />
        )}

        {interactive ? (
          <Link
            href={card.href}
            aria-label={`Review ${card.name}`}
            className="group/btn inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2"
          >
            Review patient
            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
          </Link>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-900/90 px-6 py-3 text-sm font-medium text-white">
            Review patient
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
