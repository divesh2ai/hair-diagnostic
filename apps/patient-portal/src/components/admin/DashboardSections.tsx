"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
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

type ActionCentre = {
  needsAttention: number;
  unavailableGroups: string[];
  groups: Record<string, Group<unknown>>;
};

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
];

export function NeedsAttention({ health }: { health?: HealthPayload }) {
  const [data, setData] = useState<ActionCentre | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/action-centre", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (cancelled) return;
        setData(j);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
