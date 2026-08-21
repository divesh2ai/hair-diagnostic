"use client";

import { useMemo, useState } from "react";
import { Check, Search, UserRound } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  dayLabel,
  nextDay,
  nextSlotAfterNow,
  todayKey,
  type DayKey,
} from "@/lib/format/clinicDay";
import { SURFACE, TONES, TYPE, initialsOf } from "./registryTheme";
import type { PatientRow } from "./types";

// Booking a future visit.
//
// ── The form asks for wall-clock time, and sends exactly that ───────────────
// `date` and `time` go to the server as the strings the doctor typed. The
// browser never builds a Date from them, because a Date would silently carry
// the DOCTOR'S timezone — a clinician booking from abroad would seat the
// patient at the wrong hour and nothing in the record would explain why. The
// clinic's own zone does the conversion, server-side, once. See
// lib/format/clinicDay and the POST handler.
//
// ── Choosing the patient ────────────────────────────────────────────────────
// A native <select> over a clinic register is unusable past about thirty
// people, so this is a search field over the list the page has already loaded
// — no extra request, and it matches on name or phone because reception knows
// the number more reliably than the spelling. Opened from a patient's row, the
// patient arrives already chosen and the search collapses to a chip.
//
// ── Duration is a choice of five, not a number field ────────────────────────
// Clinics book in slots. A free numeric input invites 23-minute appointments
// and makes every reader wonder whether the odd number meant something.

const DURATIONS = [15, 20, 30, 45, 60];

const REASON_SUGGESTIONS = [
  "Follow-up",
  "Kit review",
  "Progress check",
  "New concern",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patients: PatientRow[];
  timeZone: string;
  /** Pre-selected day, from the calendar cell or the "book this day" button. */
  defaultDay: DayKey | null;
  /** Pre-selected patient, when opened from a registry row. */
  defaultPatientId: string | null;
  provisioned: boolean;
  /** Resolves once the booking is saved; the page reloads its month. */
  onBooked: () => void | Promise<void>;
}

export function BookAppointmentDialog({
  open,
  onOpenChange,
  patients,
  timeZone,
  defaultDay,
  defaultPatientId,
  provisioned,
  onBooked,
}: Props) {
  const today = todayKey(timeZone);
  const start = openingSlot(defaultDay, today, timeZone);

  // These initialise once per mount and are never reset here. Reopening must
  // not inherit the last booking's answers — a dialog that remembers a patient
  // from twenty minutes ago is how the wrong person gets an appointment — so
  // the page remounts this component on every open via a `key`. That is the
  // React-sanctioned way to reset state on a prop change, and it costs no
  // effect and no cascading render.
  const [patientId, setPatientId] = useState<string | null>(defaultPatientId);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState<DayKey>(start.day);
  const [time, setTime] = useState(start.time);
  const [duration, setDuration] = useState(20);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(
    () => patients.find((p) => p.id === patientId) ?? null,
    [patients, patientId],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 6);
    return patients
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          (p.phone ?? "").toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [patients, query]);

  async function submit() {
    if (!patientId) {
      setError("Choose a patient.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          date: day,
          time,
          durationMinutes: duration,
          reason: reason.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          reason?: string;
          error?: string;
        };
        setError(
          res.status === 503
            ? "Scheduling is not switched on for this database yet. The Appointment migration has not been applied."
            : (data.reason ?? data.error ?? "Could not save this appointment."),
        );
        return;
      }

      await onBooked();
      onOpenChange(false);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        className="border-[var(--hd-border)] bg-[var(--hd-surface)]" data-surface="doctor"
        title={<span className={TYPE.title}>Book an appointment</span>}
        description={
          <span className={TYPE.body}>
            Times are in the clinic&rsquo;s own timezone.
          </span>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={`rounded-full border border-[var(--hd-border)] bg-[var(--hd-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--hd-text-secondary)] transition-colors hover:border-[var(--hd-border-strong)] hover:text-[var(--hd-text)] ${SURFACE.focus}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || !patientId || !provisioned}
              className={`rounded-full bg-[var(--hd-primary)] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--hd-primary-dark)] disabled:cursor-not-allowed disabled:opacity-40 ${SURFACE.focus}`}
            >
              {saving ? "Booking…" : "Book appointment"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {!provisioned && (
            <p
              className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${TONES.action.pill}`}
            >
              Scheduling is not switched on for this database yet. Apply{" "}
              <code className="rounded bg-[var(--hd-surface)]/70 px-1 py-0.5 text-[11px]">
                prisma/migrations/20260821_appointments
              </code>{" "}
              to enable booking.
            </p>
          )}

          {/* ── Patient ─────────────────────────────────────────────────── */}
          <Field label="Patient">
            {chosen ? (
              <div className="flex items-center gap-3 rounded-[var(--hd-radius-sm)] border border-[var(--hd-border)] bg-[var(--hd-surface-sunken)] px-3 py-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--hd-surface)] text-[11px] font-semibold text-[var(--hd-text-secondary)] ring-1 ring-[var(--hd-border)]">
                  {initialsOf(chosen.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${TYPE.name}`}>
                    {chosen.name || "(unnamed)"}
                  </span>
                  {chosen.phone && (
                    <span className={`block ${TYPE.meta}`}>{chosen.phone}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setPatientId(null)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] font-medium text-[var(--hd-text-secondary)] underline-offset-2 hover:text-[var(--hd-text)] hover:underline ${SURFACE.focus}`}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--hd-text-muted)]" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or phone"
                    className={`w-full rounded-[var(--hd-radius-sm)] border border-[var(--hd-border)] bg-[var(--hd-surface)] py-2.5 pl-10 pr-3 text-[14px] text-[var(--hd-text)] placeholder-[var(--hd-text-muted)] ${SURFACE.focus}`}
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto rounded-[var(--hd-radius-sm)] border border-[var(--hd-border)]">
                  {matches.length === 0 ? (
                    <li className="px-3.5 py-3 text-[13.5px] text-[var(--hd-text-secondary)]">
                      No patient matches that.
                    </li>
                  ) : (
                    matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setPatientId(p.id)}
                          className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--hd-surface-sunken)] ${SURFACE.focus}`}
                        >
                          <UserRound className="h-4 w-4 shrink-0 text-[var(--hd-text-muted)]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] text-[var(--hd-text)]">
                              {p.name || "(unnamed)"}
                            </span>
                            {p.phone && (
                              <span className={`block ${TYPE.meta}`}>
                                {p.phone}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </Field>

          {/* ── When ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={day}
                min={today}
                onChange={(e) => setDay(e.target.value as DayKey)}
                className={`w-full rounded-[var(--hd-radius-sm)] border border-[var(--hd-border)] bg-[var(--hd-surface)] px-3 py-2.5 text-[14px] tabular-nums text-[var(--hd-text)] ${SURFACE.focus}`}
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={time}
                step={300}
                onChange={(e) => setTime(e.target.value)}
                className={`w-full rounded-[var(--hd-radius-sm)] border border-[var(--hd-border)] bg-[var(--hd-surface)] px-3 py-2.5 text-[14px] tabular-nums text-[var(--hd-text)] ${SURFACE.focus}`}
              />
            </Field>
          </div>

          <p className={TYPE.meta}>{dayLabel(day)}</p>

          {/* ── Duration ────────────────────────────────────────────────── */}
          <Field label="Duration">
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                    d === duration
                      ? "bg-[var(--hd-text)] text-white"
                      : "border border-[var(--hd-border)] bg-[var(--hd-surface)] text-[var(--hd-text-secondary)] hover:border-[var(--hd-border-strong)]"
                  } ${SURFACE.focus}`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </Field>

          {/* ── Reason ──────────────────────────────────────────────────── */}
          <Field label="Reason" optional>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
              placeholder="e.g. 3-month follow-up"
              className={`w-full rounded-[var(--hd-radius-sm)] border border-[var(--hd-border)] bg-[var(--hd-surface)] px-3 py-2.5 text-[14px] text-[var(--hd-text)] placeholder-[var(--hd-text-muted)] ${SURFACE.focus}`}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REASON_SUGGESTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`inline-flex items-center gap-1 rounded-full border border-[var(--hd-border)] bg-[var(--hd-surface)] px-2.5 py-1 text-[11.5px] text-[var(--hd-text-secondary)] transition-colors hover:border-[var(--hd-border-strong)] ${SURFACE.focus}`}
                >
                  {reason === r && <Check className="h-3 w-3" />}
                  {r}
                </button>
              ))}
            </div>
          </Field>

          {error && (
            <p
              className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${TONES.fail.pill}`}
            >
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Where the form opens.
 *
 * The calendar's book button carries whatever day is selected, and that day is
 * very often in the past — you look up last Tuesday, then decide to book a
 * follow-up. Pre-filling last Tuesday puts the date field below its own `min`
 * and guarantees the first submission is rejected, so a past selection falls
 * back to the soonest bookable moment instead.
 *
 * On today, the time starts at the next half hour rather than a fixed 10:00,
 * for the same reason: the server requires a future instant, and an afternoon
 * booking that opens pre-filled with this morning is a form that fails before
 * it is touched. When the next half hour would cross midnight, the whole thing
 * moves to tomorrow morning.
 */
function openingSlot(
  defaultDay: DayKey | null,
  today: DayKey,
  timeZone: string,
): { day: DayKey; time: string } {
  if (defaultDay && defaultDay > today) return { day: defaultDay, time: "10:00" };

  const slot = nextSlotAfterNow(timeZone);
  return slot
    ? { day: today, time: slot }
    : { day: nextDay(today), time: "09:00" };
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={`mb-1.5 block ${TYPE.eyebrow}`}>
        {label}
        {optional && (
          <span className="ml-1.5 normal-case tracking-normal text-[var(--hd-text-muted)]">
            optional
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
