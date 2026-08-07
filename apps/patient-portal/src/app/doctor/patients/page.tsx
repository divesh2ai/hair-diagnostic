"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock, Search, SlidersHorizontal, Users } from "lucide-react";

// Editorial patient registry.
//
// The list is the room's centre of gravity. Filters shrink to a quiet
// segmented control; the search takes visual priority because it's what
// clinicians reach for first. Rows read as small portraits: initials
// avatar, name, one-line meta with count + last visit.

interface PatientRow {
  id: string;
  name: string;
  phone: string;
  assessmentCount: number;
  lastAssessment?: string;
  lastStatus?: string | null;
}

type Sort = "recent" | "name" | "assessments";
type Filter = "all" | "active" | "no_assessments";

const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Most recent" },
  { id: "name", label: "Name" },
  { id: "assessments", label: "Assessments" },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "With assessments" },
  { id: "no_assessments", label: "No assessments" },
];

export default function AllPatientsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/doctor/patients")
      .then((r) => r.json())
      .then((d) => setPatients(d.patients ?? []))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    let rows = patients;
    if (filter === "active")
      rows = rows.filter((p) => p.assessmentCount > 0);
    if (filter === "no_assessments")
      rows = rows.filter((p) => p.assessmentCount === 0);

    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          (p.phone ?? "").toLowerCase().includes(q),
      );
    }

    return [...rows].sort((a, b) => {
      if (sort === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sort === "assessments") return b.assessmentCount - a.assessmentCount;
      const at = a.lastAssessment ? new Date(a.lastAssessment).getTime() : 0;
      const bt = b.lastAssessment ? new Date(b.lastAssessment).getTime() : 0;
      return bt - at;
    });
  }, [patients, query, sort, filter]);

  return (
    <div className="min-h-full bg-stone-50">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10 py-10 lg:py-14 space-y-8">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-teal-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500">
              DrFACT · Patient registry
            </span>
          </div>
          <h1 className="font-serif text-4xl lg:text-5xl leading-[1.05] tracking-tight text-slate-900">
            Patients
          </h1>
          <p className="text-base text-stone-600">
            {loading ? (
              "Loading…"
            ) : (
              <>
                <span className="tabular-nums font-medium text-slate-800">
                  {visible.length}
                </span>{" "}
                of{" "}
                <span className="tabular-nums text-slate-700">
                  {patients.length}
                </span>{" "}
                patient{patients.length === 1 ? "" : "s"}
              </>
            )}
          </p>
        </header>

        {/* ── SEARCH + CONTROLS ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone"
              className="w-full rounded-full border border-stone-200 bg-white pl-11 pr-4 py-3 text-sm placeholder-stone-400 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              options={FILTERS}
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
            />
            <label className="inline-flex items-center gap-2 text-xs text-stone-500">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── LIST ─────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          {loading ? (
            <SkeletonList />
          ) : visible.length === 0 ? (
            <EmptyState query={query} />
          ) : (
            <ul className="divide-y divide-stone-100">
              {visible.map((p) => (
                <PatientRow key={p.id} patient={p} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function PatientRow({ patient: p }: { patient: PatientRow }) {
  const initials =
    p.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "•";

  return (
    <li>
      <Link
        href={`/doctor/patients/${p.id}`}
        className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 hover:bg-stone-50/70 transition-colors"
      >
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-100 to-stone-200 text-xs font-medium text-stone-600">
          {initials}
        </span>

        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">
            {p.name || "(unnamed)"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
            {p.phone && <span>{p.phone}</span>}
            {p.phone && <Dot />}
            <span className="tabular-nums">
              {p.assessmentCount} assessment
              {p.assessmentCount === 1 ? "" : "s"}
            </span>
            {p.lastAssessment && (
              <>
                <Dot />
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(p.lastAssessment).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        </div>

        <ArrowUpRight className="h-4 w-4 text-stone-300 transition-all group-hover:text-slate-700 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

function Dot() {
  return <span className="h-0.5 w-0.5 rounded-full bg-stone-300" />;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1 shadow-sm">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-stone-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-stone-100 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-4">
          <div className="h-11 w-11 rounded-full bg-stone-100" />
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-stone-100" />
            <div className="h-3 w-72 rounded bg-stone-100" />
          </div>
          <div className="h-4 w-16 rounded bg-stone-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
        <Users className="h-5 w-5 text-stone-400" />
      </div>
      <p className="mt-4 font-serif text-lg text-slate-800">
        {query ? "No patients match your search." : "No patients yet."}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
        {query
          ? "Try a different name or phone number."
          : "Patients appear here after their first assessment."}
      </p>
    </div>
  );
}
