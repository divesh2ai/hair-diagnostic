"use client";

import { useEffect, useState } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import type { ClinicDetail } from "@/lib/admin/opsDashboard/clinicDetail";
import {
  relativeTime,
  absoluteTime,
  formatInrFromMinor,
} from "@/lib/admin/opsDashboard/format";

// The clinic operational drilldown. Opened from a row in the operations table;
// fetches /api/admin/clinics/[id]/operations on open. Every capability-gated
// section ("Confirmed orders / revenue", "WhatsApp delivery") renders
// "Not connected" rather than a fabricated zero when its migration is absent.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function NotConnected() {
  return (
    <StatusBadge tone="neutral">Not connected</StatusBadge>
  );
}

export function ClinicOpsDrawer({
  clinicId,
  open,
  onOpenChange,
}: {
  clinicId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [detail, setDetail] = useState<ClinicDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Derived loading — the effect only sets state after the fetch resolves, so
  // nothing is set synchronously inside it (react-hooks/set-state-in-effect).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const fetchKey = open && clinicId ? clinicId : null;
  const loading = fetchKey !== null && loadedKey !== fetchKey;

  useEffect(() => {
    if (!fetchKey) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/admin/clinics/${fetchKey}/operations`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j: ClinicDetail = await r.json();
        if (!cancelled) {
          setDetail(j);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoadedKey(fetchKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent title={detail ? detail.clinic.name : "Clinic operations"} width="lg">
        {loading && <LoadingState title="Loading clinic operations…" />}
        {error && <ErrorState title="Couldn't load this clinic" description={error} />}
        {detail && !loading && !error && (
          <div className="space-y-6">
            {/* Header: clinic identity + branches */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge tone={detail.clinic.status === "ACTIVE" ? "success" : "warning"}>
                {detail.clinic.status}
              </StatusBadge>
              <span>/q/{detail.clinic.slug}</span>
              {detail.clinic.branches.length > 0 && (
                <span>
                  · {detail.clinic.branches.length} branch
                  {detail.clinic.branches.length === 1 ? "" : "es"}
                </span>
              )}
            </div>
            {detail.clinic.branches.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detail.clinic.branches.map((b) => (
                  <span
                    key={b.branchName}
                    className="rounded-md border border-border bg-card/40 px-2 py-0.5 text-xs"
                  >
                    {b.branchName}
                    {b.city ? ` · ${b.city}` : ""} {b.isPrimary ? "(primary)" : ""}
                  </span>
                ))}
              </div>
            )}

            {/* 1. Patients & assessment status */}
            <Section title="Patients & assessments">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Patients" value={detail.patients.total} />
                <Stat label="Assessments" value={detail.assessments.total} />
              </div>
              {detail.assessments.byStatus.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.assessments.byStatus.map((s) => (
                    <span
                      key={s.status}
                      className="rounded-md border border-border bg-card/40 px-2 py-0.5 text-xs tabular-nums"
                    >
                      {s.status}: {s.count}
                    </span>
                  ))}
                </div>
              )}
              <RecentTable
                rows={detail.assessments.recent.map((a) => ({
                  key: a.id,
                  cols: [a.patientName, a.status, a.reviewDecision, relativeTime(a.submittedAt)],
                }))}
                headers={["Patient", "Pipeline status", "Review", "Submitted"]}
                empty="No assessments yet."
              />
            </Section>

            {/* 2. Doctor review & approvals */}
            <Section title="Doctor review & approvals">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Approved" value={detail.review.approved} />
                <Stat label="Pending review" value={detail.review.pendingReview} />
                <Stat label="Revision req." value={detail.review.revisionRequested} />
                <Stat label="Rejected" value={detail.review.rejected} />
              </div>
              <RecentTable
                rows={detail.review.recentApprovals.map((a) => ({
                  key: a.assessmentId,
                  cols: [a.patientName, a.approvedBy ?? "—", relativeTime(a.approvedAt)],
                }))}
                headers={["Patient", "Approved by", "When"]}
                empty="No approved consultations yet."
              />
              <p className="text-xs text-muted-foreground">
                Approval = an approved consultation version (the authoritative sign-off), not a
                completed AI pipeline.
              </p>
            </Section>

            {/* 3. Kit selection & ordering */}
            <Section title="Kit selection & ordering">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Active intents" value={detail.kits.activeIntents} />
                <Stat label="Cancelled" value={detail.kits.cancelledIntents} />
                <Stat
                  label="Confirmed orders"
                  value={
                    detail.orders.state === "CONNECTED" ? detail.orders.paidOrders : <NotConnected />
                  }
                />
              </div>
              <RecentTable
                rows={detail.kits.recent.map((k) => ({
                  key: `${k.assessmentId}-${k.createdAt}`,
                  cols: [k.patientName, k.doctorName, `${k.kitCount} kit(s)`, k.status, relativeTime(k.createdAt)],
                }))}
                headers={["Patient", "Doctor", "Kits", "Intent", "When"]}
                empty="No kit order intents yet."
              />
              <p className="text-xs text-muted-foreground">
                A kit order intent is the doctor&apos;s authorization, not a paid order.
              </p>
            </Section>

            {/* 4. Reports */}
            <Section title="Reports">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Available (approved)" value={detail.reports.available} />
                <Stat label="PNG queue · ready" value={detail.reports.renderQueue.counts.ready} />
                <Stat label="PNG queue · failed" value={detail.reports.renderQueue.counts.failed} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["pending", "queued", "rendering", "ready", "failed"] as const).map((k) => (
                  <span
                    key={k}
                    className="rounded-md border border-border bg-card/40 px-2 py-0.5 text-xs tabular-nums"
                  >
                    {k}: {detail.reports.renderQueue.counts[k]}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Availability is the approved dossier + one-pager (written at approval). The PNG
                render queue is a separate background pipeline, shown here but not the sole source
                of availability.
              </p>
            </Section>

            {/* 5. WhatsApp sending & delivery */}
            <Section title="WhatsApp report delivery">
              {detail.delivery.state === "NOT_CONNECTED" ? (
                <p className="text-sm">
                  <NotConnected />{" "}
                  <span className="text-muted-foreground">
                    report-delivery records are not provisioned in this environment.
                  </span>
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Stat label="Sent" value={detail.delivery.sent} />
                    <Stat label="Delivered" value={detail.delivery.delivered} />
                    <Stat label="Failed" value={detail.delivery.failed} />
                  </div>
                  <RecentTable
                    rows={detail.delivery.recent.map((d) => ({
                      key: `${d.assessmentId}-${d.sentAt ?? d.deliveredAt ?? ""}`,
                      cols: [
                        d.status,
                        d.sentAt ? relativeTime(d.sentAt) : "—",
                        d.deliveredAt ? relativeTime(d.deliveredAt) : "—",
                        d.providerStatus ?? "—",
                      ],
                    }))}
                    headers={["Status", "Sent", "Delivered", "Provider"]}
                    empty="No report deliveries yet."
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent = provider accepted; Delivered = provider delivery receipt. Two different
                    facts.
                  </p>
                </>
              )}
            </Section>

            {/* 6. Revenue — only when payment data is verified */}
            <Section title="Revenue">
              {detail.orders.state === "CONNECTED" && detail.orders.revenueMinor !== null ? (
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Paid orders" value={detail.orders.paidOrders} />
                  <Stat label="Settled revenue" value={formatInrFromMinor(detail.orders.revenueMinor)} />
                </div>
              ) : (
                <p className="text-sm">
                  <NotConnected />{" "}
                  <span className="text-muted-foreground">
                    no verified payment/settlement source in this environment — no amount is shown.
                  </span>
                </p>
              )}
            </Section>

            {/* 7. Activity & audit */}
            <Section title="Recent activity & audit">
              <RecentTable
                rows={detail.audit.recent.map((a, i) => ({
                  key: `${a.action}-${a.createdAt}-${i}`,
                  cols: [a.action, a.actorName ?? a.actorRole ?? "system", a.entityType, relativeTime(a.createdAt)],
                }))}
                headers={["Action", "Actor", "Entity", "When"]}
                empty="No audit activity recorded for this clinic."
              />
            </Section>

            <p className="text-[11px] text-muted-foreground">
              Loaded {absoluteTime(new Date().toISOString())}
            </p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function RecentTable({
  rows,
  headers,
  empty,
}: {
  rows: { key: string; cols: React.ReactNode[] }[];
  headers: string[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-2.5 py-1.5 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border hover:bg-muted/30">
              {r.cols.map((c, i) => (
                <td key={i} className="px-2.5 py-1.5 tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
