"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { SearchBox } from "@/components/ui/search-box";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { MiniStat } from "@/components/admin/DashboardSections";

// ── Phase 1: Clinic Activation Overview ──────────────────────────────────────
// Deliberately simplified. The seven-section command centre and the MapLibre
// India network have been removed from the main dashboard for Phase 1 — the
// geographic code is preserved (src/components/admin/IndiaClinicNetwork.tsx,
// /api/admin/network) for a future release once the network passes ~50 clinics.
// This page answers one question for the Super Admin: which clinics are
// registered, and which are switched on.
//
// Counts come from the existing authenticated /api/admin/dashboard (clinicsTotal
// and clinicsActive); the register comes from the existing /api/admin/clinics.
// No new tables, no new endpoints, no clinic records are modified here.
//
// Definitions (must not drift):
//   • Active   = Clinic.status === "ACTIVE"
//   • Inactive = non-archived clinic whose status is not ACTIVE (e.g. SUSPENDED)
//   • Archived / soft-deleted (deletedAt set) is excluded by the APIs above and
//     never counts as either Active or Inactive.
// Activation here is a DATABASE state only. It does NOT assert the clinic is
// clinically verified or that a doctor can log in — see the caveat rendered
// below, which must stay.

type DashboardMetrics = {
  clinicsTotal: number;
  clinicsActive: number;
};

type ClinicRow = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: string;
  createdAt: string;
};

type Filter = "all" | "active" | "inactive";

// A clinic is active iff its status is exactly ACTIVE. Everything else returned
// by /api/admin/clinics (which already excludes archived/soft-deleted rows) is
// inactive. ARCHIVED is excluded here too, defensively, so a stray archived row
// can never be rendered or counted.
function isActive(status: string): boolean {
  return status === "ACTIVE";
}
function isArchived(status: string): boolean {
  return status === "ARCHIVED";
}

export default function AdminClinicActivationPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [clinics, setClinics] = useState<ClinicRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    // Authoritative counts. The register below can corroborate them, but these
    // are the numbers the dashboard reports.
    fetch("/api/admin/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) =>
        setMetrics({
          clinicsTotal: d.metrics.clinicsTotal,
          clinicsActive: d.metrics.clinicsActive,
        }),
      )
      .catch((e) => setError(String(e)));

    // The full non-archived register. Phase 1 is < 50 clinics by design, so a
    // single page (limit 200) holds the whole list and search/filter happen
    // client-side. "Inactive" spans several statuses, which the single-equals
    // `status` query param can't express, so we fetch all and classify here.
    fetch("/api/admin/clinics?limit=200", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) =>
        setClinics(
          (d.rows as ClinicRow[]).filter((c) => !isArchived(c.status)),
        ),
      )
      .catch((e) => setError(String(e)));
  }, []);

  // Counts: prefer the dashboard's authoritative numbers; fall back to the
  // register if the dashboard call failed but the list succeeded.
  const counts = useMemo(() => {
    if (metrics) {
      return {
        total: metrics.clinicsTotal,
        active: metrics.clinicsActive,
        inactive: Math.max(metrics.clinicsTotal - metrics.clinicsActive, 0),
      };
    }
    if (clinics) {
      const active = clinics.filter((c) => isActive(c.status)).length;
      return { total: clinics.length, active, inactive: clinics.length - active };
    }
    return null;
  }, [metrics, clinics]);

  const visible = useMemo(() => {
    if (!clinics) return [];
    const q = search.trim().toLowerCase();
    return clinics.filter((c) => {
      if (filter === "active" && !isActive(c.status)) return false;
      if (filter === "inactive" && isActive(c.status)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [clinics, search, filter]);

  if (error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load clinic overview" description={error} />
      </PageContainer>
    );
  }
  if (!counts || !clinics) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Clinic activation
          </h1>
          <p className="text-sm text-muted-foreground">
            {counts.active} of {counts.total}{" "}
            {counts.total === 1 ? "clinic" : "clinics"} active
          </p>
        </div>
        <Link href="/admin/clinics/new">
          <Button>
            <Plus />
            Create clinic
          </Button>
        </Link>
      </div>

      {/* ── Activation counts ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniStat label="Registered clinics" value={counts.total} hint="non-archived" />
        <MiniStat label="Active" value={counts.active} hint="status ACTIVE" />
        <MiniStat label="Inactive" value={counts.inactive} hint="e.g. suspended" />
      </div>

      {/* ── Honesty caveat (must stay) ──────────────────────────────────────
          "Active" is a database status only. It must never be read as a
          clinical sign-off or as proof a doctor can log in. */}
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        Activation reflects the clinic&rsquo;s database status only. It is{" "}
        <strong>not</strong> a clinical verification and does not confirm that a
        doctor can log in.
      </p>

      {/* ── Register: search + Active/Inactive filter ───────────────────── */}
      <section aria-labelledby="register-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="register-heading" className="text-sm font-semibold tracking-tight">
            Clinics
          </h2>
          <Link
            href="/admin/clinics"
            className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Manage clinics
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search by clinic name"
            className="min-w-[260px] flex-1"
          />
          <div
            role="group"
            aria-label="Filter by activation"
            className="inline-flex rounded-lg border border-border bg-background p-0.5 text-sm font-medium"
          >
            {(
              [
                ["all", "All"],
                ["active", "Active"],
                ["inactive", "Inactive"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`rounded-md px-3 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  filter === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {clinics.length === 0
                ? "No clinics registered yet."
                : "No clinics match this search or filter."}
            </p>
          ) : (
            visible.map((c) => (
              <Link
                key={c.id}
                href={`/admin/clinics/${c.id}/edit`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted focus:outline-none focus-visible:bg-muted"
              >
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logoUrl}
                    alt=""
                    className="size-9 rounded-md object-cover"
                  />
                ) : (
                  <Avatar name={c.name} size="sm" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.slug}
                  </div>
                </div>
                <StatusBadge tone={isActive(c.status) ? "success" : "neutral"}>
                  {isActive(c.status) ? "Active" : "Inactive"}
                </StatusBadge>
              </Link>
            ))
          )}
        </div>
        {visible.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {visible.length} of {clinics.length} registered{" "}
            {clinics.length === 1 ? "clinic" : "clinics"}.
          </p>
        )}
      </section>
    </PageContainer>
  );
}
