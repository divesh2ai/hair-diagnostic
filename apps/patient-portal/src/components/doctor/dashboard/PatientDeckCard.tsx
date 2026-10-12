"use client";

import Link from "next/link";
import { ArrowRight, Clock, Package } from "lucide-react";
import { useHydrated } from "@/lib/format/useHydrated";
import type { DeckCardModel } from "@/lib/doctor/patientDeck";

// One clinical patient card — the dominant front of the deck, and the geometry
// every card behind it borrows so nothing shifts as the stack advances.
//
// Composition matches the Patient Deck reference: a status chip + waiting time
// on top, the patient identity with an initials avatar, their clinical tags and
// the one-line clinical read, and a footer carrying the recommended-kit count
// and a single prominent "Review patient" action. The whole card is the review
// target (stretched link on the button), so clicking anywhere opens the review.
//
// It carries only what a doctor needs BEFORE opening the review: who, how long
// they have waited, the clinical family, and the single action. No fabricated
// tags, no invented kit names — the deck query has a kit COUNT, never kit
// identities, so that is all the card claims to know.

const STATUS_LABEL: Record<DeckCardModel["status"], string> = {
  // The deck query only ever returns Review Queue rows, so "ready" is the only
  // status today; it reads as "Ready for review".
  ready: "Ready for review",
};

/** Compact "waiting" value from the real submission time — presentation only,
 *  no fabricated data. Gated behind hydration (like all time formatting) so the
 *  server and client never disagree. */
function compactSince(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr`;
  const days = Math.floor(hrs / 24);
  return `${days} d`;
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
   * The front card is interactive (real link + focus). Cards behind it are
   * inert and aria-hidden so the deck exposes exactly one action to keyboard
   * and screen-reader users.
   */
  interactive: boolean;
}) {
  void tick;
  const hydrated = useHydrated();
  const waiting = hydrated && card.submittedAt ? compactSince(card.submittedAt) : null;

  return (
    <div
      aria-hidden={interactive ? undefined : true}
      className="relative flex h-full flex-col justify-between overflow-hidden rounded-[22px] border border-[color:var(--v2-border-default)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_1px_2px_rgba(20,35,31,0.04),0_22px_44px_-30px_rgba(20,35,31,0.26)] sm:p-7"
    >
      <div className="space-y-4">
        {/* Status chip + waiting time */}
        <div className="flex items-start justify-between gap-4">
          <span className="inline-flex items-center rounded-full border border-[#e3c9a3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--status-attention)]">
            {STATUS_LABEL[card.status] ?? "Ready for review"}
          </span>
          {waiting && (
            <div
              suppressHydrationWarning
              className="flex shrink-0 items-start gap-1.5 text-[color:var(--ink-tertiary)]"
            >
              <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <div className="text-right leading-tight">
                <div className="text-[13px] tabular-nums text-[color:var(--ink-secondary)]">{waiting}</div>
                <div className="text-[11px]">waiting</div>
              </div>
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e8efe4] text-[14px] font-semibold text-[#3f6b54]"
          >
            {card.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[20px] leading-tight text-[color:var(--ink-primary)]" style={{ fontFamily: "var(--hd-font-display)" }}>
              {card.name}
              {card.demographic && (
                <span className="text-[15px] text-[color:var(--ink-tertiary)]"> · {card.demographic}</span>
              )}
            </p>
            <p className="text-[13px] text-[color:var(--ink-tertiary)]">Assessment completed</p>
          </div>
        </div>

        {/* Clinical tags */}
        {card.chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {card.chips.map((c) => {
              const tone =
                c.tone === "attention"
                  ? "bg-[#fcecea] text-[#a63c34]"
                  : c.tone === "severity"
                    ? "bg-[#efece5] text-[#6b6356]"
                    : "bg-[#e8efe4] text-[#4f6b54]";
              return (
                <span
                  key={`${c.tone}-${c.label}`}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${tone}`}
                >
                  {c.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Clinical summary — clamped so a very long diagnosis never breaks the
            deck height. */}
        <p className="line-clamp-3 text-[15px] leading-relaxed text-[color:var(--ink-secondary)]">
          {card.interpretation ?? "Assessment complete and awaiting your clinical read."}
        </p>
        {card.attention?.reason && (
          <p className="text-sm font-medium text-[color:var(--status-critical)]">{card.attention.reason}</p>
        )}
      </div>

      {/* Footer: kit count + prominent Review action */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-[color:var(--v2-border-subtle)] pt-4">
        <span className="inline-flex items-center gap-2 text-[13px] text-[color:var(--ink-tertiary)]">
          <Package className="size-4 shrink-0" aria-hidden />
          {recommendedKits != null && recommendedKits > 0
            ? `${recommendedKits} recommended ${recommendedKits === 1 ? "kit" : "kits"}`
            : "Kits pending"}
        </span>
        {interactive ? (
          <Link
            href={card.href}
            aria-label={`Review patient ${card.name}`}
            // Stretched link: `::after` covers the whole card (the nearest
            // positioned ancestor is this card root, which is `relative`), so a
            // click anywhere opens the review while the button reads as the CTA.
            className="group/btn inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#164c46] after:absolute after:inset-0 after:content-['']"
          >
            Review patient
            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
          </Link>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
            Review patient
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}
