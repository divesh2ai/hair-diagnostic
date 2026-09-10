"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Inbox,
  RotateCcw,
  Search,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { composeWorkflowLabel } from "@/lib/labels/statusLabels";
import { labelForDiagnosis } from "@/lib/labels/diagnosisLabels";
import { absoluteTimestamp, elapsedLabel } from "@/lib/format/waitingTime";
import { useVisibilityPolling } from "@/lib/doctor/useLiveDashboard";
import {
  clinicalAttention,
  demographicLabel,
  type ClinicalAttention,
} from "@/lib/doctor/reviewPriority";
import { reviewHref, isReviewUnavailable } from "@/lib/doctor/reviewHref";
import { useMinuteTick } from "@/lib/doctor/useLiveDashboard";

// Review Queue.
//
// Each row has to answer four questions and nothing else:
//
//   WHO?          patient name + age/sex
//   WHAT WAS      primary diagnosis, in clinician prose
//   FOUND?
//   HOW LONG?     waiting time, measured from submission
//   WHAT NOW?     an explicit "Review" button, not an ambiguous arrow
//
// ── FIFO, and nothing else ───────────────────────────────────────────────────
// The needs-review tab is ordered by submittedAt ascending: whoever finished
// first is seen first. That is the rule a waiting room can actually be run on,
// and the one patients and reception already believe is in force. The
// review-pathway classifier still labels a row when it has something to say,
// but it cannot move anyone up or down — a queue that silently reorders itself
// is one nobody can predict and everybody stops trusting.
//
// Removed deliberately:
//   • Clinical-priority sorting, and the priority-only filter that went with
//     it. See above; also, the classifier is disabled in production, so the
//     filter matched nothing while implying it had looked.
//   • "URGENT · 763h" — that badge derived clinical urgency from elapsed time,
//     so given enough backlog every case became urgent and none of them were.
//   • "Standard review" / "Review" chips on ordinary cases — a severity
//     hierarchy applied to a waiting room, saying nothing.
//   • The workflow badge on the needs-review tab, where every row is in the
//     same state and the row already says "Ready for review".
//   • "Care: <doctor>" when every visible row names the same doctor.

interface ReportRow {
  id: string;
  submittedAt: string | null;
  status: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  patientAge: number | null;
  patientGender: string | null;
  clinicId: string;
  clinicName: string;
  careDoctorId: string | null;
  careDoctorName: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  decision: string | null;
  decisionReviewerName: string | null;
  decisionAt: string | null;
  primaryDiagnosis: string | null;
  severity: string | null;
  reviewPathway: string | null;
  reviewPathwayReasons: string[] | null;
  consultationVersion: number | null;
  consultationApprovalStatus: string | null;
  concern: string | null;
  skinIntakeId: string | null;
  skinConcernCount: number;
  consultationStatus: string | null;
  imageCount: number;
  previousPrescriptionUploaded: boolean;
  medicationDeclared: boolean;
  medicalHistoryDeclared: boolean;
  bodyPigmentationSelected: boolean;
}

interface Facets {
  clinics: { id: string; name: string }[];
  doctors: { id: string; name: string }[];
  diagnoses: string[];
  severities: string[];
  statuses: string[];
}

interface Filters {
  search: string;
  dateFrom: string;
  dateTo: string;
  clinicId: string;
  doctorId: string;
  status: string;
  diagnosis: string;
  severity: string;
  assignedTo: string;
  decision: string;
  assignedToMe: boolean;
  waitingOverHours: string;
}

const EMPTY: Filters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  clinicId: "",
  doctorId: "",
  status: "",
  diagnosis: "",
  severity: "",
  assignedTo: "",
  decision: "",
  assignedToMe: false,
  waitingOverHours: "",
};

type Tab = "needs_review" | "all" | "approved";

const TABS: { id: Tab; label: string; icon: typeof Inbox }[] = [
  { id: "needs_review", label: "Needs review", icon: ClipboardCheck },
  { id: "all", label: "All", icon: Inbox },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
];

const WAITING_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any wait" },
  { value: "24", label: "Over 24 hours" },
  { value: "72", label: "Over 3 days" },
  { value: "168", label: "Over 1 week" },
];

function isTab(v: string | null): v is Tab {
  return v === "needs_review" || v === "all" || v === "approved";
}

// Deep-link params are read from window.location on mount rather than with
// useSearchParams().
//
// useSearchParams() forces the App Router to bail this route out to
// client-side rendering behind a Suspense boundary. In practice that left the
// server-rendered fallback mounted inside <main> while React rendered the real
// tree into a sibling container — two copies of the queue in one document, and
// the visible one never fetched. Reading the URL after mount keeps a single
// server-rendered tree and costs nothing: these params only matter on the
// first paint after a click from the dashboard.
export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("needs_review");
  const [filters, setFilters] = useState<Filters>(EMPTY);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab");
    if (isTab(urlTab)) setTab(urlTab);
    // `?priority=1` is deliberately ignored rather than removed from the
    // parser's history: old bookmarks and any link still carrying it now open
    // the ordinary FIFO queue instead of an empty one.
    setMounted(true);
  }, []);

  // Server render and first client render are byte-identical, so there is no
  // hydration mismatch to recover from. Rows are client-fetched regardless, so
  // nothing meaningful is lost from the server-rendered HTML.
  if (!mounted) return <QueuePageSkeleton />;

  return <ReviewQueue tab={tab} setTab={setTab} filters={filters} setFilters={setFilters} />;
}

function ReviewQueue({
  tab,
  setTab,
  filters,
  setFilters,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}) {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // One clock for the page, so every "waiting 6 min" advances together and
  // none of them cost a request.
  const minuteTick = useMinuteTick();

  const [doctorMe, setDoctorMe] = useState<{ id: string } | null>(null);
  const [doctorMeLoading, setDoctorMeLoading] = useState(true);
  const [doctorMeError, setDoctorMeError] = useState<string | null>(null);

  useEffect(() => {
    setDoctorMeLoading(true);
    fetch("/api/doctor/me")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load doctor profile");
        return r.json();
      })
      .then((data) => {
        setDoctorMe(data.doctor);
        setDoctorMeLoading(false);
      })
      .catch((err) => {
        setDoctorMeError(err instanceof Error ? err.message : String(err));
        setDoctorMeLoading(false);
      });
  }, []);

  const set = (k: keyof Filters, v: string | boolean) =>
    setFilters((f) => ({ ...f, [k]: v }));

  // Search is applied client-side, so it is not an "active filter" for the
  // More-filters badge; everything else round-trips to the server.
  const advancedFilterCount = (
    ["clinicId", "doctorId", "diagnosis", "severity", "assignedTo", "dateFrom", "dateTo"] as const
  ).filter((k) => Boolean(filters[k])).length;

  const effectiveQuery = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (k === "search" || k === "assignedToMe") continue;
      if (k === "waitingOverHours") continue;
      if (typeof v === "string" && v) p.set(k, v);
    }
    if (filters.assignedToMe && doctorMe?.id) {
      p.set("assignedTo", doctorMe.id);
    }
    if (filters.waitingOverHours) p.set("waitingOverHours", filters.waitingOverHours);
    if (tab === "needs_review") {
      p.set("status", "CLINICAL_READY,REPORT_GENERATING,COMPLETED,PENDING");
      p.set("includeSkinPigmentationPending", "1");
      p.set("decision", "PENDING");
      // Withhold cases that cannot actually be opened — no stored
      // questionnaire and no persisted consultation. The rule itself lives on
      // the server (lib/doctor/reviewQueue); this only says which tab we are
      // on, so the queue page, the dashboard counts and the next-patient
      // handoff all withhold the same rows. Such records stay visible on the
      // All tab, where they are not labelled "Ready for review".
      p.set("openableOnly", "1");
      // FIFO, ordered in Postgres. It has to happen server-side: this page
      // fetches a capped window out of a backlog several hundred deep, so
      // re-sorting that window in the browser would show the newest 200 and
      // label them "longest waiting".
      p.set("sort", "oldest");
    } else if (tab === "approved") {
      p.set("decision", "APPROVED");
    }
    p.set("limit", "200");
    return p.toString();
  }, [filters, tab, doctorMe]);

  const visibleRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.patientName, r.patientPhone, r.primaryDiagnosis, r.clinicName]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [rows, filters.search]);

  // "Care: Dr X" on every row of a single-doctor queue is pure noise. Show it
  // only when it actually distinguishes one row from another.
  const showCareDoctor = useMemo(() => {
    const ids = new Set(visibleRows.map((r) => r.careDoctorId ?? "—"));
    return ids.size > 1;
  }, [visibleRows]);

  // `background` distinguishes the 15-second poll from a real load.
  //
  // A background refresh must not touch `loading` — flipping it would replay
  // the skeleton over a queue the doctor is mid-way through reading, every
  // fifteen seconds. It must not clear the rows on failure either: a single
  // dropped poll in a clinic with patchy wifi would empty the waiting list and
  // read as "no patients", which is worse than showing data a few seconds old.
  // Same contract the dashboard's loadStats already uses.
  const load = useCallback(
    async (background = false) => {
      if (!background) {
        setLoading(true);
        setLoadError(false);
      }
      try {
        const res = await fetch(`/api/doctor/reports?${effectiveQuery}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
        setLoadError(false);
      } catch {
        if (!background) {
          setRows([]);
          setTotal(0);
          setLoadError(true);
        }
      } finally {
        if (!background) setLoading(false);
      }
    },
    [effectiveQuery],
  );

  // Keep the Review Queue current while the doctor is looking at it.
  //
  // `effectiveQuery` is a dependency of `load`, so the poll always re-runs the
  // CURRENT filter — changing a filter does not need to restart polling, and
  // polling never reverts a filter the doctor just set.
  useVisibilityPolling(() => load(true));

  useEffect(() => {
    fetch("/api/doctor/reports/facets")
      .then((r) => r.json())
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () =>
    setFilters((f) => ({ ...EMPTY, search: f.search }));

  const hasAnyFilter =
    advancedFilterCount > 0 ||
    Boolean(filters.waitingOverHours) ||
    filters.assignedToMe;

  return (
    <div className="min-h-full bg-stone-50">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-10 py-8 lg:py-12 space-y-7">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-teal-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500">
              Dr FACT · Clinical Intelligence
            </span>
          </div>
          <h1 className="font-serif text-3xl lg:text-4xl leading-[1.05] tracking-tight text-slate-900">
            Review Queue
          </h1>
          <p className="text-sm text-stone-600" aria-live="polite">
            {loading ? (
              "Loading…"
            ) : loadError ? (
              "Queue unavailable."
            ) : (
              <>
                <span className="tabular-nums font-medium text-slate-800">
                  {total.toLocaleString()}
                </span>{" "}
                {total === 1 ? "case" : "cases"}
                {visibleRows.length !== total && (
                  <>
                    {" · "}
                    <span className="tabular-nums text-slate-700">
                      {visibleRows.length}
                    </span>{" "}
                    shown
                  </>
                )}
              </>
            )}
          </p>
        </header>

        {/* ── PRIMARY FILTERS ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Search patient, phone, condition…"
              aria-label="Search patients"
              className="block w-full rounded-full border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          {/* No "Priority only" toggle. It filtered on the review-pathway
              classifier, which is disabled in production and populates no
              rows — so the control emptied the queue and implied it had
              looked. When the classifier is enabled and history backfilled,
              a filter can come back; it still must not reorder. */}

          <label className="sr-only" htmlFor="waiting-filter">
            Minimum waiting time
          </label>
          <select
            id="waiting-filter"
            value={filters.waitingOverHours}
            onChange={(e) => set("waitingOverHours", e.target.value)}
            className="rounded-full border border-stone-300 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
          >
            {WAITING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-sm hover:border-stone-400 ${
              doctorMeLoading
                ? "cursor-not-allowed opacity-60"
                : doctorMeError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : ""
            }`}
          >
            <input
              type="checkbox"
              checked={filters.assignedToMe}
              disabled={doctorMeLoading || !!doctorMeError}
              onChange={(e) => set("assignedToMe", e.target.checked)}
              className="h-3.5 w-3.5 rounded border-stone-300 text-slate-900 focus:ring-slate-900/20 disabled:opacity-50"
            />
            {doctorMeLoading
              ? "Loading profile…"
              : doctorMeError
                ? "Profile error"
                : "Assigned to me"}
          </label>
        </div>

        {/* ── TAB STRIP ─────────────────────────────────────────────────── */}
        <nav
          role="tablist"
          aria-label="Queue view"
          className="flex flex-wrap items-center gap-1 border-b border-stone-200"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`relative -mb-px inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 ${
                  active ? "text-slate-900" : "text-stone-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
                {active && (
                  <span className="absolute inset-x-4 -bottom-px h-px bg-slate-900" />
                )}
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2 pb-1">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 ${
                advancedFilterCount > 0
                  ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                  : "border-stone-300 bg-white text-slate-700 hover:border-stone-400"
              }`}
            >
              More filters
              {advancedFilterCount > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">
                  {advancedFilterCount}
                </span>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {hasAnyFilter && (
              <button
                onClick={reset}
                className="inline-flex items-center gap-1 rounded text-xs text-stone-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Reset
              </button>
            )}
          </div>
        </nav>

        {/* ── MORE FILTERS ─────────────────────────────────────────────── */}
        {filtersOpen && (
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
              Advanced
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Submitted from">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => set("dateFrom", e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="Submitted to">
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => set("dateTo", e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="Clinic">
                <select
                  value={filters.clinicId}
                  onChange={(e) => set("clinicId", e.target.value)}
                  className={INPUT}
                >
                  <option value="">All clinics</option>
                  {facets?.clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Care doctor">
                <select
                  value={filters.doctorId}
                  onChange={(e) => set("doctorId", e.target.value)}
                  className={INPUT}
                >
                  <option value="">All doctors</option>
                  {facets?.doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Diagnosis">
                <select
                  value={filters.diagnosis}
                  onChange={(e) => set("diagnosis", e.target.value)}
                  className={INPUT}
                >
                  <option value="">Any diagnosis</option>
                  {facets?.diagnoses.map((d) => (
                    <option key={d} value={d}>
                      {labelForDiagnosis(d)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Severity">
                <select
                  value={filters.severity}
                  onChange={(e) => set("severity", e.target.value)}
                  className={INPUT}
                >
                  <option value="">Any severity</option>
                  {facets?.severities.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reviewer">
                <select
                  value={filters.assignedTo}
                  onChange={(e) => set("assignedTo", e.target.value)}
                  className={INPUT}
                >
                  <option value="">Any</option>
                  {facets?.doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* ── RESULTS ─────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {loading ? (
            <SkeletonList />
          ) : loadError ? (
            <QueueError onRetry={load} />
          ) : visibleRows.length === 0 ? (
            <EmptyState tab={tab} filtered={hasAnyFilter || Boolean(filters.search)} onReset={reset} />
          ) : (
            <ul className="divide-y divide-stone-100">
              {visibleRows.map((r) => (
                <ReportCard
                  key={r.id}
                  row={r}
                  showCareDoctor={showCareDoctor}
                  isQueueTab={tab === "needs_review"}
                  // Re-render on the local minute tick so "waiting 6 min"
                  // advances without a request. Read as a prop rather than a
                  // hook per row: one timer for the page, not one per patient.
                  tick={minuteTick}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function ReportCard({
  row,
  showCareDoctor,
  isQueueTab,
  tick,
}: {
  row: ReportRow;
  showCareDoctor: boolean;
  /** True on the needs-review tab, where every row is pending by definition. */
  isQueueTab: boolean;
  /** Page-level minute clock. Read only so this row re-renders its wait text. */
  tick: number;
}) {
  void tick;
  const initials =
    row.patientName
      ?.split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "•";

  const workflow = composeWorkflowLabel({
    assessmentStatus: row.status,
    reviewDecision: row.decision,
    approvalStatus: row.consultationApprovalStatus,
  });
  // Display only — see lib/doctor/reviewPriority.clinicalAttention. Null for
  // routine and unclassified cases, which is nearly all of them, and the row
  // then says nothing rather than inventing a tier for a waiting patient.
  const attention = clinicalAttention({
    assessmentStatus: row.status,
    reviewPathway: row.reviewPathway,
    reviewPathwayReasons: row.reviewPathwayReasons,
  });
  const demographic = demographicLabel(row.patientAge, row.patientGender);
  const isDedicatedSkinReview =
    row.concern === "skin_pigmentation" || row.concern === "skin_anti_ageing";
  // No doctor review surface exists for this concern yet — see lib/doctor/reviewHref.
  const reviewUnavailable = isReviewUnavailable(row.concern);
  // Only when the engine actually established one.
  //
  // `labelForDiagnosis(null)` returns the string "Assessment in progress",
  // which is a sensible default in a report header and a flat contradiction
  // here: every row in this list also carries "Ready for review · waiting
  // 1 day". A doctor cannot act on a line that says the patient is both still
  // filling in the questionnaire and waiting for a decision. When there is no
  // diagnosis yet the row says nothing, exactly as the dashboard deck does.
  const diagnosis =
    isDedicatedSkinReview || !row.primaryDiagnosis
      ? null
      : labelForDiagnosis(row.primaryDiagnosis);

  return (
    <li className="group relative transition-colors hover:bg-stone-50/70 focus-within:bg-stone-50">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-100 to-stone-200 text-xs font-medium text-stone-600"
        >
          {initials}
        </span>

        {/* WHO / WHAT WAS FOUND / WHY / HOW LONG */}
        <div className="min-w-0 flex-1 basis-64 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <p className="truncate font-medium text-slate-900">
              {row.patientName}
              {demographic && (
                <span className="font-normal text-stone-400"> · {demographic}</span>
              )}
            </p>
            {row.concern === "skin_acne" && (
              <>
                <ConcernTag tone="rose">Acne</ConcernTag>
                <IntakeChip>Doctor review not available yet</IntakeChip>
              </>
            )}
            {row.concern === "skin_pigmentation" && (
              <>
                <ConcernTag tone="amber">Dr Skin FACT</ConcernTag>
                <ConcernTag tone="orange">Pigmentation</ConcernTag>
              </>
            )}
            {row.concern === "skin_anti_ageing" && (
              <>
                <ConcernTag tone="violet">Dr Skin FACT</ConcernTag>
                <ConcernTag tone="indigo">Anti-Ageing</ConcernTag>
              </>
            )}
            {row.skinIntakeId && row.skinConcernCount > 1 && (
              <ConcernTag tone="violet">
                Multi-concern Skin FACT · {row.skinIntakeId.slice(0, 8)}
              </ConcernTag>
            )}
          </div>

          {diagnosis && <p className="truncate text-sm text-stone-600">{diagnosis}</p>}

          {/* Pigmentation intake facts.
              Previously one amber run-on — "Images: 0 uploaded · Video
              consultation required · Medication declared · Medical history
              declared" — in which every clause looked equally alarming and the
              zero read as a warning. They are now neutral chips that each say
              what they are, with the absent-image case stated in words rather
              than as a bare count. Same facts, same source fields; nothing is
              added and nothing is hidden. */}
          {row.concern === "skin_pigmentation" && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <IntakeChip>
                {row.imageCount > 0
                  ? `${row.imageCount} image${row.imageCount === 1 ? "" : "s"}`
                  : "No images"}
              </IntakeChip>
              <IntakeChip>
                Video consult{" "}
                {(row.consultationStatus ?? "REQUIRED").toLowerCase().replaceAll("_", " ")}
              </IntakeChip>
              {row.previousPrescriptionUploaded && (
                <IntakeChip>Previous prescription</IntakeChip>
              )}
              {row.medicationDeclared && <IntakeChip>Medication declared</IntakeChip>}
              {row.medicalHistoryDeclared && (
                <IntakeChip>Medical history declared</IntakeChip>
              )}
              {row.bodyPigmentationSelected && <IntakeChip>Body pigmentation</IntakeChip>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-0.5">
            <WaitChip submittedAt={row.submittedAt} readyForReview={isQueueTab} />
            {attention && <AttentionChip attention={attention} />}
            <span className="truncate text-xs text-stone-500">{row.clinicName}</span>
            {showCareDoctor && row.careDoctorName && (
              <span className="truncate text-xs text-stone-500">
                Care: {row.careDoctorName}
              </span>
            )}
          </div>

          {attention?.reason && (
            <p className="text-xs text-stone-500">{attention.reason}</p>
          )}
        </div>

        {/* WHAT SHOULD I DO */}
        <div className="ml-auto flex shrink-0 items-center gap-3 self-center">
          {/* The workflow badge earns its place on "All" and "Approved",
              where rows differ. On the queue every row is pending by
              definition and the wait chip already says "Ready for review" —
              printing it twice is the duplicate status language this slice
              exists to remove. */}
          {!isQueueTab && (
            <StatusBadge tone={workflow.tone} className="hidden sm:inline-flex">
              {workflow.label}
            </StatusBadge>
          )}
          {/* The action names what the destination can actually do. An acne
              case has no review surface in this release, so promising
              "Review" would have the doctor believe a clinical read is
              waiting for them. The case is still one click away and still
              preserved — see the acne holding page. */}
          <Link
            href={reviewHref(row)}
            aria-label={
              reviewUnavailable
                ? `View ${row.patientName} — acne review not available yet`
                : `Review ${row.patientName}`
            }
            // Stretched link: the whole row is clickable, but the row still
            // has exactly one tab stop and one accessible name.
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 after:absolute after:inset-0 after:content-['']"
          >
            {reviewUnavailable ? "View case" : "Review"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </li>
  );
}

// A case the classifier flagged — and only such a case. Always carries text,
// never colour alone. Never affects order.
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

// Waiting time — its own axis. Never coloured by how long it has been.
function WaitChip({
  submittedAt,
  readyForReview,
}: {
  submittedAt: string | null;
  /** On the queue, the wait carries the row's state too — one phrase, one fact. */
  readyForReview: boolean;
}) {
  if (!submittedAt) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-stone-500"
      title={`Submitted ${absoluteTimestamp(submittedAt)}`}
    >
      <Clock className="h-3 w-3" aria-hidden />
      {readyForReview ? (
        <>Ready for review · waiting {elapsedLabel(submittedAt)}</>
      ) : (
        <>
          <span className="sr-only">Waiting </span>
          {elapsedLabel(submittedAt)}
        </>
      )}
    </span>
  );
}

function ConcernTag({
  tone,
  children,
}: {
  tone: "rose" | "amber" | "orange" | "violet" | "indigo";
  children: React.ReactNode;
}) {
  const styles = {
    rose: "bg-rose-50 text-rose-800 ring-rose-200",
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    orange: "bg-orange-50 text-orange-900 ring-orange-200",
    violet: "bg-violet-50 text-violet-900 ring-violet-200",
    indigo: "bg-indigo-50 text-indigo-900 ring-indigo-200",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${styles}`}
    >
      {children}
    </span>
  );
}

/**
 * A neutral intake fact on a queue row.
 *
 * Deliberately NOT a ConcernTag: those are amber/violet track badges that mean
 * "this is a Dr Skin FACT pigmentation case". An intake fact is not a concern
 * and not a severity, so it is not allowed to borrow either colour — it is a
 * quiet grey statement of what the record contains.
 */
function IntakeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs">
      <span className="block font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}

const INPUT =
  "block w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

function SkeletonList() {
  return (
    <ul className="animate-pulse divide-y divide-stone-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-start gap-4 px-4 py-4 sm:px-5">
          <div className="h-11 w-11 rounded-full bg-stone-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-52 rounded bg-stone-100" />
            <div className="h-3.5 w-64 rounded bg-stone-100" />
            <div className="h-5 w-40 rounded-full bg-stone-100" />
          </div>
          <div className="h-9 w-24 self-center rounded-full bg-stone-100" />
        </li>
      ))}
    </ul>
  );
}

function QueuePageSkeleton() {
  return (
    <div className="min-h-full bg-stone-50">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-10 py-8 lg:py-12 space-y-7">
        <div className="h-10 w-64 animate-pulse rounded bg-stone-100" />
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <SkeletonList />
        </div>
      </div>
    </div>
  );
}

function QueueError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="px-6 py-14 text-center">
      <p className="font-medium text-slate-900">Review Queue unavailable</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">
        We couldn&rsquo;t refresh your queue.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Try again
      </button>
    </div>
  );
}

function EmptyState({
  tab,
  filtered,
  onReset,
}: {
  tab: Tab;
  filtered: boolean;
  onReset: () => void;
}) {
  if (filtered) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <FileText className="h-5 w-5 text-stone-400" aria-hidden />
        </div>
        <p className="mt-4 font-serif text-lg text-slate-800">
          No cases match these filters.
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
          Adjust your filters, or clear them and start again.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Clear filters
        </button>
      </div>
    );
  }

  const copy =
    tab === "needs_review"
      ? {
          title: "You’re all caught up.",
          body: "No patients need your review. New consultations appear here as patients submit assessments.",
        }
      : tab === "approved"
        ? {
            title: "No approved cases yet.",
            body: "As you approve consultations they’ll collect here for reference.",
          }
        : {
            title: "No cases yet.",
            body: "Consultations appear here as patients complete their assessments.",
          };

  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
      </div>
      <p className="mt-4 font-serif text-lg text-slate-800">{copy.title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">{copy.body}</p>
      <Link
        href="/doctor"
        className="mt-6 inline-flex items-center gap-1 rounded text-xs text-slate-700 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
      >
        Back to dashboard
        <ChevronRight className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  );
}
