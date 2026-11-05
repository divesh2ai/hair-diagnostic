"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ArrowRight, Copy, Download, Check } from "lucide-react";
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
  ADOPTION_STATUS_TONE,
  AUTH_PROVIDER_TONE,
  FILTER_OPTIONS,
  type ClinicFilterKey,
} from "@/lib/admin/opsDashboard/format";
import { ADOPTION_STATUS_LABEL } from "@/lib/admin/opsDashboard/adoption";
import { AUTH_PROVIDER_LABEL } from "@/lib/admin/opsDashboard/authProvider";
import { buildCeoSummary, buildAdoptionCsv, whatsappFollowUpTemplate } from "@/lib/admin/opsDashboard/ceoSummary";

// ── CEO daily clinic adoption & operations dashboard ──────────────────────────
// Extends the Super Admin operations control centre with the executive daily
// view: who is using HairOS, which doctors authenticate (and how), which clinics
// have gone quiet, and the single next action for each. Every number is computed
// server-side by /api/admin/operations-overview with honest semantics — a
// patient submission is never a doctor login or review; the auth method is read
// from auth.identities, never inferred; "operational" is never ClinicStatus
// alone.

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
    case "needsAttention":
      return row.flags.needsAttention;
    case "onboardingPending":
      return row.primaryStatus === "ONBOARDING_IDLE";
    case "neverLoggedIn":
      return row.flags.neverLoggedIn;
    case "loggedInNoActivity":
      return row.flags.loggedInNoActivity;
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
    case "noRecentActivity":
      return row.flags.noRecentActivity;
    default:
      return true;
  }
}

const RANGE_PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

type SortKey = "attention" | "staleness" | "sevenDay" | "reviews" | "name";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "attention", label: "Follow-up priority" },
  { value: "staleness", label: "Days since last assessment" },
  { value: "sevenDay", label: "7-day assessment volume" },
  { value: "reviews", label: "Doctor reviews" },
  { value: "name", label: "Clinic name" },
];

// Null days-since (no assessment ever) sorts as "most stale" — a very large
// sentinel — so never-started clinics surface at the top of a staleness sort.
const staleRank = (r: ClinicOpsRow) =>
  r.daysSinceLastAssessment === null ? Number.MAX_SAFE_INTEGER : r.daysSinceLastAssessment;

function sortRows(rows: ClinicOpsRow[], key: SortKey): ClinicOpsRow[] {
  const copy = [...rows];
  switch (key) {
    case "attention":
      return copy.sort((a, b) => {
        const pa = a.followUp.priority ?? 99;
        const pb = b.followUp.priority ?? 99;
        if (pa !== pb) return pa - pb;
        return staleRank(b) - staleRank(a);
      });
    case "staleness":
      return copy.sort((a, b) => staleRank(b) - staleRank(a));
    case "sevenDay":
      return copy.sort((a, b) => b.assessments7d - a.assessments7d);
    case "reviews":
      return copy.sort((a, b) => b.reviewedCases.allTime - a.reviewedCases.allTime);
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default function AdminOperationsPage() {
  const [data, setData] = useState<OpsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [range, setRange] = useState<string>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState<ClinicFilterKey>("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [q, setQ] = useState("");

  const [openClinicId, setOpenClinicId] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<ClinicOpsRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchKey = `${range}|${from}|${to}|${reloadNonce}`;
  const loading = loadedKey !== fetchKey;
  const reload = () => setReloadNonce((n) => n + 1);

  const pickRange = (r: string) => {
    setRange(r);
    setFrom("");
    setTo("");
  };
  const pickFrom = (v: string) => {
    setRange("");
    setFrom(v);
  };
  const pickTo = (v: string) => {
    setRange("");
    setTo(v);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      if (range) params.set("range", range);
      else {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
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
  }, [fetchKey, range, from, to]);

  const authReadable = data?.capabilities.authReadable ?? true;
  const identitiesReadable = data?.capabilities.identitiesReadable ?? true;

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const matched = data.clinics.filter(
      (c) =>
        matchesFilter(c, filter) &&
        (needle === "" ||
          c.name.toLowerCase().includes(needle) ||
          c.slug.toLowerCase().includes(needle) ||
          (c.topDoctor?.name.toLowerCase().includes(needle) ?? false)),
    );
    return sortRows(matched, sort);
  }, [data, filter, q, sort]);

  const loginLabel = (c: ClinicOpsRow) =>
    !authReadable ? "unknown" : c.lastSignInAt ? relativeTime(c.lastSignInAt) : "never";

  const columns = useMemo<Column<ClinicOpsRow>[]>(
    () => [
      {
        key: "clinic",
        header: "Clinic",
        cell: (c) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {c.topDoctor?.name ?? "No doctor"}
              {c.branchCount > 1 ? ` · ${c.branchCount} branches` : ""}
            </div>
          </div>
        ),
      },
      {
        key: "auth",
        header: "Authentication",
        cell: (c) => (
          <StatusBadge tone={AUTH_PROVIDER_TONE[c.authProvider]}>
            {AUTH_PROVIDER_LABEL[c.authProvider]}
          </StatusBadge>
        ),
      },
      {
        key: "login",
        header: "Last login",
        cell: (c) => <span className="text-xs text-muted-foreground">{loginLabel(c)}</span>,
      },
      {
        key: "docact",
        header: "Doctor activity",
        cell: (c) => (
          <span
            className="text-xs text-muted-foreground"
            title="Last authenticated doctor clinical action (excludes system & Super Admin)"
          >
            {relativeTime(c.lastDoctorActivityAt)}
          </span>
        ),
      },
      {
        key: "patients",
        header: "Patients",
        align: "right",
        cell: (c) => <span className="tabular-nums">{c.patientCount}</span>,
      },
      {
        key: "lastassess",
        header: "Last assessment",
        align: "right",
        cell: (c) => (
          <div className="text-xs tabular-nums">
            <div>{relativeTime(c.lastAssessmentAt)}</div>
            {c.daysSinceLastAssessment !== null && (
              <div className="text-muted-foreground">{c.daysSinceLastAssessment}d ago</div>
            )}
          </div>
        ),
      },
      {
        key: "lastcompleted",
        header: "Last completed",
        align: "right",
        cell: (c) => (
          <span className="text-xs text-muted-foreground">
            {relativeTime(c.lastCompletedAssessmentAt)}
          </span>
        ),
      },
      {
        key: "sevenday",
        header: "7-day",
        align: "right",
        cell: (c) => (
          <span className="tabular-nums font-medium" title="Assessments submitted in the last 7 days">
            {c.assessments7d}
          </span>
        ),
      },
      {
        key: "reviews",
        header: "Doctor reviews",
        align: "right",
        cell: (c) => (
          <span className="tabular-nums" title="Distinct cases a doctor reviewed (approved / rejected / revision)">
            {c.reviewedCases.allTime}
          </span>
        ),
      },
      {
        key: "adoption",
        header: "Adoption",
        cell: (c) => (
          <StatusBadge tone={ADOPTION_STATUS_TONE[c.adoptionStatus]}>
            {ADOPTION_STATUS_LABEL[c.adoptionStatus]}
          </StatusBadge>
        ),
      },
      {
        key: "followup",
        header: "Follow-up",
        cell: (c) =>
          c.followUp.priority === null ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <div className="min-w-0" title={c.followUp.reason}>
              <div className="truncate text-xs font-medium">{c.followUp.action}</div>
              <div className="text-[11px] text-muted-foreground">Priority {c.followUp.priority}</div>
            </div>
          ),
      },
    ],
    [authReadable],
  );

  if (error) {
    return (
      <PageContainer className="space-y-5">
        <Header data={null} />
        <ErrorState title="Couldn't load the adoption overview" description={error} action={<Button onClick={reload}>Retry</Button>} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-5">
      <Header data={data} />

      {!data ? (
        <LoadingState />
      ) : (
        <>
          <KpiStrip data={data} />
          <CapabilityNote data={data} />

          <FollowUpCentre
            rows={data.clinics}
            authReadable={authReadable}
            onOpen={(c) => {
              setOpenClinicId(c.clinicId);
              setOpenRow(c);
              setDrawerOpen(true);
            }}
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Period</span>
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => pickRange(p.value)}
                aria-pressed={range === p.value}
                className={cn(
                  "h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                  range === p.value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                )}
              >
                {p.label}
              </button>
            ))}
            {!range && <span className="text-xs text-muted-foreground">Custom range</span>}
          </div>

          <FilterBar
            onClear={() => {
              setRange("7d");
              setFrom("");
              setTo("");
              setFilter("all");
              setSort("attention");
              setQ("");
            }}
          >
            <SearchBox value={q} onChange={setQ} placeholder="Search clinic or doctor…" className="min-w-[220px]" />
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
              <span className="text-[11px] uppercase tracking-wide">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {SORT_OPTIONS.map((o) => (
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
                onChange={(e) => pickFrom(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wide">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => pickTo(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
          </FilterBar>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {filtered.length} of {data.clinics.length} clinic{data.clinics.length === 1 ? "" : "s"} · window:{" "}
              {data.window.label}
              {!identitiesReadable && " · auth providers unavailable (shown as Unknown)"}
            </span>
            <span>
              Last refreshed {relativeTime(data.generatedAt)} · clinic-day in Asia/Kolkata.
            </span>
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(c) => c.clinicId}
            loading={loading}
            onRowClick={(c) => {
              setOpenClinicId(c.clinicId);
              setOpenRow(c);
              setDrawerOpen(true);
            }}
            emptyTitle="No clinics match these filters"
            emptyDescription="Clear the filters to see every registered clinic."
          />

          <CeoSummary data={data} />
        </>
      )}

      <ClinicOpsDrawer clinicId={openClinicId} row={openRow} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </PageContainer>
  );
}

function Header({ data }: { data: OpsOverview | null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clinic adoption & operations</h1>
        <p className="text-sm text-muted-foreground">
          Daily view of which clinics use HairOS, how doctors authenticate, who has gone quiet, and the next
          action for each.
          {data ? ` Last refreshed ${relativeTime(data.generatedAt)}.` : ""}
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
  const authReadable = data.capabilities.authReadable;
  const idReadable = data.capabilities.identitiesReadable;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard
        label="Registered clinics"
        value={k.clinicsRegistered}
        hint={`${k.clinicsActive} enabled (status) · ${k.clinicsOperational} using HairOS`}
      />
      <MetricCard
        label="Active last 7 days"
        value={k.clinicsActive7d}
        hint={`${k.clinicsInactive7d} inactive 7d · ${k.clinicsInactive14d} dormant 14d`}
      />
      <MetricCard
        label="Requiring follow-up"
        value={k.clinicsNeedingAttention}
        hint={`${k.clinicsWithAssessments} clinics with assessment activity`}
      />
      <MetricCard label="Patients" value={k.patients} hint={`${k.completedAssessments} completed assessments`} />

      <MetricCard
        label="Doctors signed in"
        value={authReadable ? k.doctorsSignedIn : "—"}
        hint={
          authReadable
            ? `${k.doctorsIdentityLinked} identities linked · ${k.doctorsTotal} onboarded`
            : `sign-in unknown · ${k.doctorsTotal} onboarded`
        }
      />
      <MetricCard
        label="Login methods"
        value={idReadable ? `${k.doctorsGoogle}G · ${k.doctorsPhone}P` : "—"}
        hint={
          idReadable
            ? `${k.doctorsGoogle} Google · ${k.doctorsPhone} phone · ${k.doctorsNotLinked} not linked`
            : "auth.identities not readable here"
        }
      />
      <MetricCard
        label={`Assessments · ${data.window.label}`}
        value={k.assessments.today}
        hint={`${k.assessments.allTime} all-time · ${k.completedAssessments} completed`}
      />
      <MetricCard
        label={`Doctor reviews · ${data.window.label}`}
        value={k.reviewedCases.today}
        hint={`${k.reviewedCases.allTime} reviewed all-time`}
      />

      <MetricCard label="Consultations pending" value={k.pendingReviews} hint="awaiting a doctor" />
      <MetricCard
        label="Report assets"
        value={k.dossiersReady}
        hint={`ready · ${k.reportAssetsQueued} queued`}
      />
      <MetricCard
        label={`Reports delivered · ${data.window.label}`}
        value={gatedToday(k.reportsDelivered)}
        hint={gatedHint(k.reportsDelivered, "provider-confirmed")}
      />
      <MetricCard
        label="WhatsApp failed"
        value={gatedToday(k.reportsFailed)}
        hint={
          k.reportsFailed.state === "CONNECTED"
            ? "failed report sends — needs attention"
            : "Not connected — migration not applied"
        }
      />
    </div>
  );
}

function CapabilityNote({ data }: { data: OpsOverview }) {
  const notes: string[] = [];
  if (!data.capabilities.authReadable)
    notes.push("Doctor sign-in telemetry (auth.users) could not be read — last-login shows Unknown, not Never.");
  if (!data.capabilities.identitiesReadable)
    notes.push("Auth providers (auth.identities) could not be read — login method shows Unknown, not Not-linked.");
  if (data.capabilities.payments === "NOT_CONNECTED")
    notes.push("Confirmed orders & revenue: Not connected (payment migration not applied here).");
  if (data.capabilities.delivery === "NOT_CONNECTED")
    notes.push("Report delivery: Not connected (delivery migration not applied here).");
  if (notes.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      {notes.map((n) => (
        <div key={n}>• {n}</div>
      ))}
    </div>
  );
}

// ── Daily Follow-up Centre ────────────────────────────────────────────────────
// Clinics requiring attention today, ranked by the task's priority order, each
// with the suggested next action and a copyable (never auto-sent) WhatsApp
// nudge. No phone numbers or patient data — only what the dashboard already
// shows.
function FollowUpCentre({
  rows,
  authReadable,
  onOpen,
}: {
  rows: ClinicOpsRow[];
  authReadable: boolean;
  onOpen: (c: ClinicOpsRow) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const queue = useMemo(
    () =>
      rows
        .filter((r) => r.followUp.priority !== null)
        .sort((a, b) => {
          const pa = a.followUp.priority ?? 99;
          const pb = b.followUp.priority ?? 99;
          if (pa !== pb) return pa - pb;
          return staleRank(b) - staleRank(a);
        }),
    [rows],
  );

  async function copyTemplate(c: ClinicOpsRow) {
    try {
      await navigator.clipboard.writeText(whatsappFollowUpTemplate(c));
      setCopiedId(c.clinicId);
      window.setTimeout(() => setCopiedId((id) => (id === c.clinicId ? null : id)), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">
          Clinics requiring attention today
          <span className="ml-2 text-xs font-normal text-muted-foreground">{queue.length} clinic(s)</span>
        </h2>
      </div>
      {queue.length === 0 ? (
        <p className="text-xs text-muted-foreground">No clinics need a follow-up right now.</p>
      ) : (
        <div className="space-y-1.5">
          {queue.map((c) => (
            <div
              key={c.clinicId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
            >
              <button type="button" onClick={() => onOpen(c)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">
                    {c.followUp.priority}
                  </span>
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {c.topDoctor?.name ?? "No doctor"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {c.followUp.action} — {c.followUp.reason}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  last assessment {relativeTime(c.lastAssessmentAt)} · login{" "}
                  {!authReadable ? "unknown" : c.lastSignInAt ? relativeTime(c.lastSignInAt) : "never"} · doctor action{" "}
                  {relativeTime(c.lastDoctorActivityAt)}
                </div>
              </button>
              <Button variant="outline" size="sm" onClick={() => copyTemplate(c)}>
                {copiedId === c.clinicId ? <Check /> : <Copy />}
                {copiedId === c.clinicId ? "Copied" : "Copy WhatsApp"}
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Templates are copied for staff to send manually — HairOS sends nothing automatically and no phone
        numbers or patient data are included.
      </p>
    </section>
  );
}

// ── CEO Daily Summary ─────────────────────────────────────────────────────────
// On-demand, copyable text + CSV export. No patient names, numbers or clinical
// detail — clinic-level operational figures only.
function CeoSummary({ data }: { data: OpsOverview }) {
  const [copied, setCopied] = useState(false);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildCeoSummary(data));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  function downloadCsv() {
    const csv = buildAdoptionCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hairos-adoption-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">CEO daily summary</h2>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={copySummary}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy summary"}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download /> Export CSV
          </Button>
        </div>
      </div>
      <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        {buildCeoSummary(data)}
      </pre>
      <p className="text-[11px] text-muted-foreground">
        Operational figures only — no patient names, numbers or clinical detail. Generated on demand; nothing is
        sent externally.
      </p>
    </section>
  );
}
