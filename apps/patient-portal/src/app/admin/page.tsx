"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import {
  NeedsAttention,
  MiniStat,
  ReadinessSummary,
  ClinicDirectoryPreview,
  liveAttentionCount,
  type HealthPayload,
  type ActionCentrePayload,
} from "@/components/admin/DashboardSections";
import { IndiaClinicNetwork } from "@/components/admin/IndiaClinicNetwork";

// Super Admin command centre — the Overview.
//
// Deliberately four honest metrics, the national map, the readiness summary, a
// clinic directory preview, and the live operational alerts — in that order.
// The conversion funnel and the recent clinics/doctors/assessments panels moved
// out of the primary Overview (funnel → Operations; recents are lower-value
// here) so the first screen answers "what needs me, and is the network ready?"
// rather than showing a patient count with the same weight as a stalled
// pipeline. Every value comes from /api/admin/* — nothing is hardcoded.
type Payload = {
  metrics: {
    clinicsTotal: number;
    clinicsActive: number;
    doctorsTotal: number;
    doctorsAccessReady: number;
    patientsTotal: number;
    assessmentsTotal: number;
    clinicsAccessReady: number;
    clinicsOperationallyVerified: number | null;
  };
  health?: HealthPayload;
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The action centre is fetched once here and shared: it drives both the
  // "Issues requiring action" metric and the alerts list below.
  const [action, setAction] = useState<ActionCentrePayload | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    fetch("/api/admin/action-centre", { cache: "no-store" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((j) => {
        if (!cancelled) {
          setAction(j);
          setActionError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setActionError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load dashboard" description={error} />
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  const m = data.metrics;
  // null while the action centre is still loading or failed — rendered as "—"
  // so a loading/error state never masquerades as "0 issues".
  const issues =
    actionError !== null ? null : action ? liveAttentionCount(action) : null;

  return (
    <PageContainer className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Command centre
          </h1>
          <p className="text-sm text-muted-foreground">
            {m.clinicsActive} active {m.clinicsActive === 1 ? "clinic" : "clinics"}{" "}
            · {m.doctorsTotal} {m.doctorsTotal === 1 ? "doctor" : "doctors"} ·{" "}
            {m.patientsTotal} {m.patientsTotal === 1 ? "patient" : "patients"}
          </p>
        </div>
        <Link href="/admin/clinics/new">
          <Button>
            <Plus />
            Create clinic
          </Button>
        </Link>
      </div>

      {/* ── Four command-centre metrics ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Total clinics"
          value={m.clinicsTotal}
          hint={`${m.clinicsActive} active`}
        />
        <MiniStat
          label="Doctors access-ready"
          value={m.doctorsAccessReady}
          hint={`of ${m.doctorsTotal} total`}
        />
        <MiniStat label="Patient assessments" value={m.assessmentsTotal} />
        <MiniStat
          label="Issues requiring action"
          value={issues === null ? "—" : issues}
          hint={
            actionError !== null
              ? "couldn't load"
              : issues === null
                ? "checking…"
                : issues === 0
                  ? "all clear"
                  : "see alerts below"
          }
          tone={issues !== null && issues > 0 ? "bad" : "neutral"}
        />
      </div>

      {/* ── Recent operational alerts ───────────────────────────────────── */}
      <NeedsAttention health={data.health} data={action} error={actionError} />

      {/* ── India clinic network ────────────────────────────────────────── */}
      <IndiaClinicNetwork />

      {/* ── Clinic activation & readiness ───────────────────────────────── */}
      <ReadinessSummary
        total={m.clinicsTotal}
        active={m.clinicsActive}
        accessReady={m.clinicsAccessReady}
        operationallyVerified={m.clinicsOperationallyVerified}
      />

      {/* ── Searchable clinic directory preview ─────────────────────────── */}
      <ClinicDirectoryPreview />
    </PageContainer>
  );
}
