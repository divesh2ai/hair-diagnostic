"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { SearchBox } from "@/components/ui/search-box";
import { FilterBar } from "@/components/ui/filter-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClinicOpsDrawer } from "@/components/admin/ClinicOpsDrawer";
import type { OpsOverview, ClinicOpsRow, GatedKpi } from "@/lib/admin/opsDashboard/types";
import {
  relativeTime,
  STATUS_LABEL,
  STATUS_TONE,
  FILTER_OPTIONS,
  type ClinicFilterKey,
} from "@/lib/admin/opsDashboard/format";

// ── Super Admin operations control centre ────────────────────────────────────
// Replaces the Phase 1 "clinic activation" overview. Activation (a database
// flag) is now one column among many, not the whole dashboard; full clinic
// management stays one click away at /admin/clinics. Every number here is
// computed server-side from the live database by /api/admin/operations-overview
// with honest semantics (see lib/admin/opsDashboard): approvals are the
// post-approval model (never COMPLETED); kit intents are authorizations (never
// paid orders); revenue and delivery read "Not connected" where their migration
// is absent; last-sign-in is the authoritative auth.users value, or "Unknown"
// when that cannot be read.

function gatedToday(k: GatedKpi): string {
  return k.state === "CONNECTED" ? String(k.today ?? 0) : "—";
}
function gatedHint(k: GatedKpi, label: string): string {
  return k.state === "CONNECTED"
    ? `${k.allTime ?? 0} ${label} all-time`
    : "Not connected — migration not applied";
}

function matchesFilter(row: ClinicOpsRow, filter: ClinicFilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "neverLoggedIn":
      return row.flags.neverLoggedIn;
    case "noAssessments":
      return row.flags.noAssessments;
    case "pendingReview":
      return row.flags.pendingReview;
    case "missingConsultation":
      return row.flags.missingConsultation;
    case "reconciliationDiscrepancy":
      return row.flags.reconciliationDiscrepancy;
    case "reportDeliveryAttention":
      return row.flags.reportDeliveryAttention;
    case "activelyUsing":
      return row.flags.activelyUsing;
    default:
      return true;
  }
}

export default function AdminOperationsPage() {
  const [data, setData] = useState<OpsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Derived loading (orders-page pattern): the effect never calls setState
  // synchronously — it sets a loaded-key only after the fetch resolves, and
  // `loading` is computed from it. This satisfies react-hooks/set-state-in-effect.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState<ClinicFilterKey>("all");
  const [q, setQ] = useState("");

  const [openClinicId, setOpenClinicId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchKey = `${from}|${to}|${reloadNonce}`;
  const loading = loadedKey !== fetchKey;
  const reload = () => setReloadNonce((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      try {
        const r = await fetch(`/api/admin/operations-overview${qs ? `?${qs}` : ""}`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j: OpsOverview = await r.json();
        if (!cancelled) {
          setData(j);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoadedKey(fetchKey);
      }
    })();
    return () => {
      cancelled = true;
    };
    // fetchKey captures from/to/reloadNonce.
  }, [fetchKey, from, to]);

  const authReadable = data?.capabilities.authReadable ?? true;

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.clinics.filter(
      (c) =>
        matchesFilter(c, filter) &&
        (needle === "" ||
          c.name.toLowerCase().includes(needle) ||
          c.slug.toLowerCase().includes(needle)),
    );
  }, [data, filter, q]);

  const columns = useMemo<Column<ClinicOpsRow>[]>(
    () => [
      {
        key: "clinic",
        header: "Clinic",
        cell: (c) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {c.primaryBranch ?? "No branch set"}
              {c.branchCount > 1 ? ` +${c.branchCount - 1}` : ""} · {c.status}
            </div>
          </div>
        ),
      },
      {
        key: "doctors",
        header: "Doctors · last login",
        cell: (c) => {
          const login = !authReadable
            ? "sign-in unknown"
            : c.lastSignInAt
              ? relativeTime(c.lastSignInAt)
              : "never signed in";
          return (
            <div className="min-w-0">
              <div className="tabular-nums">{c.doctorCount} doctor{c.doctorCount === 1 ? "" : "s"}</div>
              <div className="truncate text-xs text-muted-foreground">
                {c.topDoctor ? `${c.topDoctor.name} · ${login}` : login}
              </div>
            </div>
          );
        },
      },
      {
        key: "assessments",
        header: "Assessments",
        align: "right",
        cell: (c) => (
          <div className="tabular-nums">
            <span className="font-medium">{c.assessments.today}</span>
            <span className="text-muted-foreground"> / {c.assessments.allTime}</span>
          </div>
        ),
      },
      {
        key: "review",
        header: "Approved · awaiting",
        align: "right",
        cell: (c) => (
          <div className="tabular-nums">
            <span className="font-medium">{c.approvals.allTime}</span>
            <span className="text-muted-foreground"> · </span>
            <span className={c.awaitingReview > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
              {c.awaitingReview}
            </span>
          </div>
        ),
      },
      {
        key: "pipeline",
        header: "Pipeline",
        align: "right",
        cell: (c) => {
          // Missing consultation (pipeline gap) and reconciliation conflicts are
          // shown apart from the doctor queue — a missing consultation is never
          // doctor inaction.
          const hasMissing = c.assessmentsWithoutConsultation > 0;
          const hasConflict = c.reconciliationDiscrepancies > 0;
          if (!hasMissing && !hasConflict) {
            return <div className="tabular-nums text-xs"><span className="text-muted-foreground">—</span></div>;
          }
          return (
            <div className="tabular-nums text-xs">
              {hasMissing && (
                <span className="text-amber-600 dark:text-amber-400" title="COMPLETED assessments with no consultation">
                  {c.assessmentsWithoutConsultation} no-consult
                </span>
              )}
              {hasMissing && hasConflict && <span className="text-muted-foreground"> · </span>}
              {hasConflict && (
                <span className="text-red-600 dark:text-red-400" title="Approved-version / reviewDecision conflicts">
                  {c.reconciliationDiscrepancies} conflict
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "kits",
        header: "Intents · orders",
        align: "right",
        cell: (c) => (
          <div className="tabular-nums">
            <span className="font-medium">{c.kitIntents}</span>
            <span className="text-muted-foreground"> · </span>
            {c.confirmedOrders.state === "CONNECTED" ? (
              <span className="text-muted-foreground">{c.confirmedOrders.allTime} paid</span>
            ) : (
              <span className="text-muted-foreground">n/c</span>
            )}
          </div>
        ),
      },
      {
        key: "reports",
        header: "Reports (appr · dossier · sent · deliv)",
        align: "right",
        cell: (c) => {
          // Approval and the rendered dossier asset are kept distinct: a gap
          // between them (dossier < approved) is surfaced, never hidden by
          // treating approval as availability.
          const gap = c.reports.dossiersReady < c.reports.approved;
          return (
            <div className="tabular-nums text-xs">
              <span className="font-medium">{c.reports.approved}</span>
              <span className="text-muted-foreground"> · </span>
              <span
                className={gap ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}
                title="ReportAsset PATIENT_REPORT_PDF rows that are READY (a confirmed asset, not inferred from approval)"
              >
                {c.reports.dossiersReady}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {c.reportsSent.state === "CONNECTED" ? c.reportsSent.allTime : "n/c"}
                {" · "}
                {c.reportsDelivered.state === "CONNECTED" ? c.reportsDelivered.allTime : "n/c"}
              </span>
            </div>
          );
        },
      },
      {
        key: "activity",
        header: "Last activity",
        align: "right",
        cell: (c) => <span className="text-xs text-muted-foreground">{relativeTime(c.lastActivityAt)}</span>,
      },
      {
        key: "status",
        header: "Operational status",
        cell: (c) => <StatusBadge tone={STATUS_TONE[c.primaryStatus]}>{STATUS_LABEL[c.primaryStatus]}</StatusBadge>,
      },
    ],
    [authReadable],
  );

  if (error) {
    return (
      <PageContainer className="space-y-5">
        <Header />
        <ErrorState title="Couldn't load the operations overview" description={error} action={<Button onClick={reload}>Retry</Button>} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-5">
      <Header />

      {!data ? (
        <LoadingState />
      ) : (
        <>
          <KpiStrip data={data} />
          <CapabilityNote data={data} />

          <FilterBar
            onClear={() => {
              setFrom("");
              setTo("");
              setFilter("all");
              setQ("");
            }}
          >
            <SearchBox value={q} onChange={setQ} placeholder="Search clinics…" className="min-w-[220px]" />
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wide">Status</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as ClinicFilterKey)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wide">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wide">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
          </FilterBar>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {filtered.length} of {data.clinics.length} clinic{data.clinics.length === 1 ? "" : "s"} · window:{" "}
              {data.window.label}
            </span>
            <span>Today&apos;s figures use the clinic-day in Asia/Kolkata.</span>
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(c) => c.clinicId}
            loading={loading}
            onRowClick={(c) => {
              setOpenClinicId(c.clinicId);
              setDrawerOpen(true);
            }}
            emptyTitle="No clinics match these filters"
            emptyDescription="Clear the filters to see every registered clinic."
          />
        </>
      )}

      <ClinicOpsDrawer clinicId={openClinicId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </PageContainer>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operations control centre</h1>
        <p className="text-sm text-muted-foreground">
          Live operational state for every HairOS clinic — adoption, review, reports and delivery.
        </p>
      </div>
      <Link href="/admin/clinics" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        <Building2 /> Clinic management <ArrowRight />
      </Link>
    </div>
  );
}

function KpiStrip({ data }: { data: OpsOverview }) {
  const k = data.kpis;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard
        label="Registered clinics"
        value={k.clinicsRegistered}
        hint={`${k.clinicsOperational} actively using HairOS`}
      />
      <MetricCard
        label="Doctors signed in"
        value={data.capabilities.authReadable ? k.doctorsSignedIn : "—"}
        hint={
          data.capabilities.authReadable
            ? `of ${k.doctorsTotal} onboarded`
            : `sign-in unknown · ${k.doctorsTotal} onboarded`
        }
      />
      <MetricCard
        label={`Assessments · ${data.window.label}`}
        value={k.assessments.today}
        hint={`${k.assessments.allTime} all-time`}
      />
      <MetricCard
        label={`Approvals · ${data.window.label}`}
        value={k.approvals.today}
        hint={`${k.approvals.allTime} approved · ${k.completedAssessments} completed (pipeline)`}
      />
      <MetricCard
        label="Awaiting doctor review"
        value={k.pendingReviews}
        hint="consultation versions pending a doctor"
      />
      <MetricCard
        label="Missing consultation"
        value={k.assessmentsWithoutConsultation}
        hint="completed assessments, no consultation — pipeline, not doctor"
      />
      <MetricCard
        label="Reconciliation discrepancies"
        value={k.reconciliationDiscrepancies}
        hint="approved-version / reviewDecision conflicts"
      />
      <MetricCard
        label="Dossiers ready"
        value={k.dossiersReady}
        hint={`of ${k.approvals.allTime} approved — asset confirmed, not inferred`}
      />
      <MetricCard
        label={`Reports sent · ${data.window.label}`}
        value={gatedToday(k.reportsSent)}
        hint={gatedHint(k.reportsSent, "sent")}
      />
      <MetricCard
        label={`Reports delivered · ${data.window.label}`}
        value={gatedToday(k.reportsDelivered)}
        hint={gatedHint(k.reportsDelivered, "delivered")}
      />
      <MetricCard
        label="Operationally using"
        value={k.clinicsOperational}
        hint={`${k.clinicsRegistered - k.clinicsOperational} not yet active`}
      />
    </div>
  );
}

function CapabilityNote({ data }: { data: OpsOverview }) {
  const notes: string[] = [];
  if (data.capabilities.payments === "NOT_CONNECTED")
    notes.push("Confirmed orders & revenue: Not connected (payment migration not applied here).");
  if (data.capabilities.delivery === "NOT_CONNECTED")
    notes.push("Report delivery: Not connected (delivery migration not applied here).");
  if (!data.capabilities.authReadable)
    notes.push("Doctor sign-in telemetry (auth.users) could not be read — last-login shows Unknown, not Never.");
  if (notes.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      {notes.map((n) => (
        <div key={n}>• {n}</div>
      ))}
    </div>
  );
}
