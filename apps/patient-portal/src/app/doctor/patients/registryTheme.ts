// How the patient registry PAINTS a standing. What a standing means lives in
// lib/doctor/clinicalStanding and is shared with every other doctor surface.
//
// ── Everything here resolves to a doctor token ──────────────────────────────
// No Tailwind palette colour appears below. The values are `var(--hd-st-*)`
// from styles/doctor-tokens.css, which the page opts into with
// `data-surface="doctor"` — the same layer the Doctor Review page uses. That is
// what makes the registry and the review screen look like one product instead
// of two, and it means a palette change happens in one file rather than in
// however many components happened to hard-code `emerald-500`.
//
// ── One hue, one meaning ────────────────────────────────────────────────────
//   done     your clinical work is finished — a human approved the report
//   action   YOU are the blocker — a finished report is waiting to be read
//   working  the system is busy; nothing is owed by anyone
//   fail     failed or refused
//   future   scheduled — appointments, and nothing else
//   idle     nothing has happened yet
//
// ── Colour is never the only signal ─────────────────────────────────────────
// Every tone carries a text label beside it, and every calendar dot is
// duplicated in the cell's aria-label. A doctor with a colour-vision deficiency
// reads exactly the same page; the hue only makes scanning faster.

import {
  standingOf,
  type Standing,
  type StandingInfo,
} from "@/lib/doctor/clinicalStanding";

export {
  standingOf,
  nextActionOf,
  compareByPriority,
  type Standing,
  type StandingInfo,
  type NextAction,
  type CaseFacts,
} from "@/lib/doctor/clinicalStanding";

export type ToneKey = "done" | "action" | "working" | "fail" | "future" | "idle";

export interface ToneStyle {
  /** Chip: tinted fill, coloured ink, hairline edge. */
  pill: string;
  /** 6px status dot on a light surface. */
  dot: string;
  /** The same dot on the selected (dark) calendar cell. */
  dotOnDark: string;
  /** Left spine on a row. */
  spine: string;
  /** Ink alone, for a label on white. */
  ink: string;
}

// Written out in full, one literal string per class, and NOT assembled by a
// helper — which was the first version and produced a page with no colour on
// it at all. Tailwind generates utilities by scanning source text for class
// names; a class built at runtime from `bg-[${tint}]` never appears in the
// source, so nothing is emitted and every chip renders transparent. The
// repetition below is the price of a build step that reads files rather than
// running them.
//
// The dark-cell variants are palette literals rather than tokens: they exist
// only on the selected calendar cell, and deriving a legible tint of each ink
// against a near-black ground needs `color-mix` support we cannot yet assume
// across the browsers clinics actually run.
export const TONES: Record<ToneKey, ToneStyle> = {
  done: {
    pill: "bg-[var(--hd-st-done-tint)] text-[var(--hd-st-done-ink)] ring-1 ring-inset ring-[var(--hd-st-done-edge)]",
    dot: "bg-[var(--hd-st-done-ink)]",
    dotOnDark: "bg-emerald-300",
    spine: "bg-[var(--hd-st-done-edge)]",
    ink: "text-[var(--hd-st-done-ink)]",
  },
  action: {
    pill: "bg-[var(--hd-st-action-tint)] text-[var(--hd-st-action-ink)] ring-1 ring-inset ring-[var(--hd-st-action-edge)]",
    dot: "bg-[var(--hd-st-action-ink)]",
    dotOnDark: "bg-amber-300",
    spine: "bg-[var(--hd-st-action-edge)]",
    ink: "text-[var(--hd-st-action-ink)]",
  },
  working: {
    pill: "bg-[var(--hd-st-working-tint)] text-[var(--hd-st-working-ink)] ring-1 ring-inset ring-[var(--hd-st-working-edge)]",
    dot: "bg-[var(--hd-st-working-ink)]",
    dotOnDark: "bg-cyan-300",
    spine: "bg-[var(--hd-st-working-edge)]",
    ink: "text-[var(--hd-st-working-ink)]",
  },
  fail: {
    pill: "bg-[var(--hd-st-fail-tint)] text-[var(--hd-st-fail-ink)] ring-1 ring-inset ring-[var(--hd-st-fail-edge)]",
    dot: "bg-[var(--hd-st-fail-ink)]",
    dotOnDark: "bg-rose-300",
    spine: "bg-[var(--hd-st-fail-edge)]",
    ink: "text-[var(--hd-st-fail-ink)]",
  },
  future: {
    pill: "bg-[var(--hd-st-future-tint)] text-[var(--hd-st-future-ink)] ring-1 ring-inset ring-[var(--hd-st-future-edge)]",
    dot: "bg-[var(--hd-st-future-ink)]",
    dotOnDark: "bg-violet-300",
    spine: "bg-[var(--hd-st-future-edge)]",
    ink: "text-[var(--hd-st-future-ink)]",
  },
  idle: {
    pill: "bg-[var(--hd-st-idle-tint)] text-[var(--hd-st-idle-ink)] ring-1 ring-inset ring-[var(--hd-st-idle-edge)]",
    dot: "bg-[var(--hd-st-idle-ink)]",
    dotOnDark: "bg-stone-400",
    spine: "bg-[var(--hd-st-idle-edge)]",
    ink: "text-[var(--hd-st-idle-ink)]",
  },
};

/** The domain standing a surface renders, mapped to the hue that paints it. */
export const TONE_FOR_STANDING: Record<Standing, ToneKey> = {
  REVIEWED: "done",
  AWAITING_REVIEW: "action",
  PROCESSING: "working",
  ATTENTION: "fail",
  NONE: "idle",
};

/** Convenience: classify and pick the paint in one call. */
export function toneOf(info: StandingInfo): ToneStyle {
  return TONES[TONE_FOR_STANDING[info.standing]];
}

/**
 * The order tones are shown in when several share one surface — a calendar cell
 * summarising a whole day, for instance.
 *
 * Most actionable first, matching the registry's own sort. A day holding both
 * an approved case and one still waiting on the doctor leads with the amber,
 * because the only reason to scan a month at speed is to find work not done.
 */
export const TONE_PRIORITY: ToneKey[] = [
  "action",
  "fail",
  "working",
  "done",
  "idle",
];

// ── Type scale ──────────────────────────────────────────────────────────────
//
// Inter throughout, inherited from `--hd-font` on the doctor surface. The
// display serif is deliberately absent: `.hd-headline` states a clinical
// finding about one patient and earns a serif, but this is a worklist a doctor
// opens forty times a day, and an editorial hero heading on it read as an
// article about patients rather than a place to work.
//
// Every count, time and date carries `tabular-nums`. Figures that change on a
// refresh must not reflow the row they sit in; a column of dates that jitters
// as the clock ticks is the kind of small wrongness that erodes trust in a tool
// without anyone being able to say why.
export const TYPE = {
  /** Section eyebrow. Uppercase, tracked, never more than four words. */
  eyebrow:
    "text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--hd-text-muted)]",
  /** A card or panel heading. */
  title:
    "text-[19px] font-semibold leading-snug tracking-[-0.011em] text-[var(--hd-text)]",
  /** A patient's name in a row. */
  name: "text-[15.5px] font-semibold leading-tight tracking-[-0.006em] text-[var(--hd-text)]",
  /** Ordinary prose. */
  body: "text-[13.5px] leading-relaxed text-[var(--hd-text-secondary)]",
  /** Row metadata, timestamps, counts. */
  meta: "text-[12.5px] leading-tight text-[var(--hd-text-muted)] tabular-nums",
  /** Chip and pill text. */
  chip: "text-[11.5px] font-semibold leading-none tracking-[0.01em]",
} as const;

export const SURFACE = {
  card: "rounded-[var(--hd-radius)] border border-[var(--hd-border)] bg-[var(--hd-surface)] shadow-[var(--hd-shadow)]",
  divider: "divide-y divide-[var(--hd-border)]",
  hover: "transition-colors hover:bg-[var(--hd-surface-sunken)]",
  /** Focus ring used on every interactive element on the page. */
  focus:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hd-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--hd-surface)]",
} as const;

/** Initials for the row avatar. Two letters, never more. */
export function initialsOf(name: string | null | undefined): string {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "•"
  );
}

/** Classify then paint, for the common case of a row or a day-panel entry. */
export function standingStyle(facts: Parameters<typeof standingOf>[0]) {
  const info = standingOf(facts);
  return { info, tone: toneOf(info) };
}
