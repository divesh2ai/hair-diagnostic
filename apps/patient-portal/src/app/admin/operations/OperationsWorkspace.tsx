"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  PackageSearch,
  ShoppingCart,
  Timer,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { hrefFor, type TabId } from "./tabs";
import AdminOrdersPage from "../orders/page";
import AdminFulfilmentPage from "../fulfilment/page";

// Operations — the single operational workspace.
//
// ── Why this page exists ────────────────────────────────────────────────────
// Kit Orders, Fulfilment and the operational review queue were three separate
// top-level sidebar entries. They are not three jobs; they are three stages of
// one job — work moving through the platform. A Super Admin asking "what is
// stuck?" had to know which of three services owned the answer.
//
// ── Reuse, not reimplementation ─────────────────────────────────────────────
// The Orders and Fulfilment tabs render the EXISTING page components directly.
// Nothing about those surfaces was rebuilt, restyled or re-authorised, and
// their routes (/admin/orders, /admin/fulfilment) still work as deep links —
// they are simply no longer top-level concepts. That keeps this diff contained
// and means any bookmark or link already in circulation keeps resolving.

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <AlertTriangle className="size-4" aria-hidden /> },
  { id: "assessments", label: "Assessments", icon: <ClipboardList className="size-4" aria-hidden /> },
  { id: "orders", label: "Orders", icon: <ShoppingCart className="size-4" aria-hidden /> },
  { id: "fulfilment", label: "Fulfilment", icon: <PackageSearch className="size-4" aria-hidden /> },
];

/**
 * The workspace. The active tab arrives as a prop from the server component,
 * which reads it straight off `searchParams`.
 *
 * Deliberately NOT `useSearchParams()`: that hook forces the nearest Suspense
 * boundary to fall back during prerender, and on this route the boundary never
 * resolved — the page sat on its loading state forever. Resolving the tab on
 * the server removes the boundary, the hook and the failure mode together.
 */
export default function OperationsWorkspace({ tab }: { tab: TabId }) {
  return (
    <div>
      <PageContainer className="pb-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
          <p className="text-sm text-muted-foreground">
            Work moving through the platform — what is stuck, what is waiting,
            and what is on its way to a patient.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Operations views"
          className="mt-5 flex flex-wrap gap-1 border-b border-border"
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              // A link, not a button: these change the URL, so they must be
              // navigable, middle-clickable and shareable.
              <Link
                key={t.id}
                href={hrefFor(t.id)}
                role="tab"
                id={`ops-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`ops-panel-${t.id}`}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.icon}
                {t.label}
              </Link>
            );
          })}
        </div>
      </PageContainer>

      <div
        role="tabpanel"
        id={`ops-panel-${tab}`}
        aria-labelledby={`ops-tab-${tab}`}
      >
        {tab === "overview" && <OperationsOverview />}
        {tab === "assessments" && <AssessmentsNeedingAttention />}
        {/* Existing surfaces, rendered as-is. */}
        {tab === "orders" && <AdminOrdersPage />}
        {tab === "fulfilment" && <AdminFulfilmentPage />}
      </div>
    </div>
  );
}

/* ─────────────────────────── Overview ─────────────────────────── */

interface Group<T> {
  available: boolean;
  count: number;
  items: T[];
}

type ActionCentre = {
  needsAttention: number;
  unavailableGroups: string[];
  unpaidFollowupHours: number;
  groups: Record<string, Group<unknown>>;
};

/** Exception groups, in the order an operator should work them. */
const EXCEPTIONS: { key: string; label: string; why: string; href: string }[] = [
  {
    key: "stalledAssessments",
    label: "Assessments stalled mid-pipeline",
    why: "Started and never finished. These never reach a failed state, so nothing else flags them.",
    href: "/admin/operations?tab=assessments",
  },
  {
    key: "assessmentsAwaitingReview",
    label: "Awaiting doctor review",
    why: "Submitted and complete, but no clinical decision yet.",
    href: "/admin/operations?tab=assessments",
  },
  {
    key: "paidOrdersAwaitingFulfilment",
    label: "Paid, no fulfilment request",
    why: "Money taken but nobody has been told to pack a kit.",
    href: "/admin/operations?tab=fulfilment",
  },
  {
    key: "kitFulfilmentAwaitingOps",
    label: "Fulfilment awaiting Ops",
    why: "New requests nobody has picked up.",
    href: "/admin/operations?tab=fulfilment",
  },
  {
    key: "deliveriesAwaitingAcknowledgement",
    label: "Delivered, not confirmed",
    why: "Ops believes it arrived; the clinic has not said so.",
    href: "/admin/operations?tab=fulfilment",
  },
  {
    key: "unpaidCarts",
    label: "Unpaid carts",
    why: "Sent to a patient and still unpaid.",
    href: "/admin/operations?tab=orders",
  },
  {
    key: "failedDeliveries",
    label: "Failed WhatsApp deliveries",
    why: "A message to a patient did not arrive.",
    href: "/admin/operations?tab=orders",
  },
];

function OperationsOverview() {
  const [data, setData] = useState<ActionCentre | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/action-centre", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        setData(j);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <PageContainer>
        {/* A failed load must never look like a calm platform. */}
        <ErrorState
          title="Unable to load operational exceptions"
          description={`${error}. This is a loading failure, not an all-clear — the platform may still have work needing attention.`}
        />
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

  const rows = EXCEPTIONS.map((e) => ({ ...e, group: data.groups[e.key] })).filter(
    (r) => r.group,
  );
  const live = rows.filter((r) => r.group!.available && r.group!.count > 0);
  const clear = rows.filter((r) => r.group!.available && r.group!.count === 0);
  const blind = rows.filter((r) => !r.group!.available);

  return (
    <PageContainer className="space-y-5 pt-5">
      {blind.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-medium">
            {blind.length} exception {blind.length === 1 ? "check is" : "checks are"} unavailable.
          </strong>{" "}
          {blind.map((b) => b.label).join(", ")} could not be read, so this view
          is incomplete. Treat the totals below as a floor, not a full picture.
        </div>
      )}

      {live.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
          <p className="text-base font-medium">No operational exceptions</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every queue this console can read is clear.
            {blind.length > 0 && " Some checks are unavailable — see above."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {live.map((r) => (
            <div
              key={r.key}
              className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <span
                aria-hidden
                className={`mt-1 inline-block size-2 shrink-0 rounded-full ${
                  r.group!.count >= 5 ? "bg-rose-500" : "bg-amber-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">
                    {r.group!.count} {r.label.toLowerCase()}
                  </span>
                  {/* Severity is stated in words as well as colour. */}
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {r.group!.count >= 5 ? "High" : "Needs attention"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{r.why}</p>
              </div>
              <Link
                href={r.href}
                className="shrink-0 self-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
              >
                Investigate
              </Link>
            </div>
          ))}
        </div>
      )}

      {clear.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Clear: {clear.map((c) => c.label.toLowerCase()).join(" · ")}
        </p>
      )}

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">Reports</strong> are not
        a separate view. Report generation is a stage of an assessment, and its
        state is shown per row under{" "}
        <Link
          href={hrefFor("assessments")}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Assessments
        </Link>
        . A standalone Reports tab would have been an empty module.
      </div>
    </PageContainer>
  );
}

/* ─────────────────────── Assessments ─────────────────────── */

type StalledRow = {
  assessmentId: string;
  status: string;
  clinicName: string;
  lastProgressAt: string;
  stalledForMinutes: number;
};
type FailedRow = {
  assessmentId: string;
  status: string;
  clinicName: string;
  submittedAt: string;
  lastProgressAt: string;
};
type StalledPayload = {
  staleAfterMinutes: number;
  stalled: { count: number; truncated: boolean; rows: StalledRow[] };
  failed: { count: number; truncated: boolean; rows: FailedRow[] };
};

function duration(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Deliberately NOT called "Review Queue".
 *
 * That name belongs to clinical review, which is the doctor's workspace and a
 * governance concept. What a Super Admin needs here is the operational
 * question: which assessments are not progressing? Naming it accurately keeps
 * the two from being confused.
 */
function AssessmentsNeedingAttention() {
  const [data, setData] = useState<StalledPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stalled-jobs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        setData(j);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const stalledCols = useMemo<Column<StalledRow>[]>(
    () => [
      {
        key: "clinic",
        header: "Clinic",
        cell: (r) => <span className="text-sm">{r.clinicName}</span>,
      },
      {
        key: "stage",
        header: "Stage",
        width: "200px",
        cell: (r) => (
          <span className="text-sm">{r.status.replace(/_/g, " ").toLowerCase()}</span>
        ),
      },
      {
        key: "stalled",
        header: "No progress for",
        width: "150px",
        cell: (r) => (
          <span className="font-medium">{duration(r.stalledForMinutes)}</span>
        ),
      },
      {
        key: "last",
        header: "Last progress",
        width: "170px",
        cell: (r) => new Date(r.lastProgressAt).toLocaleString(),
      },
      {
        key: "id",
        header: "Assessment",
        cell: (r) => (
          <Link
            href={`/doctor/reports/${r.assessmentId}`}
            className="font-mono text-xs text-primary underline-offset-2 hover:underline"
          >
            {r.assessmentId.slice(0, 10)}…
          </Link>
        ),
      },
    ],
    [],
  );

  const failedCols = useMemo<Column<FailedRow>[]>(
    () => [
      {
        key: "clinic",
        header: "Clinic",
        cell: (r) => <span className="text-sm">{r.clinicName}</span>,
      },
      {
        key: "status",
        header: "Outcome",
        width: "180px",
        cell: (r) => (
          <span className="text-sm">{r.status.replace(/_/g, " ").toLowerCase()}</span>
        ),
      },
      {
        key: "submitted",
        header: "Submitted",
        width: "170px",
        cell: (r) => new Date(r.submittedAt).toLocaleString(),
      },
      {
        key: "id",
        header: "Assessment",
        cell: (r) => (
          <Link
            href={`/doctor/reports/${r.assessmentId}`}
            className="font-mono text-xs text-primary underline-offset-2 hover:underline"
          >
            {r.assessmentId.slice(0, 10)}…
          </Link>
        ),
      },
    ],
    [],
  );

  if (error) {
    return (
      <PageContainer>
        <ErrorState
          title="Unable to load assessment operations"
          description={`${error}. This is a loading failure, not an all-clear.`}
        />
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

  return (
    <PageContainer className="space-y-6 pt-5">
      <section>
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <h2 className="text-base font-semibold">
            <Timer className="mr-1.5 inline size-4 align-[-2px]" aria-hidden />
            Stalled mid-pipeline
          </h2>
          <span className="text-sm text-muted-foreground">
            No progress for over {data.staleAfterMinutes} minutes
          </span>
        </div>
        <DataTable
          columns={stalledCols}
          rows={data.stalled.rows}
          rowKey={(r) => r.assessmentId}
          emptyTitle="Nothing stalled"
          emptyDescription="Every in-flight assessment is progressing within the expected window."
        />
        {data.stalled.truncated && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the first {data.stalled.rows.length}; more exist.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">Failed and partially failed</h2>
        <DataTable
          columns={failedCols}
          rows={data.failed.rows}
          rowKey={(r) => r.assessmentId}
          emptyTitle="No failures"
          emptyDescription="No assessment has ended in a failed or partial state."
        />
        {data.failed.truncated && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the first {data.failed.rows.length}; more exist.
          </p>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        This view observes only. Nothing here re-statuses, retries or cancels an
        assessment — an operational screen must not quietly rewrite the record
        it is reporting on.
      </p>
    </PageContainer>
  );
}
