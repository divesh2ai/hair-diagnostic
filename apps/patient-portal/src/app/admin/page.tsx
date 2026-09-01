"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge, toneForAssessmentStatus } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import {
  NeedsAttention,
  MiniStat,
  ComparisonStat,
  type HealthPayload,
} from "@/components/admin/DashboardSections";
import { conversionPercent } from "@/lib/admin/growth";

type Payload = {
  metrics: {
    clinicsTotal: number;
    clinicsActive: number;
    doctorsTotal: number;
    patientsTotal: number;
    assessmentsToday: number;
    assessmentsCompletedToday: number;
    monthlyGrowth: number;
    // The raw comparison pair behind `monthlyGrowth`. Optional so an older
    // cached payload degrades to "no comparison available" rather than
    // rendering NaN. Month-to-date against the same elapsed slice of last
    // month — the API cuts both windows at the same offset.
    assessmentsThisMonth?: number;
    assessmentsLastMonth?: number;
    platformHealth: number;
  };
  // The honest health object. Optional so an older cached payload still
  // renders rather than crashing the page.
  health?: HealthPayload;
  recent: {
    clinics: Array<{
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      status: string;
      createdAt: string;
    }>;
    doctors: Array<{
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      clinicName: string;
      createdAt: string;
    }>;
    assessments: Array<{
      id: string;
      status: string;
      submittedAt: string | null;
      patientName: string;
      clinicName: string;
    }>;
  };
};

type Funnel = {
  counts: { clinics: number; doctors: number };
  funnel: {
    started: number;
    completed: number;
    approved: number;
    orders: number;
    ordersActive: number;
  };
  leaks: { editsRequested: number; rejected: number };
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setData)
      .catch((e) => setError(String(e)));
    fetch("/api/admin/funnel", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setFunnel)
      .catch(() => setFunnel(null));
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

  return (
    <PageContainer className="space-y-7">
      {/* ── Header ────────────────────────────────────────────────────────
          Four equally-weighted buttons used to sit here: Needs attention,
          Create clinic, View clinics, Audit. Three were redundant — Needs
          Attention is now the first section of this page, and Audit and
          Clinics are one click away in the sidebar. A header full of
          same-weight buttons tells the operator nothing about what matters. */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
          <p className="text-sm text-muted-foreground">
            {m.clinicsActive} active {m.clinicsActive === 1 ? "clinic" : "clinics"} ·{" "}
            {m.doctorsTotal} {m.doctorsTotal === 1 ? "doctor" : "doctors"} ·{" "}
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

      {/* ── 1. NEEDS ATTENTION ────────────────────────────────────────────
          The most important region of the page, and the reason Action Centre
          no longer exists as a separate destination. An operator should never
          have to navigate somewhere else to discover that something is broken. */}
      <NeedsAttention health={data.health} />

      {/* ── 2. TODAY ──────────────────────────────────────────────────────
          Only metrics with definitions we can defend. */}
      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="mb-2 text-sm font-semibold tracking-tight">
          Today
        </h2>
        {/* Only metrics that are genuinely about TODAY.
            Doctor approvals and kit orders were shown here first, sourced from
            the funnel — but those are all-time totals, and an all-time number
            under a heading that says "Today" is misleading however it is
            captioned. The admin dashboard API exposes no per-day approval or
            order counts, and inventing them is not an option, so this section
            says less and means it. The all-time view is the funnel below.

            "Stalled now" was the third card here and has been removed for two
            reasons. It is not a today number — jobHealth counts stalled work
            across all time on purpose, so a job wedged last week sat under a
            heading claiming to describe the day. And Needs Attention above
            already reports it in both directions: as a row with somewhere to
            go when there is stalled work, and as "no work is stalled" when
            there is not. Two cards that are true beats three that are not. */}
        {/* Same four-column grid as Network below, so the two honest cards sit on
            the same column rhythm as the four beneath them rather than at
            their own width. Two of four columns filled is a deliberate-looking
            row; two cards at a different size is a misalignment. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Assessments started" value={m.assessmentsToday} />
          <MiniStat label="Completed" value={m.assessmentsCompletedToday} />
        </div>
      </section>

      {/* ── 3. NETWORK OVERVIEW ───────────────────────────────────────────
          Context, not urgency. Deliberately lighter than Needs Attention:
          seven equally-sized KPI cards previously made a stalled pipeline and
          a patient count look like the same class of information. */}
      <section aria-labelledby="network-heading">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="network-heading" className="text-sm font-semibold tracking-tight">
            Network
          </h2>
          <Link
            href="/admin/clinics"
            className="rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            View clinics
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            label="Active clinics"
            value={m.clinicsActive}
            hint={`${m.clinicsTotal} total`}
          />
          <MiniStat label="Doctors" value={m.doctorsTotal} />
          <MiniStat label="Patients" value={m.patientsTotal} />
          {/* ── Growth ───────────────────────────────────────────────────────
              This card used to read "+450%", which was arithmetically correct
              and operationally meaningless: eleven assessments against a base
              of two. At this network's scale one extra patient moves the
              percentage by tens of points, so the absolute change leads and
              the percentage survives as context beside its denominator. The
              rule, and why the threshold is what it is, live in
              lib/admin/growth. Assessments arriving is the platform working,
              so a decline is a real operational signal, not just a smaller
              number — hence higherIsBetter rather than neutral. */}
          {m.assessmentsThisMonth !== undefined &&
          m.assessmentsLastMonth !== undefined ? (
            <ComparisonStat
              label="Assessments this month"
              current={m.assessmentsThisMonth}
              previous={m.assessmentsLastMonth}
              unit="assessment"
              direction="higherIsBetter"
            />
          ) : (
            // An older cached payload has the percentage but not the counts
            // behind it. Rather than show a figure we cannot qualify, say so.
            <MiniStat label="Assessments this month" value="—" hint="comparison unavailable" />
          )}
        </div>
      </section>

      {funnel && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelStrip funnel={funnel.funnel} leaks={funnel.leaks} />
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New clinics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.clinics.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent clinics.</p>
            )}
            {data.recent.clinics.map((c) => (
              <Link
                key={c.id}
                href={`/admin/clinics/${c.id}/edit`}
                className="flex items-center gap-3 rounded-md p-2 -mx-2 hover:bg-muted"
              >
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logoUrl}
                    alt=""
                    className="size-8 rounded-md object-cover"
                  />
                ) : (
                  <Avatar name={c.name} size="sm" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.slug}</div>
                </div>
                <StatusBadge tone={c.status === "ACTIVE" ? "success" : "neutral"}>
                  {c.status}
                </StatusBadge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New doctors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.doctors.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent doctors.</p>
            )}
            {data.recent.doctors.map((d) => (
              <div key={d.id} className="flex items-center gap-3">
                <Avatar name={d.name} src={d.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {d.clinicName}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent assessments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.assessments.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent assessments.</p>
            )}
            {data.recent.assessments.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {a.patientName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.clinicName}
                  </div>
                </div>
                <StatusBadge tone={toneForAssessmentStatus(a.status)}>
                  {a.status}
                </StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function FunnelStrip({
  funnel,
  leaks,
}: {
  funnel: Funnel["funnel"];
  leaks: Funnel["leaks"];
}) {
  const stages: { label: string; count: number; tone: string }[] = [
    { label: "Started", count: funnel.started, tone: "bg-stone-100 text-slate-800" },
    { label: "Completed", count: funnel.completed, tone: "bg-teal-100 text-teal-900" },
    { label: "Doctor approved", count: funnel.approved, tone: "bg-indigo-100 text-indigo-900" },
    { label: "Kit orders", count: funnel.orders, tone: "bg-amber-100 text-amber-900" },
    { label: "Active orders", count: funnel.ordersActive, tone: "bg-emerald-100 text-emerald-900" },
  ];
  // Same low-base rule as the growth card, for the same reason. These are
  // conversion ratios rather than period-over-period growth, but they break at
  // small samples identically — and the old code divided by `Math.max(1, prev)`,
  // which turns an empty preceding stage into a fabricated percentage of the
  // numerator. Below the threshold the counts speak for themselves.
  const top = stages[0].count;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-5">
        {stages.map((s, i) => {
          const prev = i === 0 ? null : stages[i - 1].count;
          // The first stage IS the denominator, so "100% of start" restated the
          // card rather than adding to it.
          const isStart = i === 0;
          // For the second stage the previous stage IS the start, so both
          // ratios are the same number and printing them twice says nothing
          // the first one did not.
          const prevIsTop = prev !== null && prev === top;
          const pctFromTop =
            isStart || prevIsTop ? null : conversionPercent(s.count, top);
          const pctFromPrev = prev === null ? null : conversionPercent(s.count, prev);
          const rates = [
            pctFromPrev != null
              ? `${pctFromPrev}% ${prevIsTop ? "of start" : "vs prev"}`
              : null,
            pctFromTop != null ? `${pctFromTop}% of start` : null,
          ].filter(Boolean);
          return (
            <div key={s.label} className={`rounded-xl ${s.tone} px-3 py-2.5`}>
              <div className="text-[10px] uppercase tracking-wider opacity-80">{s.label}</div>
              <div className="font-serif text-2xl leading-tight tabular-nums">{s.count.toLocaleString()}</div>
              <div className="mt-1 text-[10px] opacity-80">
                {isStart
                  ? "start of funnel"
                  : rates.length > 0
                    ? rates.join(" · ")
                    : `of ${prev!.toLocaleString()} at the previous stage`}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Assessments started → completed → doctor-approved → kit order intent → active (not
        cancelled). Excludes soft-deleted assessments.
        {(leaks.editsRequested > 0 || leaks.rejected > 0) && (
          <>
            {" "}
            <span className="text-amber-700">
              {leaks.editsRequested.toLocaleString()} sent back for edits,{" "}
              {leaks.rejected.toLocaleString()} rejected
            </span>{" "}
            — counted as leaks, not as approvals.
          </>
        )}
      </p>
    </div>
  );
}
