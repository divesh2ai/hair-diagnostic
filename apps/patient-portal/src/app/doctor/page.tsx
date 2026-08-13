"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  EyeIcon,
  PencilLine,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { absoluteTimestamp, elapsedLabel } from "@/lib/format/waitingTime";
import { labelForDiagnosis } from "@/lib/labels/diagnosisLabels";
import {
  clinicalAttention,
  demographicLabel,
  type ClinicalAttention,
} from "@/lib/doctor/reviewPriority";
import { reviewHref } from "@/lib/doctor/reviewHref";
import type { InClinicVisit } from "@/lib/doctor/clinicVisits";
import { useMinuteTick, useVisibilityPolling } from "@/lib/doctor/useLiveDashboard";
import {
  DEFAULT_BADGE_THEME,
  getBadgeTheme,
  readStoredBadgeTheme,
  writeBadgeTheme,
  type BadgeThemeId,
} from "@/lib/doctor/badgeThemes";

// Doctor Action Center.
//
// One question governs this screen: WHO NEEDS ME NEXT? Everything is ranked by
// how directly it answers that.
//
//   1. Next to review  — one patient, named, with a real button.
//   2. In clinic       — who is filling in an assessment right now.
//   3. Action counts   — four compact numbers, each a link into the work.
//   4. Waiting longest — the next few, so the doctor can see past the first.
//
// Doctor identity has not been removed; it has been demoted to a compact chip
// beside the greeting. Prime vertical space belongs to patients.
//
// ── Two clocks, two meanings ─────────────────────────────────────────────────
// Doctor-review waiting starts at submission and nowhere else — not at QR
// scan, not at identity capture, not at ClinicVisit.startedAt. A patient who
// scanned at 10:01 and submitted at 10:08 has been waiting six minutes at
// 10:14, not thirteen. In Clinic uses startedAt, and only for "started N ago".
//
// ── Why it changes without a reload ──────────────────────────────────────────
// One authenticated endpoint, polled every 15 seconds while the tab is
// visible, paused when it is not, refreshed on focus. No realtime channel, no
// sound, no browser notification, no toast per arrival: the dashboard being
// correct within fifteen seconds is the whole feature. Elapsed times advance
// locally on a minute tick and never cost a request.

interface QueueRow {
  id: string;
  submittedAt: string | null;
  status: string;
  patientName: string;
  patientAge: number | null;
  patientGender: string | null;
  clinicName: string;
  primaryDiagnosis: string | null;
  severity: string | null;
  reviewPathway: string | null;
  reviewPathwayReasons: string[];
  concern: string | null;
}

interface Counts {
  pending: number;
  inProgress: number;
  approvedToday: number;
  kitOrders: number;
  /**
   * Reports that could not finish generating. Optional because it is
   * exceptional: the server omits it when there are none, so the dashboard has
   * no standing zero to render and no line for a doctor to learn to ignore.
   */
  needsAttention?: number;
}

interface Stats {
  counts: Counts;
  queue: QueueRow[];
  inClinic: InClinicVisit[];
}

interface DoctorMe {
  clinic: { name: string | null } | null;
  doctor: {
    id: string;
    name: string | null;
    photoUrl: string | null;
    specialization: string | null;
    badgeTheme: string | null;
  } | null;
  role: string;
  email: string | null;
}

const EMPTY_COUNTS: Counts = {
  pending: 0,
  inProgress: 0,
  approvedToday: 0,
  kitOrders: 0,
};

export default function DoctorDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [me, setMe] = useState<DoctorMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [badgeThemeId, setBadgeThemeId] = useState<BadgeThemeId>(DEFAULT_BADGE_THEME);

  // Advances the "waiting 6 min" / "started 3 min ago" text without a request.
  const minuteTick = useMinuteTick();

  /**
   * @param background true for a poll tick. A poll must never blank the screen
   *   into skeletons, and a poll that fails must never replace a queue the
   *   doctor is reading with an error card — the data on screen is still the
   *   last thing the server said, and the next tick is fifteen seconds away.
   */
  const loadStats = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setStatsError(false);
    }
    try {
      const res = await fetch("/api/doctor/stats");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Stats & { error?: string };
      if (data.error) throw new Error(data.error);
      setStats(data);
      setStatsError(false);
    } catch {
      if (!background) {
        setStats(null);
        setStatsError(true);
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  // 15s while visible, paused when hidden, immediate on focus, never
  // overlapping. See lib/doctor/useLiveDashboard.
  useVisibilityPolling(() => loadStats(true));

  useEffect(() => {
    // First paint uses the localStorage cache to avoid a default-theme flash;
    // the server value (loaded below) is authoritative and wins.
    setBadgeThemeId(readStoredBadgeTheme());
    loadStats();
    // Identity loads independently — a failure here must not take the queue
    // down with it, so it has its own catch and no shared loading flag.
    fetch("/api/doctor/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DoctorMe | null) => {
        setMe(data);
        const server = data?.doctor?.badgeTheme;
        if (server) {
          setBadgeThemeId(server as BadgeThemeId);
          writeBadgeTheme(server as BadgeThemeId);
        }
      })
      .catch(() => setMe(null));
  }, [loadStats]);

  const badgeTheme = getBadgeTheme(badgeThemeId);
  const counts = stats?.counts ?? EMPTY_COUNTS;
  const queue = stats?.queue ?? [];
  const inClinic = stats?.inClinic ?? [];
  const [next, ...rest] = queue;

  const firstName = useMemo(() => firstNameOf(me?.doctor?.name), [me]);

  const headline = useMemo(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return firstName ? `${part}, Dr ${firstName}.` : `${part}.`;
  }, [firstName]);

  // Two numbers, both facts: how many are ready for a decision, and how many
  // are still answering questions. No invented urgency, no rounded-up drama,
  // and no claim about clinical severity — the classifier is disabled and a
  // count of "priority" cases would read zero while implying it had looked.
  const subhead = useMemo(() => {
    if (loading) return "Loading your queue…";
    if (statsError) return "Your queue could not be loaded.";

    const ready =
      counts.pending === 0
        ? null
        : `${counts.pending.toLocaleString()} ready for review`;
    const inProgress =
      counts.inProgress === 0
        ? null
        : `${counts.inProgress.toLocaleString()} ${
            counts.inProgress === 1 ? "completing an assessment" : "completing assessments"
          }`;

    if (!ready && !inProgress) return "No patients are waiting for your review.";
    return [ready, inProgress].filter(Boolean).join(" · ");
  }, [loading, statsError, counts]);

  const heroDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-full bg-stone-50">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-10 py-8 lg:py-12 space-y-10">
        {me?.role === "SUPER_ADMIN" && (
          <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs text-indigo-900">
            <EyeIcon className="size-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Viewing as super admin.</strong> This is the doctor
              workspace view. All actions are audit-logged as super-admin
              activity — please avoid clinical decisions from this account.
            </span>
          </div>
        )}

        {/* ── GREETING + COMPACT IDENTITY ──────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-teal-600" />
              {/* Date and greeting are derived from the viewer's clock and
                  locale, so the server and browser legitimately disagree.
                  Without suppression that mismatch throws during hydration and
                  takes the whole client root down with it — the dashboard then
                  sits on its loading skeleton forever. */}
              <span
                suppressHydrationWarning
                className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500"
              >
                Dr FACT · Clinical Intelligence · {heroDate}
              </span>
            </div>
            <h1
              suppressHydrationWarning
              className="font-serif text-3xl lg:text-[2.5rem] leading-[1.08] tracking-tight text-slate-900"
            >
              {headline}
            </h1>
            <p className="text-base text-stone-600">{subhead}</p>
          </div>

          <Link
            href="/doctor/profile"
            className={`group inline-flex shrink-0 items-center gap-3 rounded-full border border-stone-200 bg-gradient-to-br ${badgeTheme.cardAccent} py-1.5 pl-1.5 pr-4 shadow-sm hover:border-stone-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25`}
          >
            <span
              className={`relative size-10 shrink-0 overflow-hidden rounded-full bg-white ring-2 ${badgeTheme.avatarRing}`}
            >
              {me?.doctor?.photoUrl ? (
                <Image
                  src={me.doctor.photoUrl}
                  alt=""
                  fill
                  sizes="40px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-stone-400">
                  <UserRound className="size-5" />
                </span>
              )}
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium text-slate-900">
                {me?.doctor?.name ?? "Your profile"}
              </span>
              <span className="block truncate text-[11px] text-stone-500">
                {me?.clinic?.name ?? me?.doctor?.specialization ?? "Dermatologist"}
              </span>
            </span>
          </Link>
        </header>

        {/* ── SECTION 1 · NEXT TO REVIEW ───────────────────────────────── */}
        <section aria-labelledby="next-heading" className="space-y-3">
          <h2
            id="next-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500"
          >
            Next to review
          </h2>
          {loading ? (
            <NextPatientSkeleton />
          ) : statsError ? (
            <SectionError
              title="Review Queue unavailable"
              body="We couldn't refresh your queue."
              onRetry={loadStats}
            />
          ) : !next ? (
            <AllCaughtUp
              approvedToday={counts.approvedToday}
              inProgress={counts.inProgress}
            />
          ) : (
            <NextPatientCard row={next} tick={minuteTick} />
          )}
        </section>

        {/* ── SECTION 2 · IN CLINIC ────────────────────────────────────── */}
        {/* Patients who have given their name and are answering questions.
            Not review work — they appear here and nowhere else until they
            submit, at which point they move to the Review Queue. A raw QR
            scan never reaches this list; identity capture is the threshold. */}
        {inClinic.length > 0 && !statsError && (
          <section aria-labelledby="in-clinic-heading" className="space-y-3">
            <h2
              id="in-clinic-heading"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500"
            >
              In clinic
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inClinic.map((visit) => (
                <InClinicCard key={visit.id} visit={visit} tick={minuteTick} />
              ))}
            </ul>
          </section>
        )}

        {/* ── SECTION 3 · ACTION COUNTS ────────────────────────────────── */}
        <section aria-label="Workload summary">
          <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Metric
              label="Ready for review"
              value={counts.pending}
              href="/doctor/reports?tab=needs_review"
              loading={loading}
              accent="amber"
            />
            <Metric
              label="In clinic"
              value={counts.inProgress}
              loading={loading}
              muted={counts.inProgress === 0}
              accent="sky"
            />
            <Metric
              label="Approved today"
              value={counts.approvedToday}
              href="/doctor/reports?tab=approved"
              loading={loading}
              muted={counts.approvedToday === 0}
              accent="emerald"
            />
            <Metric
              label="Kit orders"
              value={counts.kitOrders}
              href="/doctor/orders"
              loading={loading}
              muted={counts.kitOrders === 0}
              accent="teal"
            />
          </dl>
          {/* Rendered only when it has happened. The server omits the field
              otherwise, so there is nothing here to normalise into background
              noise on the days it matters. */}
          {!loading && counts.needsAttention ? (
            <p className="mt-3 text-xs text-stone-500">
              {counts.needsAttention.toLocaleString()}{" "}
              {counts.needsAttention === 1 ? "case" : "cases"} could not finish
              report generation and need attention before they can be reviewed.
            </p>
          ) : null}
        </section>

        {/* ── SECTION 4 · WAITING LONGEST ──────────────────────────────── */}
        {(loading || rest.length > 0) && !statsError && (
          <section aria-labelledby="waiting-heading" className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <h2
                id="waiting-heading"
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500"
              >
                Waiting longest
              </h2>
              <Link
                href="/doctor/reports?tab=needs_review"
                className="inline-flex items-center gap-1 rounded text-sm text-slate-700 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
              >
                Review Queue
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              {loading ? (
                <QueueSkeleton />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {rest.map((row) => (
                    <QueueRowItem key={row.id} row={row} tick={minuteTick} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function firstNameOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name.replace(/^\s*dr\.?\s+/i, "").trim();
  const first = cleaned.split(/\s+/)[0];
  return first || null;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "•"
  );
}

/** Case summary shared by the next-patient card and the queue rows. */
function useCaseSummary(row: QueueRow) {
  // Display only. This never touches the order of anything — see
  // lib/doctor/reviewPriority.clinicalAttention. Null on a routine or
  // unclassified case, which is almost all of them, and the row simply says
  // nothing rather than inventing a severity tier for a waiting patient.
  const attention = clinicalAttention({
    assessmentStatus: row.status,
    reviewPathway: row.reviewPathway,
    reviewPathwayReasons: row.reviewPathwayReasons,
  });
  const demographic = demographicLabel(row.patientAge, row.patientGender);
  const isSkin =
    row.concern === "skin_pigmentation" || row.concern === "skin_anti_ageing";
  const finding = isSkin
    ? row.concern === "skin_pigmentation"
      ? "Skin FACT · Pigmentation"
      : "Skin FACT · Anti-ageing"
    : labelForDiagnosis(row.primaryDiagnosis);
  return { attention, demographic, finding, href: reviewHref(row) };
}

function NextPatientCard({ row, tick }: { row: QueueRow; tick: number }) {
  const { attention, demographic, finding, href } = useCaseSummary(row);

  return (
    // `relative` + the stretched link below makes the entire card clickable
    // while keeping exactly one focusable control and valid markup — no
    // button nested inside an anchor.
    <div className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-28px_rgba(15,23,42,0.25)] transition-shadow focus-within:ring-2 focus-within:ring-slate-900/25 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_56px_-28px_rgba(15,23,42,0.3)]">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-100 to-stone-200 text-sm font-medium text-stone-600">
            {initialsOf(row.patientName)}
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="font-serif text-2xl leading-tight text-slate-900">
              {row.patientName}
              {demographic && (
                <span className="text-stone-400"> · {demographic}</span>
              )}
            </p>
            {finding && (
              <p className="text-[15px] text-stone-600">{finding}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-1">
              <ReadyForReview submittedAt={row.submittedAt} tick={tick} />
              {attention && <AttentionChip attention={attention} />}
              <span className="text-xs text-stone-500">{row.clinicName}</span>
            </div>
            {attention?.reason && (
              <p className="text-xs text-stone-500">{attention.reason}</p>
            )}
          </div>
        </div>

        <Link
          href={href}
          aria-label={`Review ${row.patientName}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none after:absolute after:inset-0 after:content-['']"
        >
          Review patient
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function QueueRowItem({ row, tick }: { row: QueueRow; tick: number }) {
  const { attention, demographic, finding, href } = useCaseSummary(row);

  return (
    <li className="group relative transition-colors hover:bg-stone-50 focus-within:bg-stone-50">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-100 to-stone-200 text-xs font-medium text-stone-600">
          {initialsOf(row.patientName)}
        </span>

        <div className="min-w-0 flex-1 basis-52 space-y-1">
          <p className="truncate font-medium text-slate-900">
            {row.patientName}
            {demographic && (
              <span className="font-normal text-stone-400"> · {demographic}</span>
            )}
          </p>
          {finding && (
            <p className="truncate text-sm text-stone-600">{finding}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <ReadyForReview submittedAt={row.submittedAt} tick={tick} />
            {attention && <AttentionChip attention={attention} />}
          </div>
        </div>

        <Link
          href={href}
          // Five rows of "Review" are indistinguishable to a screen reader;
          // the patient's name is what makes each link meaningful.
          aria-label={`Review ${row.patientName}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 after:absolute after:inset-0 after:content-['']"
        >
          Review
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </li>
  );
}

// A case the classifier flagged. Rendered only when there is something true to
// say — never as a severity tier applied to every waiting patient, and never
// as an ordering signal. Carries text in every state, so the flag is never
// communicated by colour alone.
function AttentionChip({ attention }: { attention: ClinicalAttention }) {
  const styles =
    attention.tone === "danger"
      ? "bg-red-50 text-red-800 ring-red-200"
      : "bg-amber-50 text-amber-900 ring-amber-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1 ${styles}`}
    >
      <span aria-hidden className="text-[11px] leading-none">
        !
      </span>
      {attention.label}
    </span>
  );
}

// Review state and how long it has been in that state, in one phrase.
//
// The clock starts at submittedAt — the moment the patient finished and a
// doctor became responsible. Not QR scan, not identity capture, not
// ClinicVisit.startedAt. `tick` is the minute clock: it is read only so React
// re-renders this text, which is computed locally and costs no request.
function ReadyForReview({
  submittedAt,
  tick,
}: {
  submittedAt: string | null;
  tick: number;
}) {
  void tick;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-stone-500"
      title={submittedAt ? `Submitted ${absoluteTimestamp(submittedAt)}` : undefined}
    >
      <Clock className="h-3 w-3" aria-hidden />
      Ready for review
      {submittedAt && <> · waiting {elapsedLabel(submittedAt)}</>}
    </span>
  );
}

// A patient in the building, mid-assessment. Not review work: there is no
// action here and deliberately no button, because there is nothing for the
// doctor to do until the patient submits.
//
// The clock is ClinicVisit.startedAt, which measures exactly one thing —
// how long this person has been answering questions. It is never carried
// forward into doctor-review waiting time.
function InClinicCard({ visit, tick }: { visit: InClinicVisit; tick: number }) {
  void tick;
  return (
    <li className="rounded-2xl border border-stone-200 bg-white px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-[11px] font-medium text-sky-700">
          {initialsOf(visit.displayName)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{visit.displayName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
            <PencilLine className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              Assessment in progress · started {elapsedLabel(visit.startedAt)} ago
            </span>
          </p>
        </div>
      </div>
    </li>
  );
}

// A number and what it counts. `href` is optional: "In clinic" has no page to
// open — those patients are mid-assessment and there is nothing to review —
// and a tile that links nowhere should not pretend to be clickable.
function Metric({
  label,
  value,
  href,
  loading,
  muted,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  loading: boolean;
  muted?: boolean;
  accent: "sky" | "amber" | "emerald" | "teal";
}) {
  const dot = muted
    ? "bg-stone-300"
    : accent === "sky"
      ? "bg-sky-500"
      : accent === "amber"
        ? "bg-amber-500"
        : accent === "emerald"
          ? "bg-emerald-500"
          : "bg-teal-600";

  const body = (
    <>
      <dd
        className={`font-serif text-3xl sm:text-4xl leading-none tabular-nums ${
          muted ? "text-stone-400" : "text-slate-900"
        }`}
      >
        {loading ? (
          <span className="inline-block h-8 w-12 rounded bg-stone-100 animate-pulse align-middle" />
        ) : (
          value.toLocaleString()
        )}
      </dd>
      <dt className="mt-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
        <span className={`inline-flex h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </dt>
    </>
  );

  const shell =
    "rounded-2xl border border-stone-200 bg-white px-4 py-4 transition-all";

  if (!href) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={`group ${shell} hover:border-stone-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-28px_rgba(15,23,42,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25`}
    >
      {body}
    </Link>
  );
}

function AllCaughtUp({
  approvedToday,
  inProgress,
}: {
  approvedToday: number;
  inProgress: number;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      </div>
      <p className="mt-4 font-serif text-xl text-slate-900">
        You&rsquo;re all caught up.
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-stone-500">
        {/* An empty Review Queue with people still answering questions is a
            different situation from an empty clinic, and saying so stops the
            doctor wondering whether the dashboard is stuck. */}
        {inProgress > 0
          ? `No patients are ready for review yet — ${inProgress} ${
              inProgress === 1 ? "is" : "are"
            } still completing an assessment.`
          : "No patients need your review."}
        {approvedToday > 0 &&
          ` You've approved ${approvedToday} ${approvedToday === 1 ? "case" : "cases"} today.`}
      </p>
      <Link
        href="/doctor/reports"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
      >
        View approved cases
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// Section-scoped failure. The rest of the dashboard keeps rendering whatever
// data it already has rather than collapsing into one full-page error.
function SectionError({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-200 bg-amber-50/60 px-6 py-8 text-center"
    >
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-stone-600">{body}</p>
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

// Skeletons mirror the real geometry so nothing shifts when data lands.
function NextPatientSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-stone-200 bg-white p-6 sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-stone-100" />
          <div className="space-y-2.5">
            <div className="h-7 w-56 rounded bg-stone-100" />
            <div className="h-4 w-64 rounded bg-stone-100" />
            <div className="h-5 w-40 rounded-full bg-stone-100" />
          </div>
        </div>
        <div className="h-11 w-40 rounded-full bg-stone-100" />
      </div>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <ul className="animate-pulse divide-y divide-stone-100">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <div className="h-10 w-10 rounded-full bg-stone-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-44 rounded bg-stone-100" />
            <div className="h-3.5 w-60 rounded bg-stone-100" />
            <div className="h-4 w-32 rounded-full bg-stone-100" />
          </div>
          <div className="h-9 w-24 rounded-full bg-stone-100" />
        </li>
      ))}
    </ul>
  );
}
