"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  CalendarPlus,
  Clock3,
  Stethoscope,
  X,
} from "lucide-react";
import { dayLabel, timeLabel, todayKey, type DayKey } from "@/lib/format/clinicDay";
import { reviewHref } from "@/lib/doctor/reviewHref";
import { labelForDiagnosis } from "@/lib/labels/diagnosisLabels";
import { SURFACE, TONES, TYPE, standingStyle } from "./registryTheme";
import type { CalendarDay } from "./types";

// One day, opened from the calendar.
//
// ── Intent above outcome, both labelled ─────────────────────────────────────
// Appointments come first and assessments second, and they are never
// interleaved into a single timeline. They answer different questions — who is
// EXPECTED, and who actually CAME — and a merged list would quietly assert
// that a booking and a submitted assessment are the same kind of event. On a
// past day the appointments section is the record of who was expected; on a
// future day the assessments section is empty by definition and says so.
//
// ── Cancelling is visible, not hidden ───────────────────────────────────────
// A cancelled booking stays in the list, struck through and greyed. A doctor
// looking back at a day needs to see that an afternoon was held and released,
// not an unexplained gap where a patient used to be.

export function DayPanel({
  day,
  timeZone,
  bucket,
  provisioned,
  onClose,
  onBook,
  onCancelAppointment,
}: {
  day: DayKey;
  timeZone: string;
  bucket: CalendarDay | undefined;
  provisioned: boolean;
  onClose: () => void;
  onBook: (day: DayKey) => void;
  onCancelAppointment: (id: string) => Promise<void>;
}) {
  const assessments = bucket?.assessments ?? [];
  const appointments = bucket?.appointments ?? [];
  const isPast = day < todayKey(timeZone);

  return (
    <section className={`${SURFACE.card} overflow-hidden`}>
      <header className="flex items-start justify-between gap-4 border-b border-[var(--hd-border)] px-5 py-4">
        <div className="min-w-0">
          <p className={TYPE.eyebrow}>Selected day</p>
          <h2 className={`mt-1.5 truncate ${TYPE.title}`}>{dayLabel(day)}</h2>
          <p className={`mt-1 ${TYPE.meta}`}>
            {assessments.length} assessment
            {assessments.length === 1 ? "" : "s"}
            {" · "}
            {appointments.filter((a) => a.status === "SCHEDULED").length}{" "}
            appointment
            {appointments.filter((a) => a.status === "SCHEDULED").length === 1
              ? ""
              : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to all patients"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--hd-border)] bg-[var(--hd-surface)] text-[var(--hd-text-secondary)] transition-colors hover:border-[var(--hd-border-strong)] hover:text-[var(--hd-text)] ${SURFACE.focus}`}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* ── Appointments ───────────────────────────────────────────────── */}
      <div className="border-b border-[var(--hd-border)]">
        <SectionHead
          tone={TONES.future.spine}
          label="Appointments"
          note={isPast ? "who was expected" : "who is expected"}
        />
        {!provisioned ? (
          <Note>
            Scheduling is not switched on for this database yet — the{" "}
            <code className="rounded bg-[var(--hd-surface-sunken)] px-1 py-0.5 text-[11px]">
              Appointment
            </code>{" "}
            migration has not been applied.
          </Note>
        ) : appointments.length === 0 ? (
          <div className="px-5 pb-5 pt-1">
            <p className={TYPE.body}>Nothing booked for this day.</p>
            {!isPast && (
              <button
                type="button"
                onClick={() => onBook(day)}
                className={`mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--hd-border)] bg-[var(--hd-surface)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--hd-text)] transition-colors hover:border-[var(--hd-border-strong)] hover:bg-[var(--hd-surface-sunken)] ${SURFACE.focus}`}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Book this day
              </button>
            )}
          </div>
        ) : (
          <ul className={SURFACE.divider}>
            {appointments.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                timeZone={timeZone}
                onCancel={onCancelAppointment}
              />
            ))}
          </ul>
        )}
      </div>

      {/* ── Assessments ────────────────────────────────────────────────── */}
      <div>
        <SectionHead
          tone={TONES.working.spine}
          label="Assessments"
          note="what was submitted"
        />
        {assessments.length === 0 ? (
          <Note>
            {isPast
              ? "No assessments were submitted on this day."
              : "Assessments appear here once patients submit them."}
          </Note>
        ) : (
          <ul className={SURFACE.divider}>
            {assessments.map((a) => {
              const { info, tone } = standingStyle({
                assessmentCount: 1,
                lastStatus: a.status,
                lastReviewDecision: a.reviewDecision,
              });
              return (
                <li key={a.id} className={`relative ${SURFACE.hover}`}>
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-[3px] ${tone.spine}`}
                  />
                  <Link
                    href={reviewHref({ id: a.id, concern: a.concern })}
                    className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3.5 pl-5 pr-4"
                  >
                    <span className={`w-14 shrink-0 ${TYPE.meta}`}>
                      {timeLabel(a.submittedAt, timeZone)}
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate ${TYPE.name}`}>
                        {a.patientName}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          aria-label={info.detail}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${TYPE.chip} ${tone.pill}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                          {info.label}
                        </span>
                        <span className={`truncate ${TYPE.meta}`}>
                          {labelForDiagnosis(a.primaryDiagnosis)}
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-[var(--hd-text-muted)] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--hd-text)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

function AppointmentRow({
  appointment: a,
  timeZone,
  onCancel,
}: {
  appointment: CalendarDay["appointments"][number];
  timeZone: string;
  onCancel: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const cancelled = a.status === "CANCELLED";

  return (
    <li className={`relative ${cancelled ? "bg-[var(--hd-surface-sunken)]" : ""}`}>
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${
          cancelled ? TONES.idle.spine : TONES.future.spine
        }`}
      />
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3.5 pl-5 pr-4">
        <span className={`w-14 shrink-0 ${TYPE.meta}`}>
          {timeLabel(a.scheduledAt, timeZone)}
        </span>

        <div className="min-w-0">
          <p
            className={`truncate ${TYPE.name} ${
              cancelled ? "text-[var(--hd-text-muted)] line-through" : ""
            }`}
          >
            {a.patientName}
          </p>
          <p className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 ${TYPE.meta}`}>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              <span>{a.durationMinutes} min</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Stethoscope className="h-3 w-3" />
              {a.doctorName}
            </span>
            {a.reason && <span className="truncate">· {a.reason}</span>}
          </p>
        </div>

        {cancelled ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 ${TYPE.chip} ${TONES.idle.pill}`}
          >
            Cancelled
          </span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onCancel(a.id);
              } finally {
                setBusy(false);
              }
            }}
            className={`shrink-0 rounded-full border border-[var(--hd-border)] bg-[var(--hd-surface)] px-3 py-1 text-[11.5px] font-medium text-[var(--hd-text-secondary)] transition-colors hover:border-[var(--hd-st-fail-edge)] hover:bg-[var(--hd-st-fail-tint)] hover:text-[var(--hd-st-fail-ink)] disabled:opacity-50 ${SURFACE.focus}`}
          >
            {busy ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
    </li>
  );
}

function SectionHead({
  tone,
  label,
  note,
}: {
  tone: string;
  label: string;
  note: string;
}) {
  return (
    <div className="flex items-baseline gap-2.5 px-5 pb-2 pt-4">
      <span aria-hidden className={`h-2.5 w-[3px] shrink-0 rounded-full ${tone}`} />
      <h3 className={TYPE.eyebrow}>{label}</h3>
      <span className="text-[11px] text-[var(--hd-text-muted)]">— {note}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className={`px-5 pb-5 pt-1 ${TYPE.body}`}>{children}</p>;
}
