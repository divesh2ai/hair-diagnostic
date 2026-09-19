"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, RotateCcw } from "lucide-react";
import { elapsedLabel } from "@/lib/format/waitingTime";
import { useHydrated } from "@/lib/format/useHydrated";
import type { DeckCardModel } from "@/lib/doctor/patientDeck";

// One clinical patient card — the front of the deck, and the geometry every
// card behind it borrows so nothing shifts as the stack advances.
//
// V2: the whole card is the "Review patient" target (not just its footer
// button), and it flips to a second face with the same signals uncapped. The
// flip is a second, small, independent control — not a second navigation
// target: the stretched link lives on the "Review →" row on EITHER face, so
// clicking anywhere else on the card still goes to Review, per the brief's
// "clicking either side opens the same review".
//
// It carries only what a doctor needs BEFORE opening the review: who, how
// long they have waited, the clinical family, and the single action. No
// questionnaire, no narrative, no fabricated tags, no invented kit names —
// the deck query has a kit COUNT, never kit identities, so that is all either
// face claims to know.

const STATUS_ACTION: Record<DeckCardModel["status"], string> = {
  // The deck's own query only ever returns Review Queue rows — see
  // lib/doctor/patientDeck's own header — so "ready" is the only status a
  // card actually carries today. The other three read correctly the moment
  // (if ever) this deck is extended to source Approved/Ordered/Shared rows;
  // nothing here needs to change to support that, only the query does.
  ready: "Review",
};

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
   * Front card is interactive (real link + focus, and the only one that can
   * flip). Cards behind it are inert and aria-hidden so the deck exposes
   * exactly one action to keyboard and screen-reader users.
   */
  interactive: boolean;
}) {
  void tick;
  const hydrated = useHydrated();
  const [flipped, setFlipped] = useState(false);

  const actionLabel = STATUS_ACTION[card.status] ?? "Review";
  const waitLabel = hydrated && card.submittedAt ? elapsedLabel(card.submittedAt) : null;

  return (
    <div
      className="v2-flip-scene relative h-full"
      aria-hidden={interactive ? undefined : true}
    >
      <div className="v2-flip-inner" data-flipped={interactive && flipped ? "true" : "false"}>
        <CardFace side="front">
          <FrontFace card={card} recommendedKits={recommendedKits} waitLabel={waitLabel} interactive={interactive} actionLabel={actionLabel} />
        </CardFace>
        <CardFace side="back">
          <BackFace card={card} recommendedKits={recommendedKits} interactive={interactive} actionLabel={actionLabel} />
        </CardFace>
      </div>

      {interactive && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFlipped((f) => !f);
          }}
          aria-label={flipped ? "Show summary" : "Show clinical signals"}
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full border border-[color:var(--v2-border-default)] bg-[color:var(--surface-elevated)] text-[color:var(--ink-tertiary)] transition-colors hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
        >
          {flipped ? <RotateCcw className="size-3.5" aria-hidden /> : <Info className="size-3.5" aria-hidden />}
        </button>
      )}
    </div>
  );
}

function CardFace({ side, children }: { side: "front" | "back"; children: React.ReactNode }) {
  return (
    <div
      className={`v2-flip-face ${side === "back" ? "v2-flip-face-back" : ""} relative flex h-full flex-col justify-between overflow-hidden rounded-[20px] border border-[color:var(--v2-border-default)] bg-[color:var(--surface-elevated)] p-6 shadow-[0_1px_2px_rgba(20,35,31,0.04),0_18px_36px_-28px_rgba(20,35,31,0.22)] sm:p-7`}
    >
      {children}
    </div>
  );
}

function ReviewRow({
  card,
  interactive,
  actionLabel,
}: {
  card: DeckCardModel;
  interactive: boolean;
  actionLabel: string;
}) {
  return (
    <div className="relative mt-6 flex items-center justify-between gap-4 border-t border-[color:var(--v2-border-subtle)] pt-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--status-attention)]">
        Needs review
      </span>
      {interactive ? (
        <Link
          href={card.href}
          aria-label={`${actionLabel} ${card.name}`}
          // Stretched link — same technique the Review Queue row already
          // uses: `::after` is `position: absolute; inset: 0`, and its
          // nearest positioned ancestor is CardFace (`relative`), not this
          // small row, so the pseudo-element covers the FULL card face
          // exactly, however small the visible link text is. The flip
          // button is a sibling with its own higher z-index, so it stays
          // independently clickable above it.
          className="group/btn relative z-0 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-[color:var(--brand-primary)] after:absolute after:inset-0 after:content-['']"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </Link>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-[color:var(--brand-primary)]">
          {actionLabel}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      )}
    </div>
  );
}

function FrontFace({
  card,
  recommendedKits,
  waitLabel,
  interactive,
  actionLabel,
}: {
  card: DeckCardModel;
  recommendedKits: number | null;
  waitLabel: string | null;
  interactive: boolean;
  actionLabel: string;
}) {
  return (
    <>
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-4">
          <p className="min-w-0 truncate font-serif text-[22px] leading-tight text-[color:var(--ink-primary)]">
            {card.name.toUpperCase()}
            {card.demographic && (
              <span className="text-[16px] text-[color:var(--ink-tertiary)]"> · {card.demographic}</span>
            )}
          </p>
          {waitLabel && (
            <span
              suppressHydrationWarning
              className="shrink-0 text-[13px] tabular-nums text-[color:var(--ink-tertiary)]"
            >
              {waitLabel}
            </span>
          )}
        </div>

        {card.chips.length > 0 && (
          <p className="text-[13px] font-medium text-[color:var(--ink-secondary)]">
            {card.chips.map((c) => c.label).join(" · ")}
          </p>
        )}

        <p className="text-[15px] leading-relaxed text-[color:var(--ink-secondary)]">
          {card.interpretation ?? "Assessment complete and awaiting your clinical read."}
        </p>
        {card.attention?.reason && (
          <p className="text-sm font-medium text-[color:var(--status-critical)]">{card.attention.reason}</p>
        )}

        {recommendedKits != null && recommendedKits > 0 && (
          <p className="text-sm text-[color:var(--ink-tertiary)]">
            {recommendedKits} treatment {recommendedKits === 1 ? "kit" : "kits"} proposed
          </p>
        )}
      </div>

      <ReviewRow card={card} interactive={interactive} actionLabel={actionLabel} />
    </>
  );
}

function BackFace({
  card,
  recommendedKits,
  interactive,
  actionLabel,
}: {
  card: DeckCardModel;
  recommendedKits: number | null;
  interactive: boolean;
  actionLabel: string;
}) {
  return (
    <>
      <div className="space-y-4">
        <p className="v2-eyebrow">{card.name}</p>

        <div>
          <p className="v2-eyebrow mb-1.5">Key signals</p>
          {card.chips.length > 0 ? (
            <ul className="space-y-1">
              {card.chips.map((c) => (
                <li key={`${c.tone}-${c.label}`} className="text-[14px] text-[color:var(--ink-primary)]">
                  {c.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[color:var(--ink-tertiary)]">No flagged signals on file.</p>
          )}
        </div>

        <div>
          <p className="v2-eyebrow mb-1.5">Proposed treatment</p>
          <p className="text-[14px] text-[color:var(--ink-primary)]">
            {recommendedKits != null && recommendedKits > 0
              ? `${recommendedKits} treatment ${recommendedKits === 1 ? "kit" : "kits"} proposed — see the full plan on review.`
              : "Not yet generated."}
          </p>
        </div>

        {card.clinicName && (
          <p className="text-[13px] text-[color:var(--ink-tertiary)]">{card.clinicName}</p>
        )}
      </div>

      <ReviewRow card={card} interactive={interactive} actionLabel={actionLabel} />
    </>
  );
}
