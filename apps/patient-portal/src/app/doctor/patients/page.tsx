"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users, ArrowUpDown } from "lucide-react";
import { PageContainer } from "@/components/app-shell";

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
    if (filter === "active") rows = rows.filter((p) => p.assessmentCount > 0);
    if (filter === "no_assessments") rows = rows.filter((p) => p.assessmentCount === 0);

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
    <PageContainer className="space-y-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          DrFACT · Patient registry
        </p>
        <h2 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          All patients
        </h2>
        <p className="text-sm text-slate-500">
          {loading
            ? "Loading…"
            : `${visible.length} of ${patients.length} patient${patients.length === 1 ? "" : "s"}`}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone"
            className="rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm w-72 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <Pills
          options={FILTERS}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />

        <div className="ml-auto inline-flex items-center gap-2 text-xs text-slate-600">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
        {loading ? (
          <SkeletonList />
        ) : visible.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <ul className="divide-y divide-stone-200">
            {visible.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/doctor/patients/${p.id}`}
                  className="block px-5 py-4 hover:bg-stone-50 focus:outline-none focus:bg-stone-50"
                  aria-label={`Open ${p.name || "patient"} timeline`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {p.name || "(unnamed)"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {p.phone ? `${p.phone} · ` : ""}
                        {p.assessmentCount} assessment
                        {p.assessmentCount === 1 ? "" : "s"}
                        {p.lastAssessment
                          ? ` · last ${new Date(p.lastAssessment).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <span className="text-sm text-sky-600 font-medium whitespace-nowrap">
                      View timeline →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}

function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
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
    <ul className="divide-y divide-stone-200 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-2 w-full">
            <div className="h-4 w-48 bg-stone-100 rounded" />
            <div className="h-3 w-72 bg-stone-100 rounded" />
          </div>
          <div className="h-4 w-24 bg-stone-100 rounded" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-stone-100 grid place-items-center">
        <Users className="h-5 w-5 text-stone-400" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700">
        {query ? "No patients match your search" : "No patients yet"}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {query
          ? "Try a different name or phone number."
          : "Patients appear here after their first assessment."}
      </p>
    </div>
  );
}
