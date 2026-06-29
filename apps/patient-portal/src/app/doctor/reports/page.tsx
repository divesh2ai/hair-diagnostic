"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Filter, RotateCcw, FileText, ClipboardCheck, Inbox } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import {
  DecisionBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/ui/StatusBadges";

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
}

interface Facets {
  clinics: { id: string; name: string }[];
  doctors: { id: string; name: string }[];
  diagnoses: string[];
  severities: string[];
  statuses: string[];
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  clinicId: string;
  doctorId: string;
  status: string;
  diagnosis: string;
  severity: string;
  assignedTo: string;
  decision: string;
}

const EMPTY: Filters = {
  dateFrom: "",
  dateTo: "",
  clinicId: "",
  doctorId: "",
  status: "",
  diagnosis: "",
  severity: "",
  assignedTo: "",
  decision: "",
};

type Tab = "needs_review" | "all" | "approved";

const TABS: { id: Tab; label: string; icon: typeof Inbox }[] = [
  { id: "needs_review", label: "Needs review",  icon: ClipboardCheck },
  { id: "all",          label: "All reports",   icon: Inbox },
  { id: "approved",     label: "Approved",      icon: FileText },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("needs_review");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  // Tab is a coarse pre-filter that composes with the detail filters. We
  // never modify `filters` from the tab — that lets the user keep their
  // current detail filters as they flip tabs.
  const effectiveQuery = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) p.set(k, v);
    }
    if (tab === "needs_review") {
      p.set("status", "COMPLETED");
      p.set("decision", "PENDING");
    } else if (tab === "approved") {
      p.set("decision", "APPROVED");
    }
    p.set("limit", "200");
    return p.toString();
  }, [filters, tab]);

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
    <PageContainer className="space-y-6">
      {/* ── Editorial header ─────────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          DrFACT · Clinical inbox
        </p>
        <h2 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          All reports
        </h2>
        <p className="text-sm text-slate-500">
          {loading ? "Loading…" : `${total} total · showing ${rows.length}`}
        </p>
      </header>

      {/* ── Primary tab bar ──────────────────────────────────────────────── */}
      <nav
        role="tablist"
        aria-label="Report status"
        className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* ── Filters card ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Filters</h3>
          </div>
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
          <FilterField label="From">
            <input type="date" value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} className="input" />
          </FilterField>
          <FilterField label="To">
            <input type="date" value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} className="input" />
          </FilterField>
          <FilterField label="Clinic">
            <select value={filters.clinicId} onChange={(e) => set("clinicId", e.target.value)} className="input">
              <option value="">All clinics</option>
              {facets?.clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Doctor (care)">
            <select value={filters.doctorId} onChange={(e) => set("doctorId", e.target.value)} className="input">
              <option value="">All doctors</option>
              {facets?.doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Status">
            <select value={filters.status} onChange={(e) => set("status", e.target.value)} className="input">
              <option value="">Any</option>
              {facets?.statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Diagnosis">
            <select value={filters.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} className="input">
              <option value="">Any diagnosis</option>
              {facets?.diagnoses.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Severity">
            <select value={filters.severity} onChange={(e) => set("severity", e.target.value)} className="input">
              <option value="">Any severity</option>
              {facets?.severities.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Assigned to (reviewer)">
            <select value={filters.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} className="input">
              <option value="">Any</option>
              {facets?.doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </FilterField>
        </div>
      </section>

      {/* ── Reports table ────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-600 text-[11px] uppercase tracking-[0.12em]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Patient</th>
                <th className="text-left px-4 py-3 font-semibold">Clinic</th>
                <th className="text-left px-4 py-3 font-semibold">Care doctor</th>
                <th className="text-left px-4 py-3 font-semibold">Diagnosis</th>
                <th className="text-left px-4 py-3 font-semibold">Severity</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Decision</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    {tab === "needs_review"
                      ? "Nothing to review right now — every completed case has a decision."
                      : "No reports match these filters."}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                return (
                  <tr key={r.id} className="hover:bg-stone-50/70">
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.patientName}</p>
                      {r.patientPhone && <p className="text-xs text-slate-500">{r.patientPhone}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.clinicName}</td>
                    <td className="px-4 py-3 text-slate-700">{r.careDoctorName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.primaryDiagnosis ?? "—"}</td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={r.severity} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      {r.decision ? (
                        <div className="flex flex-col gap-0.5">
                          <DecisionBadge decision={r.decision} className="w-fit" />
                          {r.decisionReviewerName && (
                            <span className="text-[11px] text-stone-500">
                              by {r.decisionReviewerName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/doctor/reports/${r.id}`}
                        className="inline-flex items-center gap-1 text-sky-600 font-medium text-sm hover:text-sky-700"
                      >
                        <FileText className="h-3.5 w-3.5" /> Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: white;
          color: rgb(15 23 42);
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgb(14 165 233);
          box-shadow: 0 0 0 3px rgb(14 165 233 / 0.15);
        }
      `}</style>
    </PageContainer>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs">
      <span className="block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
