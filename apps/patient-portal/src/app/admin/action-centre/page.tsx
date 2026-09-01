"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Hourglass,
  MessageCircleOff,
  PackageCheck,
  PackageSearch,
  ShoppingCart,
  Truck,
  UserX,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";

// Super Admin Action Centre.
//
// ── Why this is a page and not a widget on /admin ───────────────────────────
// The existing admin dashboard answers "how is the platform doing" — clinics,
// doctors, assessments, a conversion funnel. This answers "what is broken
// right now". They are read at different moments by people in different
// moods, and merging them buries the two orders nobody has packed underneath
// a growth chart. /admin links here; nothing there was redesigned.
//
// ── Exceptions only ─────────────────────────────────────────────────────────
// Every group is something stuck, waiting, or failed. There is no "reports
// opened today", no revenue, no click stream. A group with nothing in it says
// so and stays put, so an operator can tell a finished queue from a broken
// panel.

interface Group<T> {
  available: boolean;
  count: number;
  items: T[];
}

interface Payload {
  needsAttention: number;
  unavailableGroups: string[];
  unpaidFollowupHours: number;
  groups: {
    assessmentsAwaitingReview: Group<{
      assessmentId: string;
      clinicName: string;
      waitingSince: string;
    }>;
    kitFulfilmentAwaitingOps: Group<FulfilmentItem>;
    paidOrdersAwaitingFulfilment: Group<{
      kitOrderIntentId: string;
      assessmentId: string;
      clinicName: string | null;
      paidAt: string | null;
    }>;
    unpaidCarts: Group<{
      assessmentId: string;
      clinicName: string | null;
      sentAt: string | null;
    }>;
    deliveriesAwaitingAcknowledgement: Group<FulfilmentItem>;
    failedDeliveries: Group<{
      id: string;
      assessmentId: string;
      subject: string | null;
      clinicName: string | null;
      lastError: string | null;
      createdAt: string;
    }>;
    stalledAssessments: Group<{
      assessmentId: string;
      status: string;
      clinicName: string;
      lastProgressAt: string;
      stalledForMinutes: number;
    }>;
    rolelessAccounts: Group<{
      userId: string;
      email: string | null;
      createdAt: string;
      lastSignInAt: string | null;
    }>;
  };
}

interface FulfilmentItem {
  id: string;
  assessmentId: string;
  clinicName: string | null;
  doctorName: string | null;
  kitCount: number;
  requestedAt: string;
  status: string;
}

export default function ActionCentrePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/admin/action-centre")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setData)
      .catch(() => setError("Could not load the action centre."));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState title={error} />;
  if (!data) return <LoadingState title="Loading" />;

  const g = data.groups;
  const settled = data.needsAttention === 0 && data.unavailableGroups.length === 0;

  return (
    <PageContainer>
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-semibold text-foreground">Needs attention</h1>
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {data.needsAttention}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Exceptions only — items waiting on a person. Throughput lives on the{" "}
          <Link href="/admin" className="underline underline-offset-2">
            dashboard
          </Link>
          .
        </p>

        {/* A count built on a panel that failed to load is a lie of omission.
            The header number sums only readable groups, and says which ones it
            could not read. */}
        {data.unavailableGroups.length > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {data.unavailableGroups.length} group
              {data.unavailableGroups.length === 1 ? "" : "s"} could not be read
              and {data.unavailableGroups.length === 1 ? "is" : "are"} not
              counted above. This is expected until the post-approval migration
              is applied.
            </span>
          </p>
        )}
      </header>

      {settled && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" aria-hidden />
          Everything is clear. Nothing is waiting on an operator.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupCard
          icon={<ClipboardCheck className="size-4" aria-hidden />}
          title="Assessments awaiting doctor review"
          group={g.assessmentsAwaitingReview}
          emptyLabel="Every submitted assessment has a decision."
          renderItem={(it) => (
            <Row
              key={it.assessmentId}
              href={`/doctor/reports/${it.assessmentId}`}
              primary={it.clinicName}
              secondary={`Waiting since ${formatDate(it.waitingSince)}`}
            />
          )}
        />

        <GroupCard
          icon={<PackageSearch className="size-4" aria-hidden />}
          title="Kit fulfilment awaiting Ops"
          group={g.kitFulfilmentAwaitingOps}
          emptyLabel="No new fulfilment requests."
          action={{ href: "/admin/fulfilment", label: "Open queue" }}
          renderItem={(it) => (
            <Row
              key={it.id}
              href="/admin/fulfilment"
              primary={it.clinicName ?? "Unknown clinic"}
              secondary={`${it.kitCount} kit${it.kitCount === 1 ? "" : "s"} · requested ${formatDate(it.requestedAt)}`}
            />
          )}
        />

        {/* Should normally be empty. A row here means payment succeeded but the
            fulfilment request was never created — the one failure in this
            workflow a patient feels and nobody else would notice. */}
        <GroupCard
          icon={<PackageCheck className="size-4" aria-hidden />}
          title="Paid orders awaiting fulfilment"
          group={g.paidOrdersAwaitingFulfilment}
          emptyLabel="Every paid order has a fulfilment request."
          tone="danger"
          renderItem={(it) => (
            <Row
              key={it.kitOrderIntentId}
              href={`/doctor/reports/${it.assessmentId}`}
              primary={it.clinicName ?? "Unknown clinic"}
              secondary={`Paid ${it.paidAt ? formatDate(it.paidAt) : "—"} · no request created`}
            />
          )}
        />

        <GroupCard
          icon={<ShoppingCart className="size-4" aria-hidden />}
          title={`Unpaid carts over ${data.unpaidFollowupHours}h`}
          group={g.unpaidCarts}
          emptyLabel="No carts are sitting unpaid."
          renderItem={(it) => (
            <Row
              key={it.assessmentId}
              href={`/doctor/reports/${it.assessmentId}`}
              primary={it.clinicName ?? "Unknown clinic"}
              secondary={`Sent ${it.sentAt ? formatDate(it.sentAt) : "—"}`}
            />
          )}
        />

        <GroupCard
          icon={<Truck className="size-4" aria-hidden />}
          title="Deliveries awaiting clinic confirmation"
          group={g.deliveriesAwaitingAcknowledgement}
          emptyLabel="No deliveries are waiting to be confirmed."
          renderItem={(it) => (
            <Row
              key={it.id}
              href="/admin/fulfilment"
              primary={it.clinicName ?? "Unknown clinic"}
              secondary={`Delivered · ${it.doctorName ?? "unassigned"}`}
            />
          )}
        />

        <GroupCard
          icon={<MessageCircleOff className="size-4" aria-hidden />}
          title="Failed WhatsApp deliveries"
          group={g.failedDeliveries}
          emptyLabel="No failed sends."
          tone="danger"
          renderItem={(it) => (
            <Row
              key={it.id}
              href={`/doctor/reports/${it.assessmentId}`}
              primary={`${it.subject ?? "Message"} · ${it.clinicName ?? "Unknown clinic"}`}
              // Reason codes only. A provider error body can echo the message
              // that was sent, which contains a live share link.
              secondary={it.lastError ?? "Unknown error"}
            />
          )}
        />

        {/* Started and never finished. These never reach FAILED, so nothing
            else on the platform counts them — which is precisely why they
            belong in a panel about what needs a human. */}
        <GroupCard
          icon={<Hourglass className="size-4" aria-hidden />}
          title="Assessments stalled mid-pipeline"
          group={g.stalledAssessments}
          emptyLabel="No assessment is stuck in processing."
          tone="danger"
          action={{ href: "/admin", label: "Platform health" }}
          renderItem={(it) => (
            <Row
              key={it.assessmentId}
              href={`/doctor/reports/${it.assessmentId}`}
              primary={`${it.clinicName} · ${it.status.replace(/_/g, " ")}`}
              secondary={`No progress for ${formatDuration(it.stalledForMinutes)}`}
            />
          )}
        />

        {/* An account that can sign in and reach nothing. Usually a mistyped
            address at the login screen, which silently creates a real user. */}
        <GroupCard
          icon={<UserX className="size-4" aria-hidden />}
          title="Accounts with no role"
          group={g.rolelessAccounts}
          emptyLabel="Every account has a role."
          action={{ href: "/admin/people?status=roleless", label: "Review access" }}
          renderItem={(it) => (
            <Row
              key={it.userId}
              href="/admin/people?status=roleless"
              primary={it.email ?? it.userId}
              secondary={`Created ${formatDate(it.createdAt)}${
                it.lastSignInAt ? " · has signed in" : " · never signed in"
              }`}
            />
          )}
        />
      </div>
    </PageContainer>
  );
}

function GroupCard<T>({
  icon,
  title,
  group,
  emptyLabel,
  tone = "neutral",
  action,
  renderItem,
}: {
  icon: React.ReactNode;
  title: string;
  group: Group<T>;
  emptyLabel: string;
  tone?: "neutral" | "danger";
  action?: { href: string; label: string };
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </CardTitle>
        {group.available ? (
          <StatusBadge
            tone={
              group.count === 0 ? "success" : tone === "danger" ? "danger" : "warning"
            }
          >
            {group.count}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">unavailable</StatusBadge>
        )}
      </CardHeader>
      <CardContent>
        {!group.available ? (
          <p className="text-xs text-muted-foreground">
            This queue could not be read, so it is not counted. Expected until
            the post-approval migration is applied.
          </p>
        ) : group.count === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="divide-y divide-border">
            {/* Progressive disclosure: the five oldest, then a count. An
                operator works the top of a queue, and a 50-row list inside a
                summary card is a list nobody reads. */}
            {group.items.slice(0, 5).map(renderItem)}
            {group.count > 5 && (
              <li className="pt-2 text-xs text-muted-foreground">
                + {group.count - 5} more
              </li>
            )}
          </ul>
        )}
        {action && group.available && group.count > 0 && (
          <Link
            href={action.href}
            className="mt-3 inline-block text-xs font-medium underline underline-offset-2"
          >
            {action.label}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  href,
  primary,
  secondary,
}: {
  href: string;
  primary: string;
  secondary: string;
}) {
  return (
    <li className="py-2">
      <Link href={href} className="block hover:opacity-80">
        <div className="text-sm text-foreground">{primary}</div>
        <div className="text-xs text-muted-foreground">{secondary}</div>
      </Link>
    </li>
  );
}

/** Minutes as a human span. Hours past 90 minutes, days past two days. */
function formatDuration(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
