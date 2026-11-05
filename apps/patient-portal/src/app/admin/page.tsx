"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { PageContainer } from "@/components/app-shell/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ClinicOpsDrawer } from "@/components/admin/ClinicOpsDrawer";
import { AUTH_PROVIDER_LABEL } from "@/lib/admin/opsDashboard/authProvider";
import { absoluteTime } from "@/lib/admin/opsDashboard/format";
import {
  CLINIC_FILTERS, USAGE_LABEL, clinicUsage, monitorRows, requiresFollowUp,
  type ClinicMonitorFilter,
} from "@/lib/admin/opsDashboard/clinicMonitor";
import type { ClinicOpsRow, OpsOverview } from "@/lib/admin/opsDashboard/types";
import styles from "./clinic-monitor.module.css";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});
const numberFormat = new Intl.NumberFormat("en-IN");
const headings = [
  ["Clinic / doctor", "20%"], ["Login method", "10%"], ["Last doctor login", "11%"],
  ["Patients assessed", "9%"], ["Latest assessment", "11%"], ["Assessments · 7 days", "9%"],
  ["Reviews completed", "9%"], ["Usage status", "11%"], ["Details", "10%"],
];

function DateCell({ value, fallback }: { value: string | null; fallback: string }) {
  return value ? <time dateTime={value} title={absoluteTime(value)}>{dateFormat.format(new Date(value))}</time> : fallback;
}

function Field({ label, children, numeric }: { label: string; children: ReactNode; numeric?: boolean }) {
  return <td role="cell" className={numeric ? styles.number : undefined}>
    <span aria-hidden="true" className={styles.fieldLabel}>{label}</span>
    {children}
  </td>;
}

export default function AdminOperationsPage() {
  const [data, setData] = useState<OpsOverview | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<ClinicMonitorFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClinicOpsRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/operations-overview?range=7d", {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Overview unavailable");
        const overview: OpsOverview = await response.json();
        if (!controller.signal.aborted) setData(overview);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => controller.abort();
  }, [reload]);

  const rows = useMemo(() => monitorRows(data?.clinics ?? [], filter, search), [data, filter, search]);
  const environment = data?.dataEnvironment ?? "UNVERIFIED";
  const metrics = data ? [
    ["Total active clinics", data.kpis.clinicsActive],
    ["Clinics with assessments · 7 days", data.kpis.clinicsActive7d],
    ["Doctors with recorded login", data.capabilities.authReadable ? data.kpis.doctorsSignedIn : null],
    ["Clinics requiring follow-up", data.clinics.filter(requiresFollowUp).length],
  ] as const : [];

  const openDetails = (row: ClinicOpsRow) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  return (
    <PageContainer className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Clinic monitoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">Doctor access, patient assessments and reviews across clinics.</p>
        </div>
        {data && <div className="space-y-1 sm:text-right">
          <StatusBadge tone={environment === "PRODUCTION" ? "neutral" : "warning"}>
            {environment === "UNVERIFIED" ? "ENVIRONMENT UNVERIFIED" : environment}
          </StatusBadge>
          {environment === "STAGING" && <p className="text-xs text-muted-foreground">Test data · not production adoption</p>}
        </div>}
      </header>

      {!data && !error && <LoadingState title="Loading clinic monitoring…" />}
      {error && <ErrorState title="Could not load clinic monitoring" action={
        <Button variant="outline" onClick={() => { setError(false); setReload((n) => n + 1); }}>Retry</Button>
      } />}

      {data && <>
        <dl className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div key={label} className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
              <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</dt>
              <dd className="text-2xl font-semibold leading-none tabular-nums">
                {value === null ? <span className="text-sm text-muted-foreground">Unavailable</span> : numberFormat.format(value)}
              </dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="clinic-register" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border px-3 py-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <h2 id="clinic-register" className="text-base font-semibold">Clinics</h2>
              <p role="status" className="mt-0.5 text-xs text-muted-foreground">
                {numberFormat.format(rows.length)} of {numberFormat.format(data.clinics.length)} · Follow-up first · Dates in IST
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring sm:w-48">
                <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="sr-only">Search clinics or doctors</span>
                <input type="search" placeholder="Search clinics" value={search} onChange={(event) => setSearch(event.target.value)}
                  className="h-9 w-full min-w-0 bg-transparent text-sm outline-none" />
              </label>
              <select aria-label="Filter clinics" value={filter}
                onChange={(event) => setFilter(event.target.value as ClinicMonitorFilter)}
                className="h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring">
                {CLINIC_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          {rows.length === 0 ? <div className="p-4"><EmptyState title="No matching clinics" action={
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</Button>
          } /></div> : (
            <table aria-label="Clinic monitoring" className={styles.table} role="table">
              <colgroup>{headings.map(([label, width]) => <col key={label} style={{ width }} />)}</colgroup>
              <thead role="rowgroup"><tr role="row">
                {headings.map(([label], index) => <th key={label} role="columnheader" scope="col" className={[3, 5, 6].includes(index) ? styles.number : undefined}>{label}</th>)}
              </tr></thead>
              <tbody role="rowgroup">{rows.map((row) => {
                const usage = clinicUsage(row);
                return (
                  <tr role="row" key={row.clinicId}>
                    <th scope="row" role="rowheader" className={styles.identity}>
                      <button type="button" onClick={() => openDetails(row)} className="text-left font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                        {row.name}
                      </button>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.topDoctor?.name ?? "No doctor recorded"}</span>
                    </th>
                    <Field label="Login method">{AUTH_PROVIDER_LABEL[row.authProvider]}</Field>
                    <Field label="Last doctor login">
                      <DateCell value={row.lastSignInAt} fallback={data.capabilities.authReadable ? "Not recorded" : "Unavailable"} />
                    </Field>
                    <Field label="Patients assessed" numeric>{numberFormat.format(row.assessedPatientCount)}</Field>
                    <Field label="Latest assessment"><DateCell value={row.lastAssessmentAt} fallback="None" /></Field>
                    <Field label="Assessments · 7 days" numeric>{numberFormat.format(row.assessments7d)}</Field>
                    <Field label="Reviews completed" numeric>{numberFormat.format(row.reviewedCases.allTime)}</Field>
                    <td role="cell" className={styles.usage}>
                      <StatusBadge tone={usage === "recent" ? "success" : usage === "followUp" ? "warning" : "neutral"}>
                        {USAGE_LABEL[usage]}
                      </StatusBadge>
                    </td>
                    <td role="cell" className={styles.details}>
                      <button type="button" title="View Details" aria-label={`View Details for ${row.name}`} onClick={() => openDetails(row)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                        <span>View Details</span><ChevronRight aria-hidden="true" className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </section>
      </>}
      <ClinicOpsDrawer clinicId={selected?.clinicId ?? null} row={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </PageContainer>
  );
}
