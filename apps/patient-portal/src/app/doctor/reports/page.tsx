"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
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
import {
  composeWorkflowLabel,
  composeOperationalReason,
} from "@/lib/labels/statusLabels";
import { labelForDiagnosis } from "@/lib/labels/diagnosisLabels";
import { waitingTime } from "@/lib/format/waitingTime";

// Editorial clinical inbox.
//
// The old page was a dense table with an 8-facet filter block on top. That
// competes with the real work (reading + approving cases). This rewrite:
//
//   • Puts the tabs + total count in a quiet hero, not a wall of chrome.
//   • Filters collapse into a single expandable panel that doesn't dominate
//     the initial scan.
//   • Rows become editorial cards — patient name is the primary object,
//     diagnosis + severity + decision live in a calm meta strip beneath.
//     The whole card is the click target; no per-row buttons.
//   • Warm stone palette + serif accents for headers. Numbers stay tabular.
//
// API contract identical: /api/doctor/reports?..., /api/doctor/reports/facets.

interface ReportRow {
  id: string;
  submittedAt: string | null;
  status: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
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
};

type Tab = "needs_review" | "all" | "approved";

const TABS: { id: Tab; label: string; icon: typeof Inbox }[] = [
  { id: "needs_review", label: "Needs review", icon: ClipboardCheck },
  { id: "all", label: "All", icon: Inbox },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("needs_review");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const activeFilterCount = Object.entries(filters).filter(([, v]) =>
    typeof v === "boolean" ? v : Boolean(v),
  ).length;

  const effectiveQuery = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (k === "search" || k === "assignedToMe") continue;
      if (typeof v === "string" && v) p.set(k, v);
    }
    if (filters.assignedToMe && doctorMe?.id) {
      p.set("assignedTo", doctorMe.id);
    }
    if (tab === "needs_review") {
      p.set("status", "CLINICAL_READY,REPORT_GENERATING,COMPLETED,PENDING");
      p.set("includeSkinPigmentationPending", "1");
      p.set("decision", "PENDING");
    } else if (tab === "approved") {
      p.set("decision", "APPROVED");
    }
    p.set("limit", "200");
    return p.toString();
  }, [filters, tab, doctorMe]);

  const visibleRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const filtered = !q
      ? rows
      : rows.filter((r) =>
          [r.patientName, r.patientPhone, r.primaryDiagnosis, r.clinicName]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q)),
        );
    // Needs-review tab: oldest waiting first so the "bleeding" cases surface.
    if (tab !== "needs_review") return filtered;
    return [...filtered].sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : Infinity;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : Infinity;
      return ta - tb;
    });
  }, [rows, filters.search, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doctor/reports?${effectiveQuery}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [effectiveQuery]);

  useEffect(() => {
    fetch("/api/doctor/reports/facets")
      .then((r) => r.json())
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => setFilters(EMPTY);

  return (
    <div className="min-h-full bg-stone-50">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10 py-10 lg:py-14 space-y-8">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-teal-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500">
              Dr FACT · Clinical Intelligence
            </span>
          </div>
          <h1 className="font-serif text-3xl lg:text-4xl leading-[1.05] tracking-tight text-slate-900">
            Clinical Review Queue
          </h1>
          <p className="text-sm text-stone-600">
            {loading ? (
              "Loading…"
            ) : (
              <>
                <span className="tabular-nums font-medium text-slate-800">
                  {total.toLocaleString()}
                </span>{" "}
                cases ·{" "}
                <span className="tabular-nums text-slate-700">
                  {visibleRows.length}
                </span>{" "}
                shown
              </>
            )}
          </p>
        </header>

        {/* ── PRIMARY FILTER STRIP (always visible) ────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Search patient, phone, condition…"
              className="block w-full rounded-full border border-stone-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-slate-900 focus:outline-none"
            aria-label="Submitted from"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-slate-900 focus:outline-none"
            aria-label="Submitted to"
          />
          <label className={`inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm cursor-pointer hover:border-stone-400 ${doctorMeLoading ? "opacity-60 cursor-not-allowed" : doctorMeError ? "border-red-200 bg-red-50 text-red-700" : ""}`}>
            <input
              type="checkbox"
              checked={filters.assignedToMe}
              disabled={doctorMeLoading || !!doctorMeError}
              onChange={(e) => set("assignedToMe", e.target.checked)}
              className="h-3.5 w-3.5 rounded border-stone-300 text-slate-900 focus:ring-slate-900/20 disabled:opacity-50"
            />
            {doctorMeLoading ? "Loading profile…" : doctorMeError ? "Profile error" : "Assigned to me"}
          </label>
        </div>

        {/* ── TAB STRIP ─────────────────────────────────────────────────── */}
        <nav
          role="tablist"
          aria-label="Report status"
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
                className={`relative -mb-px inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "text-slate-900"
                    : "text-stone-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" />
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
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilterCount > 0
                  ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                  : "border-stone-300 bg-white text-slate-700 hover:border-stone-400"
              }`}
            >
              More filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  filtersOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={reset}
                className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-slate-700"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
        </nav>

        {/* ── MORE FILTERS (collapsed by default, secondary controls) ─── */}
        {filtersOpen && (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
              Advanced
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          {loading ? (
            <SkeletonList />
          ) : visibleRows.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <ul className="divide-y divide-stone-100">
              {visibleRows.map((r) => (
                <ReportCard key={r.id} row={r} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function ReportCard({ row }: { row: ReportRow }) {
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
  const reason = composeOperationalReason({
    assessmentStatus: row.status,
    reviewDecision: row.decision,
    approvalStatus: row.consultationApprovalStatus,
  });
  const isDedicatedSkinReview = row.concern === "skin_pigmentation" || row.concern === "skin_anti_ageing";
  const diagnosis = isDedicatedSkinReview ? null : labelForDiagnosis(row.primaryDiagnosis);
  const waited = waitingTime(row.submittedAt);

  return (
    <li>
      <Link
        href={row.concern === "skin_pigmentation" ? `/doctor/reports/${row.id}/skin/pigmentation` : row.concern === "skin_anti_ageing" ? `/doctor/reports/${row.id}/skin/anti-ageing` : `/doctor/reports/${row.id}`}
        className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 hover:bg-stone-50/70 transition-colors"
      >
        {/* avatar */}
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-100 to-stone-200 text-xs font-medium text-stone-600">
          {initials}
        </span>

        {/* main column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="truncate font-medium text-slate-900">
              {row.patientName}
            </p>
            {row.concern === "skin_acne" && (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-800 ring-1 ring-rose-200">
                Acne
              </span>
            )}
            {row.skinIntakeId && row.skinConcernCount > 1 && <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 ring-1 ring-violet-200">Part of multi-concern Skin FACT · {row.skinIntakeId.slice(0, 8)}</span>}
            {row.concern === "skin_pigmentation" && <>
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200">Dr Skin FACT</span>
              <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-900 ring-1 ring-orange-200">Pigmentation</span>
            </>}
            {row.concern === "skin_anti_ageing" && <>
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900 ring-1 ring-violet-200">Dr Skin FACT</span>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-900 ring-1 ring-indigo-200">Anti-Ageing</span>
            </>}
            {diagnosis && <span className="text-sm text-stone-500 truncate">{diagnosis}</span>}
          </div>

          {reason && !isDedicatedSkinReview && (
            <p className="mt-1 text-xs font-medium text-slate-700">{reason}</p>
          )}
          {row.concern === "skin_pigmentation" && <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-amber-900">
            <span>Images: {row.imageCount} uploaded</span><span>·</span><span>Video consultation {(row.consultationStatus ?? "REQUIRED").toLowerCase().replaceAll("_"," ")}</span>
            {row.previousPrescriptionUploaded && <span>· Prescription uploaded</span>}{row.medicationDeclared && <span>· Medication declared</span>}{row.medicalHistoryDeclared && <span>· Medical history declared</span>}{row.bodyPigmentationSelected && <span>· Body pigmentation</span>}
          </div>}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {waited}
            </span>
            <Dot />
            <span className="truncate">{row.clinicName}</span>
            {row.careDoctorName && (
              <>
                <Dot />
                <span className="truncate">Care: {row.careDoctorName}</span>
              </>
            )}
            {row.consultationVersion != null && (
              <>
                <Dot />
                <span className="tabular-nums">v{row.consultationVersion}</span>
              </>
            )}
          </div>
        </div>

        {/* right column: urgency + workflow badge + arrow. */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end gap-1.5">
            <UrgencyBadge submittedAt={row.submittedAt} decision={row.decision} />
            <StatusBadge tone={workflow.tone}>{workflow.label}</StatusBadge>
          </div>
          <ArrowUpRight className="h-4 w-4 text-stone-300 transition-all group-hover:text-slate-700 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </Link>
    </li>
  );
}

// Urgency band — hours since submission for still-pending cases.
// >48h → red · 24-48h → amber · <24h → subtle. Suppressed for approved / no submit.
function UrgencyBadge({
  submittedAt,
  decision,
}: {
  submittedAt: string | null;
  decision: string | null;
}) {
  if (!submittedAt) return null;
  if (decision && decision !== "PENDING") return null;
  const hours = (Date.now() - new Date(submittedAt).getTime()) / 3_600_000;
  if (hours >= 48) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 ring-1 ring-red-200">
        <AlertTriangle className="size-2.5" />
        Urgent · {Math.round(hours)}h
      </span>
    );
  }
  if (hours >= 24) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
        {Math.round(hours)}h waiting
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-teal-100">
      New
    </span>
  );
}

function Dot() {
  return <span className="h-0.5 w-0.5 rounded-full bg-stone-300" />;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
    <ul className="divide-y divide-stone-100 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-4">
          <div className="h-11 w-11 rounded-full bg-stone-100" />
          <div className="space-y-2">
            <div className="h-4 w-52 rounded bg-stone-100" />
            <div className="h-3 w-72 rounded bg-stone-100" />
          </div>
          <div className="h-4 w-16 rounded bg-stone-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const copy =
    tab === "needs_review"
      ? {
          title: "A rare quiet moment.",
          body: "Every completed case has a decision. New consultations will appear here as patients submit assessments.",
        }
      : tab === "approved"
        ? {
            title: "No approved reports yet.",
            body: "As you approve consultations they'll collect here for reference.",
          }
        : {
            title: "No reports match these filters.",
            body: "Adjust your filters, or clear them and start again.",
          };
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
        <FileText className="h-5 w-5 text-stone-400" />
      </div>
      <p className="mt-4 font-serif text-lg text-slate-800">{copy.title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">{copy.body}</p>
      <Link
        href="/doctor"
        className="mt-6 inline-flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900"
      >
        Back to workspace
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
