"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { toDeckCard, type DeckQueueRow } from "@/lib/doctor/patientDeck";
import { PatientDeckCard } from "./PatientDeckCard";

// YOUR PATIENT DECK — a clinical action deck, not a marketing carousel.
//
// It shows the next few actionable patients, in the queue's own FIFO order, as
// a restrained stack: the front card is the next patient to review, and the
// cards fanned behind it are a physical signal that more are waiting. It is not
// the queue. Five cards maximum; the full backlog lives on the Review Queue,
// one click away.
//
// ── Interaction ─────────────────────────────────────────────────────────────
// Previous / next buttons, arrow keys, and pointer swipe on the front card all
// drive one index. No autoplay, no looping, no continuous animation. Position
// changes are a single 300ms CSS transition — chosen over a motion library for
// the stack because it re-targets reliably on every re-render and ships no
// runtime. prefers-reduced-motion drops both the swipe and the transition, so
// the deck simply swaps.

const MAX_CARDS = 5;

// Coverflow geometry. The active card sits in the centre; the other cards fan
// out to the LEFT and RIGHT of it, largest and most opaque nearest the centre.
// This is a spread, not a pile — the neighbours are clearly beside the active
// card, not stacked directly behind it.
const SIDE_BASE_X = 268; // px from centre for the first card on a side
const SIDE_GAP_X = 90; // additional px for each card further out
const SIDE_SCALE = 0.08; // scale lost per rank away from centre
const SIDE_OPACITY = 0.32; // opacity lost per rank away from centre
// How many cards may show on each side before the rest are parked (hidden).
const SIDE_VISIBLE = 2;

// Past this horizontal drag the release counts as a swipe.
const SWIPE_THRESHOLD = 80;

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
  const [active, setActive] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [dragDX, setDragDX] = useState(0);
  const dragStart = useRef<number | null>(null);
  const liveId = useId();

  // Read the user's motion preference on the client only, and keep it current.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // A shrinking or reordering deck must never leave the pointer past the end.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, cards.length - 1)));
  }, [cards.length]);

  const go = useCallback(
    (dir: -1 | 1) => {
      setActive((a) => Math.min(Math.max(a + dir, 0), cards.length - 1));
    },
    [cards.length],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    },
    [go],
  );

  // Pointer swipe on the front card. Disabled under reduced motion and for a
  // single-card deck. Uses pointer capture so a drag that leaves the card still
  // resolves.
  const onPointerDown = (e: ReactPointerEvent) => {
    if (reduce || cards.length < 2) return;
    dragStart.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (dragStart.current === null) return;
    setDragDX(e.clientX - dragStart.current);
  };
  const endDrag = () => {
    if (dragStart.current === null) return;
    const dx = dragDX;
    dragStart.current = null;
    setDragDX(0);
    if (dx <= -SWIPE_THRESHOLD) go(1);
    else if (dx >= SWIPE_THRESHOLD) go(-1);
  };

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

  const activeCard = cards[active];
  const dragging = dragStart.current !== null;

  // Assign every non-active card to the LEFT or RIGHT of the centre, filling
  // the sides alternately (nearest neighbour first) so both flanks are
  // populated even at the ends of the deck — the reference spread is symmetric,
  // not a one-sided pile. `side` is +1 (right) or -1 (left); `rank` is 0 for the
  // card nearest the centre on that side.
  const placement = new Map<number, { side: 1 | -1; rank: number }>();
  {
    const others = cards
      .map((_, i) => i)
      .filter((i) => i !== active)
      .sort((a, b) => Math.abs(a - active) - Math.abs(b - active) || a - b);
    let right = 0;
    let left = 0;
    for (const i of others) {
      if (right <= left) {
        placement.set(i, { side: 1, rank: right });
        right += 1;
      } else {
        placement.set(i, { side: -1, rank: left });
        left += 1;
      }
    }
  }

  return (
    // A sunken stage, not open page.
    //
    // The deck is a coverflow: at three or more waiting patients the flanking
    // cards fill the width, but at one it was a single card floating in a wide
    // emptiness that read as a layout accident. Giving the carousel its own
    // recessed ground makes the space around the card deliberate — a stage the
    // deck sits on — and keeps the section legible at every queue length.
    <div className="rounded-[28px] border border-[color:var(--hd-border)] bg-[color:var(--hd-surface-sunken)] px-4 pb-4 pt-6 sm:px-6">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Hair cases ready for review"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-[28px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-50"
      >
        {/* Clip boundary. `overflow-x: clip` stops a peeked card from ever
            widening the page on a narrow screen, while leaving the vertical
            drop shadow visible (unlike overflow-hidden, clip does not force the
            other axis to scroll). On desktop the track is far narrower than
            this boundary, so the peeks sit inside it and are never clipped. */}
        <div className="overflow-x-clip pb-2">
          {/* Centred track — narrower than the boundary, so the cards fanned to
              the left and right have room to spread at wide widths, and simply
              clip at the screen edge when there is none. */}
          <div className="relative mx-auto max-w-[480px]">
            {/* Height sizer — the active card, laid out but not painted, so the
                container is exactly as tall as the front card and never jumps as
                content differs between patients. */}
            <div className="invisible" aria-hidden>
            <PatientDeckCard
              card={activeCard}
              recommendedKits={activeCard.recommendedKits}
              tick={tick}
              interactive={false}
            />
          </div>

          {cards.map((card, i) => {
            const isActive = i === active;
            const slot = placement.get(i);
            const rank = slot ? slot.rank : 0;
            const dir = slot ? slot.side : 0;

            // Centre card follows the finger while dragging; side cards sit at a
            // fixed distance that grows with rank, shrinking and fading outward.
            const x = isActive ? dragDX : dir * (SIDE_BASE_X + rank * SIDE_GAP_X);
            const scale = isActive ? 1 : 1 - (rank + 1) * SIDE_SCALE;
            const opacity = isActive
              ? 1
              : rank >= SIDE_VISIBLE
                ? 0
                : 1 - (rank + 1) * SIDE_OPACITY;

            const style: CSSProperties = {
              transform: `translateX(${x}px) scale(${scale})`,
              opacity,
              // Centre always on top; nearer side cards above further ones.
              zIndex: isActive ? 30 : 20 - rank,
              pointerEvents: isActive ? "auto" : "none",
              // No transition while dragging (the card must track the finger),
              // none at all under reduced motion, otherwise a single eased move.
              transition:
                reduce || (isActive && dragging)
                  ? "none"
                  : "transform 300ms cubic-bezier(0.22,0.61,0.36,1), opacity 300ms ease",
            };

            const canSwipe = isActive && !reduce && cards.length > 1;

            return (
              <div
                key={card.id}
                className={`absolute inset-x-0 top-0 will-change-transform ${
                  canSwipe ? "cursor-grab active:cursor-grabbing touch-pan-y" : ""
                }`}
                style={style}
                onPointerDown={canSwipe ? onPointerDown : undefined}
                onPointerMove={canSwipe ? onPointerMove : undefined}
                onPointerUp={canSwipe ? endDrag : undefined}
                onPointerCancel={canSwipe ? endDrag : undefined}
              >
                <PatientDeckCard
                  card={card}
                  recommendedKits={card.recommendedKits}
                  tick={tick}
                  interactive={isActive}
                />
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Controls + position. Below the stack so nothing overlaps a card.
          There is no "View full queue" link here any more: the command band at
          the top of the page already carries it, and printing the same
          destination twice on one screen is how a doctor stops reading either
          one. */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={active === 0}
            aria-label="Previous patient"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-700 transition-colors hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={active >= cards.length - 1}
            aria-label="Next patient"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-700 transition-colors hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-1 text-sm tabular-nums text-stone-500" aria-hidden>
            <span className="font-medium text-slate-800">{active + 1}</span>
            {" / "}
            {cards.length}
          </span>
        </div>

      </div>

      {/* Screen-reader announcement of the current card. */}
      <p id={liveId} aria-live="polite" className="sr-only">
        Patient {active + 1} of {cards.length}: {activeCard.name}
        {activeCard.demographic ? `, ${activeCard.demographic}` : ""}, ready for review.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

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
          screen — the same reasoning that dropped the deck's own queue link
          in the non-empty state above. */}
    </div>
  );
}

function DeckSkeleton() {
  return (
    <div>
      <div className="animate-pulse rounded-3xl border border-stone-200 bg-white p-7">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 rounded-full bg-stone-100" />
          <div className="h-4 w-20 rounded bg-stone-100" />
        </div>
        <div className="mt-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-stone-100" />
          <div className="space-y-2.5">
            <div className="h-7 w-48 rounded bg-stone-100" />
            <div className="h-4 w-32 rounded bg-stone-100" />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <div className="h-6 w-24 rounded-full bg-stone-100" />
          <div className="h-6 w-20 rounded-full bg-stone-100" />
        </div>
        <div className="mt-5 h-4 w-64 rounded bg-stone-100" />
        <div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-5">
          <div className="h-4 w-28 rounded bg-stone-100" />
          <div className="h-10 w-36 rounded-full bg-stone-100" />
        </div>
      </div>
      <div className="mt-5 h-9 w-32 rounded-full bg-stone-100" />
    </div>
  );
}
