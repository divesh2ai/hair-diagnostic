"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { toDeckCard, type DeckQueueRow } from "@/lib/doctor/patientDeck";
import { PatientDeckCard } from "./PatientDeckCard";

// YOUR PATIENT DECK — a clinical action grid, not a marketing carousel.
//
// It shows the next few actionable patients, in the queue's own FIFO order, as
// a clean responsive grid: every patient is a complete, independent, clickable
// card. Two cards per row where there is room, one column on narrower screens.
// It is not the full queue — five cards maximum; the backlog lives on the
// Review Queue, one click away (the command band carries that link).
//
// Each card (see PatientDeckCard) is fully self-contained: name + age, waiting
// time, clinical tags, the clinical read, the proposed-kit count, a "Needs
// review" status, and a stretched "Review" action that makes the whole card
// the review target. Cards in a row share an equal height; none overlaps
// another.

const MAX_CARDS = 5;

export function PatientDeck({
  rows,
  tick,
  loading,
  error,
  approvedToday,
  inProgress,
  onRetry,
}: {
  rows: DeckQueueRow[];
  tick: number;
  loading: boolean;
  error: boolean;
  approvedToday: number;
  inProgress: number;
  onRetry: () => void;
}) {
  const cards = rows.slice(0, MAX_CARDS).map(toDeckCard);

  if (loading) return <DeckSkeleton />;
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-amber-200 bg-amber-50/60 px-6 py-10 text-center"
      >
        <p className="font-medium text-slate-900">Your patient deck is unavailable</p>
        <p className="mt-1 text-sm text-stone-600">We couldn&rsquo;t refresh your queue.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    );
  }
  if (cards.length === 0) {
    return <DeckEmpty approvedToday={approvedToday} inProgress={inProgress} />;
  }

  // Responsive grid: 1 column on narrow/tablet widths, 2 columns where there is
  // room. `items-stretch` (the grid default) + the card's own `h-full` give
  // every card in a row the same height, with the Review row pinned to the
  // bottom. `min-w-0` lets long names/diagnoses truncate instead of forcing an
  // overflow.
  return (
    <ul className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
      {cards.map((card) => (
        <li key={card.id} className="min-w-0">
          <PatientDeckCard
            card={card}
            recommendedKits={card.recommendedKits}
            tick={tick}
            interactive
          />
        </li>
      ))}
    </ul>
  );
}

/* ────────────────────────────────────────────────────────────── */

function DeckEmpty({
  approvedToday,
  inProgress,
}: {
  approvedToday: number;
  inProgress: number;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      </div>
      <p className="mt-4 font-serif text-xl text-slate-900">You&rsquo;re all caught up</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-stone-500">
        {inProgress > 0
          ? `No patients are waiting for review — ${inProgress} ${
              inProgress === 1 ? "is" : "are"
            } still completing an assessment.`
          : "No patients are waiting for your clinical review."}
        {approvedToday > 0 &&
          ` You've approved ${approvedToday} ${
            approvedToday === 1 ? "case" : "cases"
          } today.`}
      </p>
      {/* Deliberately no review-queue link here. An empty deck only ever
          renders alongside the command band's own queue-opening CTA (both
          are driven by the same empty-queue condition), so a second link to
          the same destination would print the identical action twice on one
          screen. */}
    </div>
  );
}

function DeckSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2" aria-hidden>
      {[0, 1].map((i) => (
        <li
          key={i}
          className="animate-pulse rounded-[20px] border border-stone-200 bg-white p-6 sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="h-7 w-48 rounded bg-stone-100" />
            <div className="h-4 w-14 rounded bg-stone-100" />
          </div>
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-24 rounded-full bg-stone-100" />
            <div className="h-6 w-20 rounded-full bg-stone-100" />
          </div>
          <div className="mt-4 h-4 w-64 rounded bg-stone-100" />
          <div className="mt-2 h-4 w-40 rounded bg-stone-100" />
          <div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-4">
            <div className="h-4 w-28 rounded bg-stone-100" />
            <div className="h-5 w-20 rounded bg-stone-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
