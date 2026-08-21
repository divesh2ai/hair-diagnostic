"use client";

import { useMemo } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  monthGrid,
  monthLabel,
  todayKey,
  type DayKey,
  type MonthKey,
} from "@/lib/format/clinicDay";
import {
  SURFACE,
  TONES,
  TONE_FOR_STANDING,
  TONE_PRIORITY,
  TYPE,
  standingOf,
  type ToneKey,
} from "./registryTheme";
import type { CalendarPayload } from "./types";

// The clinic month — a supporting rail, never the main event.
//
// ── What a cell says before it is clicked ───────────────────────────────────
// A calendar whose days are blank until you probe them is a date picker. This
// one answers the two questions a doctor scans a month for — "which days were
// busy?" and "what is coming?" — from the grid alone, in the same tone
// vocabulary as the list beside it. Amber in the grid means what amber means in
// the registry, so reading a day needs no legend lookup.
//
// ── Density over decoration ─────────────────────────────────────────────────
// Each cell carries the date, at most four dots, and nothing else. Counts
// inside cells were the obvious alternative and were wrong: thirty-one
// two-digit numbers in a 330px rail is a spreadsheet, and the doctor cannot see
// the SHAPE of the month through it. Dots answer "is there anything, and what
// kind" at a glance; the figures are one click away in the panel, where there
// is room to read them. Patient names never appear here.
//
// ── Colour is never the only signal ─────────────────────────────────────────
// Every cell's aria-label spells out what its dots mean, so the grid is fully
// readable without seeing a single hue.
//
// ── Days outside the month are inert ────────────────────────────────────────
// Rendered so the weeks stay whole, and not focusable, because their data
// belongs to a month this payload does not contain. A cell that is visible,
// clickable and always empty teaches a doctor that quiet days are a bug.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** At most this many marks in one cell, so a busy day stays a glance. */
const MAX_DOTS = 4;

interface DaySummary {
  /** Which clinical tones occur on this day, in display order. */
  tones: ToneKey[];
  /** Spoken form of the same information, for the cell's accessible name. */
  spoken: string[];
  appointments: number;
  total: number;
}

/**
 * Collapse each day into the marks its cell will carry.
 *
 * Every assessment goes through `standingOf` — the same domain function the
 * registry rows and the day panel use. Classifying inline here was the first
 * version and was wrong within a day: it filed a PARTIAL_FAILURE case under
 * "processing" while the list beside it showed the same patient in red. One
 * derivation, or the surfaces drift.
 */
function summarise(payload: CalendarPayload | null): Record<DayKey, DaySummary> {
  const out: Record<DayKey, DaySummary> = {};
  if (!payload) return out;

  const LABEL: Record<ToneKey, string> = {
    action: "awaiting review",
    fail: "needs attention",
    working: "processing",
    done: "reviewed",
    future: "appointment",
    idle: "no assessment",
  };

  for (const [day, bucket] of Object.entries(payload.days)) {
    const counts = new Map<ToneKey, number>();
    for (const a of bucket.assessments) {
      const key =
        TONE_FOR_STANDING[
          standingOf({
            assessmentCount: 1,
            lastStatus: a.status,
            lastReviewDecision: a.reviewDecision,
          }).standing
        ];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Cancelled bookings stay in the payload so the day panel can show that a
    // slot was held and released, but they must not make a day look occupied.
    const appointments = bucket.appointments.filter(
      (x) => x.status === "SCHEDULED",
    ).length;

    const tones = TONE_PRIORITY.filter((t) => counts.has(t));
    const spoken = tones.map((t) => `${counts.get(t)} ${LABEL[t]}`);
    if (appointments) {
      spoken.push(
        `${appointments} appointment${appointments === 1 ? "" : "s"}`,
      );
    }

    out[day] = {
      tones,
      spoken,
      appointments,
      total: bucket.assessments.length + appointments,
    };
  }
  return out;
}

export function PatientCalendar({
  month,
  timeZone,
  payload,
  loading,
  failed,
  selectedDay,
  onMonthChange,
  onSelectDay,
  onBook,
  onRetry,
}: {
  month: MonthKey;
  timeZone: string;
  payload: CalendarPayload | null;
  loading: boolean;
  failed: boolean;
  selectedDay: DayKey | null;
  onMonthChange: (m: MonthKey) => void;
  onSelectDay: (d: DayKey | null) => void;
  onBook: (d: DayKey) => void;
  onRetry: () => void;
}) {
  const cells = useMemo(() => monthGrid(month), [month]);
  const summary = useMemo(() => summarise(payload), [payload]);
  const today = todayKey(timeZone);

  return (
    <section className={`${SURFACE.card} overflow-hidden`} aria-label="Clinic calendar">
      {/* ── Month bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 border-b border-[var(--hd-border)] px-4 py-3">
        <div className="min-w-0">
          <p className={TYPE.eyebrow}>Clinic calendar</p>
          <h2 className="mt-1 truncate text-[15px] font-semibold tracking-[-0.008em] text-[var(--hd-text)]">
            {monthLabel(month)}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconStep
            label="Previous month"
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </IconStep>
          <IconStep
            label="Next month"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </IconStep>
        </div>
      </header>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div className="p-3">
        <div
          className="grid grid-cols-7 gap-1"
          aria-busy={loading || undefined}
        >
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="pb-1 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--hd-text-muted)]"
            >
              <span aria-hidden>{d.slice(0, 1)}</span>
              <span className="sr-only">{d}</span>
            </div>
          ))}

          {cells.map((day) => {
            const inMonth = day.slice(0, 7) === month;
            const s = summary[day];
            const isToday = day === today;
            const isSelected = day === selectedDay;

            if (!inMonth) {
              return (
                <div
                  key={day}
                  aria-hidden
                  className="h-10 text-center text-[12.5px] leading-[40px] text-[var(--hd-border-strong)] tabular-nums"
                >
                  {Number(day.slice(8))}
                </div>
              );
            }

            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectDay(isSelected ? null : day)}
                aria-pressed={isSelected}
                aria-label={[
                  day,
                  isToday ? "today" : null,
                  s ? s.spoken.join(", ") : "nothing scheduled",
                ]
                  .filter(Boolean)
                  .join(", ")}
                className={[
                  "relative flex h-10 flex-col items-center justify-center rounded-[8px] transition-colors",
                  SURFACE.focus,
                  isSelected
                    ? "bg-[var(--hd-text)] text-white"
                    : isToday
                      ? "text-[var(--hd-text)] ring-1 ring-inset ring-[var(--hd-primary)] hover:bg-[var(--hd-surface-sunken)]"
                      : s
                        ? "text-[var(--hd-text)] hover:bg-[var(--hd-surface-sunken)]"
                        : "text-[var(--hd-text-muted)] hover:bg-[var(--hd-surface-sunken)]",
                ].join(" ")}
              >
                <span
                  className={`text-[12.5px] leading-none tabular-nums ${
                    isToday && !isSelected ? "font-bold" : ""
                  }`}
                >
                  {Number(day.slice(8))}
                </span>

                {/* Dots inherit the registry's tone vocabulary exactly. On the
                    selected (dark) cell each tone swaps to its own lightened
                    variant, so it stays legible without changing meaning. */}
                <span aria-hidden className="mt-1 flex h-1.5 items-center gap-[3px]">
                  {s?.tones
                    .slice(0, s.appointments ? MAX_DOTS - 1 : MAX_DOTS)
                    .map((t) => (
                      <Dot
                        key={t}
                        tone={isSelected ? TONES[t].dotOnDark : TONES[t].dot}
                      />
                    ))}
                  {s?.appointments ? (
                    <Dot
                      tone={
                        isSelected ? TONES.future.dotOnDark : TONES.future.dot
                      }
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* A month that failed to load must say so — an empty grid would read
            as a quiet month, which is a different and much worse claim. */}
        {failed ? (
          <div className="mt-3 text-center">
            <p className={TYPE.meta}>This month could not be loaded.</p>
            <button
              type="button"
              onClick={onRetry}
              className={`mt-1.5 rounded-full border border-[var(--hd-border)] px-3 py-1 text-[12px] font-medium text-[var(--hd-text-secondary)] hover:border-[var(--hd-border-strong)] ${SURFACE.focus}`}
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <p className={`mt-3 text-center ${TYPE.meta}`}>Loading month…</p>
        ) : null}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--hd-border)] px-4 py-2.5">
        <LegendItem tone={TONES.action.dot} label="Awaiting you" />
        <LegendItem tone={TONES.fail.dot} label="Attention" />
        <LegendItem tone={TONES.working.dot} label="Processing" />
        <LegendItem tone={TONES.done.dot} label="Reviewed" />
        <LegendItem tone={TONES.future.dot} label="Appointment" />
      </div>

      {/* ── Book ───────────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--hd-border)] p-3">
        <button
          type="button"
          onClick={() => onBook(selectedDay ?? today)}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--hd-border)] bg-[var(--hd-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--hd-text)] transition-colors hover:border-[var(--hd-border-strong)] hover:bg-[var(--hd-surface-sunken)] ${SURFACE.focus}`}
        >
          <CalendarPlus className="h-4 w-4" />
          Book an appointment
        </button>
        {payload && !payload.appointmentsProvisioned && (
          <p className={`mt-2 text-center ${TYPE.meta}`}>
            Scheduling is not switched on for this database yet.
          </p>
        )}
      </div>
    </section>
  );
}

function Dot({ tone }: { tone: string }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />;
}

function LegendItem({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--hd-text-muted)]">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      {label}
    </span>
  );
}

function IconStep({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hd-border)] bg-[var(--hd-surface)] text-[var(--hd-text-secondary)] transition-colors hover:border-[var(--hd-border-strong)] hover:text-[var(--hd-text)] ${SURFACE.focus}`}
    >
      {children}
    </button>
  );
}
