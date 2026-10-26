"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  growthDisplay,
  type GrowthSentiment,
  type MetricDirection,
} from "@/lib/admin/growth";

// Dashboard sections extracted so /admin/page.tsx stays readable.
//
// These are the two pieces that carry the new information hierarchy: the
// exceptions an operator must see first, and a statistic treatment light
// enough that a patient count no longer looks as urgent as a stalled pipeline.

export type HealthPayload = {
  score: number | null;
  band: "healthy" | "watch" | "critical" | "unknown";
  failureRatePct: number | null;
  failed: number;
  partialFailure: number;
  stalled: number;
  staleAfterMinutes: number;
  reasons: string[];
};

export const HEALTH_LABEL: Record<string, string> = {
  healthy: "Healthy",
  watch: "Watch",
  critical: "Critical",
  unknown: "No data",
};

/** Tone per band. Colour is never the only signal — the word is always shown. */
const HEALTH_TONE: Record<string, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-900",
  watch: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-rose-200 bg-rose-50 text-rose-900",
  unknown: "border-border bg-muted/30 text-foreground",
};

/**
 * What put the platform in this band, when the failure rate alone doesn't say.
 *
 * "WATCH · 0% failure rate · 7 days" is a legitimate output and it reads as a
 * contradiction: the only number on show is perfect. It is not a bug — the
 * band also answers to stalled work and partial failures, neither of which the
 * failure rate can see (see lib/admin/jobHealth). The chip was simply printing
 * one input and a verdict reached from three.
 *
 * This returns the counts actually responsible, and only those the API sent.
 * Nothing is inferred: if the numbers do not explain the band, this says
 * nothing rather than guessing at a reason.
 */
export function healthDrivers(health: HealthPayload): string | null {
  if (health.band === "unknown") {
    return "no assessments in the window";
  }
  const parts: string[] = [];
  if (health.stalled > 0) {
    parts.push(`${health.stalled} stalled`);
  }
  if (health.partialFailure > 0) {
    parts.push(
      `${health.partialFailure} partial failure${
        health.partialFailure === 1 ? "" : "s"
      }`,
    );
  }
  // The failure rate is already displayed beside this, so repeating the FAILED
  // count would restate the number rather than add to it.
  return parts.length > 0 ? parts.join(", ") : null;
}

interface Group<T> {
  available: boolean;
  count: number;
  items: T[];
}

export type ActionCentre = {
  needsAttention: number;
  unavailableGroups: string[];
  groups: Record<string, Group<unknown>>;
};
export type ActionCentrePayload = ActionCentre;

/**
 * How many distinct alert types are currently live — the "Issues requiring
 * action" headline. Counts the rows an operator would actually see in the
 * list below, not a sum of per-queue counts. Unavailable checks are not
 * counted as issues (they are a blind spot, surfaced separately).
 */
export function liveAttentionCount(data: ActionCentre | null): number {
  if (!data) return 0;
  return ATTENTION.filter((a) => {
    const g = data.groups[a.key];
    return g?.available && g.count > 0;
  }).length;
}

/**
 * The exception conditions worth leading the dashboard with.
 *
 * Every one is backed by a real query in /api/admin/action-centre — nothing
 * here is estimated, projected or invented. Each carries what happened, why it
 * matters, and where to go, because a count with no explanation just moves the
 * investigation one click later.
 */
const ATTENTION: {
  key: string;
  label: (n: number) => string;
  why: string;
  href: string;
  severe?: boolean;
}[] = [
  {
    key: "stalledAssessments",
    label: (n) => `${n} assessment${n === 1 ? "" : "s"} stalled`,
    why: "No progress for over an hour. These never reach a failed state, so nothing else flags them.",
    href: "/admin/operations?tab=assessments",
    severe: true,
  },
  {
    key: "rolelessAccounts",
    label: (n) => `${n} account${n === 1 ? "" : "s"} with no role`,
    why: "Can sign in and reach nothing — usually a mistyped address at sign-in.",
    href: "/admin/people?status=roleless",
  },
  {
    key: "paidOrdersAwaitingFulfilment",
    label: (n) => `${n} paid order${n === 1 ? "" : "s"} not sent to fulfilment`,
    why: "Money taken but nobody has been told to pack a kit.",
    href: "/admin/operations?tab=fulfilment",
    severe: true,
  },
  {
    key: "assessmentsAwaitingReview",
    label: (n) => `${n} awaiting doctor review`,
    why: "Complete and submitted, with no clinical decision yet.",
    href: "/admin/operations?tab=assessments",
  },
  {
    key: "kitFulfilmentAwaitingOps",
    label: (n) => `${n} fulfilment request${n === 1 ? "" : "s"} unclaimed`,
    why: "New requests nobody has picked up.",
    href: "/admin/operations?tab=fulfilment",
  },
  {
    key: "failedDeliveries",
    label: (n) => `${n} failed WhatsApp deliver${n === 1 ? "y" : "ies"}`,
    why: "A message to a patient did not arrive.",
    href: "/admin/operations",
    severe: true,
  },
  {
    key: "deliveriesAwaitingAcknowledgement",
    label: (n) => `${n} deliver${n === 1 ? "y" : "ies"} unconfirmed`,
    why: "Ops believes it arrived; the clinic has not said so.",
    href: "/admin/operations?tab=fulfilment",
  },
  {
    key: "unpaidCarts",
    label: (n) => `${n} unpaid cart${n === 1 ? "" : "s"}`,
    why: "Sent to a patient and still unpaid.",
    href: "/admin/operations?tab=orders",
  },
  {
    // Housekeeping, and shown as such. Nothing is broken and no patient is
    // affected — the national map is just incomplete. It sits last and is
    // never marked severe, because colouring an unpinned clinic like a failed
    // order would teach the operator to distrust the colours.
    key: "clinicsMissingLocation",
    label: (n) => `${n} clinic${n === 1 ? "" : "s"} missing a map location`,
    why: "Recorded on the platform but not placeable, so they are absent from the national map.",
    href: "/admin/clinics",
  },
];

export function NeedsAttention({
  health,
  data: dataProp,
  error: errorProp,
}: {
  health?: HealthPayload;
  // When a parent already fetched the action centre, pass it in and this
  // component renders it instead of fetching again — the Overview reads ONE
  // action-centre response for both the "Issues requiring action" metric and
  // this list. Omit both props and it self-fetches (preserves other callers).
  data?: ActionCentre | null;
  error?: string | null;
}) {
  const controlled = dataProp !== undefined || errorProp !== undefined;
  const [selfData, setSelfData] = useState<ActionCentre | null>(null);
  const [selfError, setSelfError] = useState<string | null>(null);

  useEffect(() => {
    if (controlled) return;
    let cancelled = false;
    fetch("/api/admin/action-centre", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (cancelled) return;
        setSelfData(j);
        setSelfError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setSelfError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [controlled]);

  const data = controlled ? dataProp ?? null : selfData;
  const error = controlled ? errorProp ?? null : selfError;

  const band = health?.band ?? "unknown";
  const drivers = health ? healthDrivers(health) : null;

  return (
    <section aria-labelledby="attention-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="attention-heading" className="text-sm font-semibold tracking-tight">
          Needs attention
        </h2>
        {/* ── Platform health ──────────────────────────────────────────────
            The band leads and the score is no longer shown as "100/100". That
            number is 100 minus the 7-day FAILURE RATE and knows nothing about
            stalled work — which is precisely how it could read a perfect 100
            beside a "Watch" badge. The arithmetic is unchanged; the label now
            says what the number actually measures.

            The chip also names what drove the band when the failure rate does
            not account for it, so "Watch · 0% failure rate" stops looking like
            a contradiction and starts reading as the sentence it always was. */}
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2.5 py-1 text-xs ${HEALTH_TONE[band]}`}
        >
          <Activity className="size-3.5 shrink-0" aria-hidden />
          <span className="font-semibold uppercase tracking-wide">
            {HEALTH_LABEL[band]}
          </span>
          {health && health.failureRatePct !== null && (
            <span className="opacity-80">
              {health.failureRatePct}% failure rate · 7 days
            </span>
          )}
          {health && drivers && (
            <span className="opacity-80">· {drivers}</span>
          )}
        </div>
      </div>

      {error ? (
        // A failed load must never be mistaken for a healthy platform.
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-medium">Unable to load exceptions.</strong>{" "}
          {error}. This is a loading failure, not an all-clear — there may be
          work needing attention that is not shown.
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Checking for issues…
        </div>
      ) : (
        <AttentionList data={data} health={health} />
      )}
    </section>
  );
}

function AttentionList({
  data,
  health,
}: {
  data: ActionCentre;
  health?: HealthPayload;
}) {
  const live = ATTENTION.map((a) => ({ ...a, group: data.groups[a.key] })).filter(
    (a) => a.group?.available && a.group.count > 0,
  );
  const blind = data.unavailableGroups ?? [];

  if (live.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-5">
          <p className="text-sm font-medium text-emerald-900">
            No issues requiring attention
          </p>
          <p className="mt-0.5 text-sm text-emerald-900/80">
            Every queue this console can read is clear
            {health && health.stalled === 0 ? " and no work is stalled." : "."}
          </p>
        </div>
        {blind.length > 0 && <BlindNotice groups={blind} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {live.map((a) => (
          <li
            key={a.key}
            className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3"
          >
            <span
              aria-hidden
              className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${
                a.severe ? "bg-rose-500" : "bg-amber-500"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{a.label(a.group!.count)}</span>
                {/* Severity is stated in words, not only in colour. */}
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {a.severe ? "High" : "Needs attention"}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{a.why}</p>
            </div>
            {/* Keyboard focus was invisible here: Tailwind's preflight clears
                the UA outline and the admin surface has no global
                :focus-visible rule (that one is scoped to the doctor
                surface), so the dashboard's primary action could be tabbed to
                with nothing on screen saying so. */}
            <Link
              href={a.href}
              className="shrink-0 self-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Investigate
            </Link>
          </li>
        ))}
      </ul>
      {blind.length > 0 && <BlindNotice groups={blind} />}
    </div>
  );
}

function BlindNotice({ groups }: { groups: string[] }) {
  return (
    <p className="text-xs text-amber-700">
      {groups.length} check{groups.length === 1 ? "" : "s"} could not be read (
      {groups.join(", ")}). The list above is a floor, not a full picture.
    </p>
  );
}

/**
 * A compact statistic.
 *
 * Deliberately much lighter than MetricCard: the previous dashboard gave a
 * patient count the same visual weight as a stalled pipeline, which told the
 * operator nothing about what deserved their eyes first.
 */
export function MiniStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /**
   * Semantic tone for the value. Follows the MEANING of the metric, never the
   * sign of the number — fewer failures is a good week, fewer assessments is
   * not. Callers decide; this only paints.
   */
  tone?: GrowthSentiment;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${VALUE_TONE[tone]}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/**
 * Restrained on purpose. A movement of nine patients is not an alert, so the
 * negative case is amber (attention) rather than rose (critical) — rose is
 * reserved for the health band and for failed work.
 */
const VALUE_TONE: Record<GrowthSentiment, string> = {
  good: "text-emerald-700",
  bad: "text-amber-700",
  neutral: "",
};

/**
 * A period-over-period comparison, presented by the rule in lib/admin/growth.
 *
 * The card looks like every other MiniStat because it IS one; what changes is
 * which of the two numbers gets to be the headline. At this network's scale
 * that is nearly always the absolute change, and the percentage drops to the
 * supporting line beside the denominator that makes it readable.
 */
export function ComparisonStat({
  label,
  current,
  previous,
  unit,
  direction = "neutral",
}: {
  label: string;
  current: number;
  previous: number;
  unit?: string;
  direction?: MetricDirection;
}) {
  const g = growthDisplay({ current, previous, unit, direction });
  return (
    <MiniStat
      label={label}
      value={g.primary}
      hint={g.secondary}
      tone={g.sentiment}
    />
  );
}

/**
 * Clinic activation & readiness — the three tiers kept deliberately distinct so
 * a DATABASE ACTIVE record is never mistaken for a working clinic.
 *
 *   DATABASE ACTIVE       — Clinic.status = ACTIVE in the database.
 *   ACCESS READY          — an active clinic whose doctor identity is
 *                           provisioned (can sign in); NOT proof of a live login.
 *   OPERATIONALLY VERIFIED — a trustworthy golden-path test record. There is no
 *                           such source yet, so this reads "Verification
 *                           pending" rather than inferring it from activity.
 */
export function ReadinessSummary({
  total,
  active,
  accessReady,
  operationallyVerified,
}: {
  total: number;
  active: number;
  accessReady: number;
  /** null → no trustworthy verification-record source exists; show pending. */
  operationallyVerified: number | null;
}) {
  return (
    <section aria-labelledby="readiness-heading" className="space-y-2">
      <h2
        id="readiness-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Clinic activation &amp; readiness
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card px-3.5 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Database active
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {active}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {total}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Enabled in the database (status = ACTIVE)
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card px-3.5 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Access ready
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {accessReady}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {active}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Active clinic with a provisioned doctor identity — not proof of a
            live login
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-3">
          <div className="text-[11px] uppercase tracking-wide text-amber-800">
            Operationally verified
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-amber-800">
            {operationallyVerified ?? "—"}
          </div>
          <div className="mt-0.5 text-xs text-amber-800">
            Verification pending — no golden-path test record source yet
          </div>
        </div>
      </div>
    </section>
  );
}

type ClinicPreviewRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

/**
 * Searchable clinic directory preview. Shows the first few clinics and routes
 * the full search to /admin/clinics (the authoritative directory). Zero,
 * loading, empty and error states are all explicit — a failed load must never
 * read as "no clinics".
 */
export function ClinicDirectoryPreview() {
  const router = useRouter();
  const [rows, setRows] = useState<ClinicPreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/clinics?limit=6", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (cancelled) return;
        setRows(j.rows ?? []);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(
      term ? `/admin/clinics?search=${encodeURIComponent(term)}` : "/admin/clinics",
    );
  };

  return (
    <section aria-labelledby="directory-heading" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="directory-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Clinic directory
        </h2>
        <Link
          href="/admin/clinics"
          className="rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          View all
        </Link>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clinics by name or slug…"
            aria-label="Search clinics"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? (
          <div className="px-4 py-3 text-sm text-amber-900">
            <strong className="font-medium">Couldn&apos;t load clinics.</strong>{" "}
            {error}. This is a loading failure, not an empty directory.
          </div>
        ) : rows === null ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Loading clinics…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No clinics yet.{" "}
            <Link href="/admin/clinics/new" className="underline">
              Create the first one
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/clinics/${c.id}/edit`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.slug}
                    </div>
                  </div>
                  <StatusBadge
                    tone={
                      c.status === "ACTIVE"
                        ? "success"
                        : c.status === "SUSPENDED"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {c.status}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
