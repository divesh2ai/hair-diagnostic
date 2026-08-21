"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, CalendarPlus, ChevronRight, Search } from "lucide-react";
import "@/styles/doctor-tokens.css";
import {
  monthOf,
  shortDate,
  timeLabel,
  todayKey,
  type DayKey,
  type MonthKey,
} from "@/lib/format/clinicDay";
import { reviewHref } from "@/lib/doctor/reviewHref";
import { PatientCalendar } from "./PatientCalendar";
import { DayPanel } from "./DayPanel";
import { BookAppointmentDialog } from "./BookAppointmentDialog";
import {
  SURFACE,
  TONES,
  TONE_FOR_STANDING,
  TYPE,
  compareByPriority,
  initialsOf,
  nextActionOf,
  standingStyle,
  type Standing,
} from "./registryTheme";
import type { CalendarPayload, PatientRow, PatientsPayload } from "./types";

// The patient registry — a doctor's worklist, with the clinic month beside it.
//
// ── The page answers "who needs me", and only then everything else ──────────
// Default order is by what is OWED, not by what is recent: awaiting review,
// then needs attention, then processing, then reviewed, then never assessed
// (lib/doctor/clinicalStanding.compareByPriority). Recency sorts within a band.
// A register ordered purely by date buries a three-day-old pending review under
// this morning's already-approved cases, which is the opposite of the job.
//
// Every row ends in exactly one next step — Review, Open case, View report — or
// in plain text when there is genuinely nothing to do. No disabled buttons: a
// control a doctor cannot press is a question they must answer before moving on.
//
// ── Two ways in, one room ───────────────────────────────────────────────────
// "Where is this person up to?" is the register. "What happened on that day?"
// is the calendar. Those questions interleave constantly — you look up Tuesday,
// spot a name, want their history — so the calendar is a rail here rather than
// a second route. Selecting a day swaps the main column and leaves the month in
// place, so what you are reading never moves under you.
//
// On narrow screens the order is filters → patients → calendar. A doctor on a
// phone must not scroll past a month grid to reach their work.
//
// ── The green mark ──────────────────────────────────────────────────────────
// Green means a HUMAN approved the report, never that the pipeline finished.
// That rule lives in lib/doctor/clinicalStanding and is shared with every other
// doctor surface; nothing here re-derives status from a status string inline.
//
// ── Timezone ────────────────────────────────────────────────────────────────
// Every day boundary is the CLINIC's, not the browser's. A 23:40 IST submission
// belongs to that evening, not the previous UTC day. See lib/format/clinicDay.

type Sort = "priority" | "recent" | "name" | "upcoming";
type Filter = "all" | "awaiting" | "attention" | "processing" | "reviewed" | "none";

const SORTS: { id: Sort; label: string }[] = [
  { id: "priority", label: "What needs me" },
  { id: "recent", label: "Most recent" },
  { id: "name", label: "Name" },
  { id: "upcoming", label: "Next appointment" },
];

// Ordered the way a doctor triages: the work first, the finished work last.
// Each row carries the standing it selects, and the tone is derived from that
// standing through the shared map — so a filter chip can never show a colour
// the rows it selects do not.
const FILTERS: { id: Filter; label: string; standing: Standing | null }[] = [
  { id: "all", label: "All", standing: null },
  { id: "awaiting", label: "Awaiting review", standing: "AWAITING_REVIEW" },
  { id: "attention", label: "Needs attention", standing: "ATTENTION" },
  { id: "processing", label: "Processing", standing: "PROCESSING" },
  { id: "reviewed", label: "Reviewed", standing: "REVIEWED" },
  { id: "none", label: "No assessment", standing: "NONE" },
];

/** Used when the clinic's own zone could not be read. Matches the schema default. */
const FALLBACK_TZ = "Asia/Kolkata";

/** What the registry shows when the request fails outright. */
const EMPTY_REGISTRY: PatientsPayload = {
  timeZone: FALLBACK_TZ,
  appointmentsProvisioned: false,
  truncated: false,
  patients: [],
};

export default function AllPatientsPage() {
  const [registry, setRegistry] = useState<PatientsPayload | null>(null);
  const [month, setMonth] = useState<MonthKey | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);
  // The month a payload BELONGS to is stored with it, which removes the need
  // for a separate loading flag: the calendar is loading exactly when what we
  // hold is not the month being displayed. A boolean beside the data would be a
  // second source of truth that can disagree with it mid-flight.
  const [loaded, setLoaded] = useState<{
    month: MonthKey;
    payload: CalendarPayload | null;
  } | null>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("priority");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  const [booking, setBooking] = useState<{
    day: DayKey | null;
    patientId: string | null;
  } | null>(null);
  // Bumped on every open. Used as the dialog's `key`, so each booking starts
  // from a fresh component rather than from a reset effect — a dialog that
  // remembers the patient chosen twenty minutes ago is how the wrong person
  // gets an appointment. Left unchanged on close so the exit animation runs.
  const [bookingSession, setBookingSession] = useState(0);

  const openBooking = useCallback(
    (day: DayKey | null, patientId: string | null) => {
      setBookingSession((n) => n + 1);
      setBooking({ day, patientId });
    },
    [],
  );

  const timeZone = registry?.timeZone ?? null;

  // ── Loading ───────────────────────────────────────────────────────────────
  //
  // Written as promise chains rather than async/await so every setState sits
  // inside a `.then` callback. That is what `react-hooks/set-state-in-effect`
  // asks for, and it is an honest description of the code: nothing is set until
  // a response lands.
  const loadRegistry = useCallback(
    () =>
      fetch("/api/doctor/patients")
        .then((r) => r.json() as Promise<PatientsPayload>)
        .catch(() => EMPTY_REGISTRY)
        .then((data) => {
          setRegistry(data);
          // The month can only be chosen once the clinic's timezone is known:
          // "this month" in Kolkata and "this month" on a UTC server are not
          // reliably the same month at the turn of one.
          setMonth((m) => m ?? monthOf(todayKey(data.timeZone || FALLBACK_TZ)));
          setLoading(false);
        }),
    [],
  );

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  const loadCalendar = useCallback(
    (m: MonthKey) =>
      fetch(`/api/doctor/calendar?month=${m}`)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<CalendarPayload>;
        })
        .catch(() => null)
        .then((payload) => setLoaded({ month: m, payload })),
    [],
  );

  useEffect(() => {
    if (!month) return;
    void loadCalendar(month);
  }, [month, loadCalendar]);

  const refreshAfterBooking = useCallback(async () => {
    await Promise.all([loadRegistry(), month ? loadCalendar(month) : null]);
  }, [loadRegistry, loadCalendar, month]);

  const cancelAppointment = useCallback(
    async (id: string) => {
      await fetch(`/api/doctor/appointments/${id}/cancel`, { method: "POST" });
      await refreshAfterBooking();
    },
    [refreshAfterBooking],
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const patients = useMemo(() => registry?.patients ?? [], [registry]);
  const calendar = loaded && loaded.month === month ? loaded.payload : null;
  const calendarLoading = loaded?.month !== month;
  const provisioned = registry?.appointmentsProvisioned ?? false;
  const calendarFailed = loaded?.month === month && loaded.payload === null;

  const counts = useMemo(() => {
    const c = {
      all: patients.length,
      awaiting: 0,
      attention: 0,
      processing: 0,
      reviewed: 0,
      none: 0,
    } as Record<Filter, number>;
    for (const p of patients) {
      const { standing } = standingStyle(p).info;
      if (standing === "AWAITING_REVIEW") c.awaiting++;
      else if (standing === "ATTENTION") c.attention++;
      else if (standing === "PROCESSING") c.processing++;
      else if (standing === "REVIEWED") c.reviewed++;
      else c.none++;
    }
    return c;
  }, [patients]);

  const visible = useMemo(() => {
    const wanted = FILTERS.find((f) => f.id === filter)?.standing ?? null;
    let rows = wanted
      ? patients.filter((p) => standingStyle(p).info.standing === wanted)
      : patients;

    if (query) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          (p.phone ?? "").toLowerCase().includes(q),
      );
    }

    return [...rows].sort((a, b) => {
      if (sort === "priority") return compareByPriority(a, b);
      if (sort === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sort === "upcoming") {
        // Patients with something booked come first, soonest at the top;
        // everyone else keeps recency order behind them. Sorting the
        // unscheduled to the top would bury the answer the sort was chosen for.
        const at = a.nextAppointment
          ? new Date(a.nextAppointment.scheduledAt).getTime()
          : Infinity;
        const bt = b.nextAppointment
          ? new Date(b.nextAppointment.scheduledAt).getTime()
          : Infinity;
        if (at !== bt) return at - bt;
      }
      const at = a.lastAssessment ? new Date(a.lastAssessment).getTime() : 0;
      const bt = b.lastAssessment ? new Date(b.lastAssessment).getTime() : 0;
      return bt - at;
    });
  }, [patients, query, sort, filter]);

  return (
    // `data-surface="doctor"` scopes the HairOS Doctor token layer to this tree
    // — Inter, the clinical ground, the status scale. See styles/doctor-tokens.
    <div
      data-surface="doctor"
      className="min-h-full bg-[var(--hd-bg)] text-[var(--hd-text)]"
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="hd-title">Patients</h1>
            <p className={`mt-1.5 ${TYPE.body}`}>
              Review clinic patients, track assessments, and see upcoming
              activity.
            </p>
          </div>
          {!loading && (
            <p className={TYPE.meta}>
              <span className="font-semibold text-[var(--hd-text)]">
                {visible.length}
              </span>{" "}
              of {patients.length} patient{patients.length === 1 ? "" : "s"}
              {registry?.truncated && " · showing the most recent 500"}
            </p>
          )}
        </header>

        {/* ── BODY ───────────────────────────────────────────────────────── */}
        {/* The split happens at xl, not lg. At exactly 1024 a
            `1fr + 330px` grid gives the registry 339px and the rail 330 — the
            calendar becomes as wide as the worklist, which inverts what this
            page is for. Below xl the registry gets the full width and the month
            sits under it. */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          {/* Main column. `order-1` keeps the work above the month on anything
              narrower than xl; the grid places it left above that. */}
          <div className="order-1 min-w-0 space-y-4">
            {selectedDay && timeZone ? (
              <DayPanel
                day={selectedDay}
                timeZone={timeZone}
                bucket={calendar?.days[selectedDay]}
                provisioned={calendar?.appointmentsProvisioned ?? provisioned}
                onClose={() => setSelectedDay(null)}
                onBook={(d) => openBooking(d, null)}
                onCancelAppointment={cancelAppointment}
              />
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--hd-text-muted)]" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or phone"
                    aria-label="Search patients by name or phone"
                    className={`w-full rounded-[var(--hd-radius-sm)] border border-[var(--hd-border)] bg-[var(--hd-surface)] py-2.5 pl-10 pr-3 text-[14px] text-[var(--hd-text)] placeholder-[var(--hd-text-muted)] ${SURFACE.focus}`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Filters double as the page's counts. A separate stat strip
                      would print the same six numbers twice and give the doctor
                      two things to reconcile. */}
                  <div
                    role="tablist"
                    aria-label="Filter patients by status"
                    className="flex flex-wrap items-center gap-1"
                  >
                    {FILTERS.map((f) => {
                      const active = f.id === filter;
                      const dot = f.standing
                        ? TONES[TONE_FOR_STANDING[f.standing]].dot
                        : null;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setFilter(f.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                            active
                              ? "border-[var(--hd-text)] bg-[var(--hd-text)] text-white"
                              : "border-[var(--hd-border)] bg-[var(--hd-surface)] text-[var(--hd-text-secondary)] hover:border-[var(--hd-border-strong)]"
                          } ${SURFACE.focus}`}
                        >
                          {dot && !active && (
                            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                          )}
                          {f.label}
                          <span
                            className={`tabular-nums ${active ? "text-white/70" : "text-[var(--hd-text-muted)]"}`}
                          >
                            {counts[f.id]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <label className="inline-flex items-center gap-2 text-[12.5px] text-[var(--hd-text-muted)]">
                    Sort
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as Sort)}
                      className={`rounded-full border border-[var(--hd-border)] bg-[var(--hd-surface)] px-3 py-1.5 text-[12.5px] text-[var(--hd-text)] ${SURFACE.focus}`}
                    >
                      {SORTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <section className={`${SURFACE.card} overflow-hidden`}>
                  {loading ? (
                    <SkeletonList />
                  ) : visible.length === 0 ? (
                    <EmptyState query={query} filter={filter} />
                  ) : (
                    <ul className={SURFACE.divider}>
                      {visible.map((p) => (
                        <Row
                          key={p.id}
                          patient={p}
                          timeZone={timeZone ?? FALLBACK_TZ}
                          canBook={provisioned}
                          onBook={() => openBooking(null, p.id)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Calendar rail. `order-2` puts it below the work on anything that
              is not showing two columns — a doctor on a phone or a tablet must
              not scroll past a month grid to reach their patients. */}
          <div className="order-2 xl:sticky xl:top-5">
            {month && timeZone ? (
              <PatientCalendar
                month={month}
                timeZone={timeZone}
                payload={calendar}
                loading={calendarLoading}
                failed={calendarFailed}
                selectedDay={selectedDay}
                onMonthChange={(m) => {
                  setMonth(m);
                  setSelectedDay(null);
                }}
                onSelectDay={setSelectedDay}
                onBook={(d) => openBooking(d, null)}
                onRetry={() => month && loadCalendar(month)}
              />
            ) : (
              <div className={`${SURFACE.card} h-72 animate-pulse`} />
            )}
          </div>
        </div>
      </div>

      {timeZone && (
        <BookAppointmentDialog
          key={bookingSession}
          open={booking !== null}
          onOpenChange={(v) => !v && setBooking(null)}
          patients={patients}
          timeZone={timeZone}
          defaultDay={booking?.day ?? null}
          defaultPatientId={booking?.patientId ?? null}
          provisioned={provisioned}
          onBooked={refreshAfterBooking}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Row({
  patient: p,
  timeZone,
  canBook,
  onBook,
}: {
  patient: PatientRow;
  timeZone: string;
  canBook: boolean;
  onBook: () => void;
}) {
  const { info, tone } = standingStyle(p);
  const action = nextActionOf(p, {
    assessmentId: p.lastAssessmentId,
    reviewHref: p.lastAssessmentId
      ? reviewHref({ id: p.lastAssessmentId, concern: p.lastConcern })
      : null,
  });

  return (
    <li className={`group relative ${SURFACE.hover}`}>
      {/* Tone spine: a row's standing is readable down the left edge, before
          any text is parsed. Kept to 3px — it assists scanning; it must not
          turn every row into a coloured card. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${tone.spine}`}
      />

      <div className="flex items-center gap-3 py-3 pl-4 pr-3 sm:gap-4 sm:pl-5 sm:pr-4">
        {/* Stretched link rather than a <Link> wrapping the row, so the action
            controls are siblings and not invalid nested interactive elements. */}
        <Link
          href={`/doctor/patients/${p.id}`}
          aria-label={`Open ${p.name || "patient"}`}
          className={`absolute inset-0 ${SURFACE.focus}`}
        />

        <span className="pointer-events-none inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--hd-surface-sunken)] text-[11.5px] font-semibold text-[var(--hd-text-secondary)]">
          {initialsOf(p.name)}
        </span>

        <div className="pointer-events-none min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={`truncate ${TYPE.name}`}>{p.name || "(unnamed)"}</p>
            <span
              aria-label={info.detail}
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${TYPE.chip} ${tone.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              {info.label}
            </span>
          </div>

          <div className={`mt-1 flex flex-wrap items-center gap-x-2.5 ${TYPE.meta}`}>
            {p.phone && <span>{p.phone}</span>}
            {p.phone && <Sep />}
            <span>
              {p.assessmentCount} assessment{p.assessmentCount === 1 ? "" : "s"}
            </span>
            {p.lastAssessment && (
              <>
                <Sep />
                <span>last {shortDate(p.lastAssessment, timeZone)}</span>
              </>
            )}
            {p.nextAppointment && (
              <>
                <Sep />
                <span
                  className={`inline-flex items-center gap-1 ${TONES.future.ink} font-medium`}
                >
                  <CalendarClock className="h-3 w-3" />
                  {shortDate(p.nextAppointment.scheduledAt, timeZone)},{" "}
                  {timeLabel(p.nextAppointment.scheduledAt, timeZone)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* One next step per row, and nothing to press when there is none. */}
        <div className="relative z-10 flex shrink-0 items-center gap-1.5">
          {canBook && (
            <button
              type="button"
              onClick={onBook}
              aria-label={`Book an appointment for ${p.name || "this patient"}`}
              title="Book an appointment"
              className={`hidden h-8 w-8 items-center justify-center rounded-full border border-transparent text-[var(--hd-text-muted)] opacity-0 transition-all hover:border-[var(--hd-border)] hover:bg-[var(--hd-surface)] hover:text-[var(--hd-st-future-ink)] focus-visible:opacity-100 group-hover:opacity-100 sm:inline-flex ${SURFACE.focus}`}
            >
              <CalendarPlus className="h-4 w-4" />
            </button>
          )}
          <ActionControl action={action} />
        </div>
      </div>
    </li>
  );
}

/**
 * The row's single next step.
 *
 * `inert` renders as text, never as a disabled button — a control that cannot
 * be pressed makes a doctor stop and work out why before they can move on.
 */
function ActionControl({
  action,
}: {
  action: ReturnType<typeof nextActionOf>;
}) {
  if (action.kind === "inert") {
    return (
      <span
        className={`hidden whitespace-nowrap px-2 text-[12.5px] text-[var(--hd-text-muted)] sm:inline`}
      >
        {action.label}
      </span>
    );
  }

  const primary = action.kind === "primary";
  return (
    <Link
      href={action.href}
      className={`relative z-10 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        primary
          ? "bg-[var(--hd-primary)] text-white hover:bg-[var(--hd-primary-dark)]"
          : "border border-[var(--hd-border)] bg-[var(--hd-surface)] text-[var(--hd-text-secondary)] hover:border-[var(--hd-border-strong)] hover:text-[var(--hd-text)]"
      } ${SURFACE.focus}`}
    >
      {action.label}
      <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function Sep() {
  return (
    <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-[var(--hd-border-strong)]" />
  );
}

function SkeletonList() {
  return (
    <ul className={`animate-pulse ${SURFACE.divider}`} aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-10 w-10 rounded-full bg-[var(--hd-surface-sunken)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-44 rounded bg-[var(--hd-surface-sunken)]" />
            <div className="h-3 w-64 rounded bg-[var(--hd-surface-sunken)]" />
          </div>
          <div className="h-7 w-20 rounded-full bg-[var(--hd-surface-sunken)]" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ query, filter }: { query: string; filter: Filter }) {
  const headline = query
    ? "No patients match your search."
    : filter === "awaiting"
      ? "Nothing is waiting for your review."
      : filter === "attention"
        ? "No cases need attention."
        : filter === "processing"
          ? "Nothing is being processed right now."
          : filter === "reviewed"
            ? "No reviewed patients yet."
            : filter === "none"
              ? "Every patient has an assessment."
              : "No patients yet.";

  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-[var(--hd-text)]">
        {headline}
      </p>
      <p className={`mx-auto mt-1.5 max-w-sm ${TYPE.body}`}>
        {query
          ? "Try a different name or phone number."
          : filter === "all"
            ? "Patients appear here after their first assessment."
            : "Clear the filter to see the whole register."}
      </p>
    </div>
  );
}
