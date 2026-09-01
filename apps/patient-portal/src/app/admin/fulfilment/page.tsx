"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  FULFILMENT_LABEL,
  TRANSITION_LABEL,
  allowedTransitions,
  type FulfilmentStatus,
} from "@/lib/fulfilment/stateMachine";

// Ops fulfilment queue.
//
// ── The controls are derived from the state machine, not hard-coded ─────────
// Each row renders exactly the moves `allowedTransitions` reports for the
// state that row is actually in. So the buttons cannot offer an illegal move,
// and — more importantly — they cannot drift from what the server enforces,
// because both read the same table. A "Mark dispatched" button on a REQUESTED
// row would be a button whose only outcome is an error toast.
//
// ── Nothing here writes a status directly ───────────────────────────────────
// The button posts a TARGET to /api/admin/fulfilment/[id]/transition and the
// server decides. The browser is a remote control, not a source of truth: a
// crafted request cannot set DELIVERED on a request created a second ago,
// because the server checks the machine and guards the UPDATE on the current
// status.
//
// ── ACKNOWLEDGED is absent by design ────────────────────────────────────────
// "The clinic received it" is a statement only the clinic can make, so it has
// no control here and the row sits in DELIVERED until the clinic confirms —
// which is what puts it in the action centre's acknowledgement group.

interface Row {
  id: string;
  assessmentId: string;
  kitOrderIntentId: string;
  clinicName: string | null;
  doctorName: string | null;
  kitCount: number;
  mode: "PATIENT" | "CLINIC";
  status: FulfilmentStatus;
  requestedAt: string;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  paymentStatus: string | null;
  paidAt: string | null;
  updatedAt: string;
}

const TONE: Record<FulfilmentStatus, StatusTone> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  PACKED: "info",
  DISPATCHED: "info",
  DELIVERED: "brand",
  ACKNOWLEDGED: "success",
  CANCELLED: "neutral",
};

export default function AdminFulfilmentPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/admin/fulfilment")
      .then(async (r) => {
        if (r.ok) return r.json();
        const body = await r.json().catch(() => ({}));
        // The unapplied-migration case is named, not shown as a generic
        // failure: it tells the operator exactly what has to happen next.
        throw new Error(
          body.error === "fulfilment_not_provisioned"
            ? "Fulfilment is not switched on yet — the post-approval migration has not been applied."
            : "Could not load the fulfilment queue.",
        );
      })
      .then((d: { items: Row[] }) => setRows(d.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function transition(id: string, to: FulfilmentStatus) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/fulfilment/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A refused move is reported with the state the server actually saw,
        // because the usual cause is a stale page — a second operator moved
        // the row a moment ago.
        toast.error(
          body.error === "conflict" || body.error === "illegal_transition"
            ? `Already ${FULFILMENT_LABEL[body.from as FulfilmentStatus] ?? "changed"} — refreshing.`
            : "Could not update this request.",
        );
        load();
        return;
      }
      toast.success(FULFILMENT_LABEL[to]);
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorState title={error} />;
  if (!rows) return <LoadingState title="Loading" />;

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Kit fulfilment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open requests, oldest first. Clinic confirmation of receipt is done by
          the clinic, not here.
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing in the queue"
          description="Fulfilment requests appear here once a clinic-supplied order is paid."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {row.clinicName ?? "Unknown clinic"}
                    </span>
                    <StatusBadge tone={TONE[row.status]}>
                      {FULFILMENT_LABEL[row.status]}
                    </StatusBadge>
                    {row.paymentStatus === "PAID" && (
                      <StatusBadge tone="success">Paid</StatusBadge>
                    )}
                    {row.mode === "PATIENT" && (
                      <StatusBadge tone="info">To patient</StatusBadge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.kitCount} kit{row.kitCount === 1 ? "" : "s"} ·{" "}
                    {row.doctorName ?? "unassigned"} · requested{" "}
                    {formatDate(row.requestedAt)}
                    {" · "}
                    {/* Order reference only. The kit lineup and the patient are
                        deliberately not on this screen — see the API comment. */}
                    <span className="font-mono">
                      {row.kitOrderIntentId.slice(-8)}
                    </span>
                  </p>
                  <Link
                    href={`/doctor/reports/${row.assessmentId}`}
                    className="mt-1 inline-block text-xs underline underline-offset-2"
                  >
                    Open case
                  </Link>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {allowedTransitions(row.status)
                    // ACKNOWLEDGED is the clinic's to make; the server refuses
                    // it from this surface, so no control is offered for it.
                    .filter((t) => t !== "ACKNOWLEDGED")
                    .map((to) => (
                      <button
                        key={to}
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => transition(row.id, to)}
                        className={
                          to === "CANCELLED"
                            ? "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                            : "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        }
                      >
                        {busyId === row.id && (
                          <Loader2 className="size-3 animate-spin" aria-hidden />
                        )}
                        {TRANSITION_LABEL[to]}
                      </button>
                    ))}
                  {allowedTransitions(row.status).length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      <PackageSearch className="mr-1 inline size-3" aria-hidden />
                      Closed
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
