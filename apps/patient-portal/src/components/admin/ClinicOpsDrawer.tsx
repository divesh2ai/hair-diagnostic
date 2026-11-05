"use client";

import { useEffect, useState } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import type { ClinicDetail } from "@/lib/admin/opsDashboard/clinicDetail";
import type { ClinicOpsRow } from "@/lib/admin/opsDashboard/types";
import {
  relativeTime,
  absoluteTime,
  formatInrFromMinor,
  REPORT_READINESS_LABEL,
  ADOPTION_STATUS_TONE,
  AUTH_PROVIDER_TONE,
  type BadgeTone,
} from "@/lib/admin/opsDashboard/format";
import { ADOPTION_STATUS_LABEL } from "@/lib/admin/opsDashboard/adoption";
import { AUTH_PROVIDER_LABEL } from "@/lib/admin/opsDashboard/authProvider";
import {
  MILESTONE_OUTCOMES,
  MILESTONE_OUTCOME_LABEL,
  MILESTONE_STATUS_LABEL,
  type MilestoneOutcome,
  type MilestoneStatus,
  type RolloutChecklistItem,
} from "@/lib/admin/opsDashboard/rollout";

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

function snapshotLabel(s: "PRESENT" | "ABSENT" | "UNKNOWN"): string {
  return s === "PRESENT" ? "present" : s === "ABSENT" ? "absent" : "unknown";
}

function retrievalLabel(r: "VERIFIED" | "FAILED" | "NOT_TESTED"): string {
  return r === "VERIFIED" ? "verified" : r === "FAILED" ? "failed" : "—";
}

export function ClinicOpsDrawer({
  clinicId,
  row,
  open,
  onOpenChange,
}: {
  clinicId: string | null;
  /** The overview row that opened the drawer — supplies the adoption summary. */
  row?: ClinicOpsRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [detail, setDetail] = useState<ClinicDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Derived loading — the effect only sets state after the fetch resolves, so
  // nothing is set synchronously inside it (react-hooks/set-state-in-effect).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Bumped after a sign-off write so the drawer re-fetches the clinic detail
  // (and therefore the recomputed rollout checklist).
  const [reloadNonce, setReloadNonce] = useState(0);

  const fetchKey = open && clinicId ? `${clinicId}|${reloadNonce}` : null;
  const loading = fetchKey !== null && loadedKey !== fetchKey;

  useEffect(() => {
    if (!fetchKey || !clinicId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/admin/clinics/${clinicId}/operations`, { cache: "no-store" });
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
  }, [fetchKey, clinicId]);

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
                    title={
                      b.slug
                        ? `QR handle: ?branch=${b.slug}`
                        : "No QR handle configured — unreachable by ?branch="
                    }
                  >
                    {b.branchName}
                    {b.city ? ` · ${b.city}` : ""} {b.isPrimary ? "(primary)" : ""}
                    {b.slug ? ` · QR ✓` : " · QR —"}
                  </span>
                ))}
              </div>
            )}

            {/* Adoption — the daily lens: auth method, logins, activity. */}
            {row && (
              <Section title="Adoption">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={ADOPTION_STATUS_TONE[row.adoptionStatus]}>
                    {ADOPTION_STATUS_LABEL[row.adoptionStatus]}
                  </StatusBadge>
                  <StatusBadge tone={AUTH_PROVIDER_TONE[row.authProvider]}>
                    {AUTH_PROVIDER_LABEL[row.authProvider]}
                  </StatusBadge>
                  {row.followUp.priority !== null && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      P{row.followUp.priority}: {row.followUp.action}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Patients" value={row.patientCount} />
                  <Stat label="7-day assessments" value={row.assessments7d} />
                  <Stat
                    label="Days since assessment"
                    value={row.daysSinceLastAssessment === null ? "—" : row.daysSinceLastAssessment}
                  />
                  <Stat label="Doctor reviews" value={row.reviewedCases.allTime} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Last assessment {relativeTime(row.lastAssessmentAt)} · last completed{" "}
                  {relativeTime(row.lastCompletedAssessmentAt)} · last login{" "}
                  {row.lastSignInAt ? relativeTime(row.lastSignInAt) : "never/unknown"} · last doctor action{" "}
                  {relativeTime(row.lastDoctorActivityAt)}.
                  {row.followUp.priority !== null && <> {row.followUp.reason}</>}
                </p>
              </Section>
            )}

            {/* Rollout & follow-up — auto-evidence + manual sign-offs */}
            {clinicId && (
              <RolloutSection
                clinicId={clinicId}
                rollout={detail.rollout}
                onChanged={() => setReloadNonce((n) => n + 1)}
              />
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

            {/* 1b. Per-doctor access, login & activity */}
            <Section title="Doctors — access, login & activity">
              {detail.doctors.list.length === 0 ? (
                <p className="text-xs text-muted-foreground">No doctors are provisioned at this clinic yet.</p>
              ) : (
                <RecentTable
                  rows={detail.doctors.list.map((d) => ({
                    key: d.doctorId,
                    cols: [
                      d.name,
                      d.access === "LINKED"
                        ? "linked identity"
                        : d.access === "ONBOARDING_PENDING"
                          ? "onboarding pending"
                          : "unknown",
                      detail.doctors.identitiesReadable ? AUTH_PROVIDER_LABEL[d.authProvider] : "unknown",
                      !detail.doctors.authReadable
                        ? "unknown"
                        : d.lastSignInAt
                          ? relativeTime(d.lastSignInAt)
                          : d.hasAccount
                            ? "never"
                            : "no account",
                      d.lastActivityAt ? relativeTime(d.lastActivityAt) : "—",
                    ],
                  }))}
                  headers={["Doctor", "Access", "Auth method", "Last login", "Last clinical activity"]}
                  empty="No doctors provisioned."
                />
              )}
              <p className="text-xs text-muted-foreground">
                Login is resolved across both supported identities (email/Google + phone).
                {!detail.doctors.authReadable && (
                  <> Sign-in telemetry could not be read here, so last login shows <em>unknown</em>, not <em>never</em>.</>
                )}
              </p>
            </Section>

            {/* 2. Doctor review & approvals */}
            <Section title="Doctor review & approvals">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat label="Cases reviewed" value={detail.review.reviewed} />
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
                Cases reviewed counts every completed doctor decision — approved, revision-requested
                or rejected (PENDING is not a completed review). Approval = an approved consultation
                version (the authoritative sign-off), not a completed AI pipeline.
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

            {/* 4. Reports — availability separated into its distinct facets */}
            <Section title="Reports">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Clinically approved" value={detail.reports.approved} />
                <Stat label="Dossier ready" value={detail.reports.dossiersReady} />
                <Stat
                  label="One-pager snapshots"
                  value={
                    detail.reports.storageState === "CONNECTED"
                      ? detail.reports.snapshotsPresent
                      : <NotConnected />
                  }
                />
                <Stat
                  label="Retrieval verified"
                  value={
                    detail.reports.storageState === "CONNECTED"
                      ? detail.reports.retrievalVerified
                      : <NotConnected />
                  }
                />
              </div>

              {/* Per-assessment matrix — the evidence behind the counts above.
                  Clinically approved / snapshot / dossier / retrieval are each
                  shown on their own; none is inferred from another. */}
              <RecentTable
                rows={detail.reports.matrix.map((m) => ({
                  key: `${m.assessmentId}-v${m.contentVersion}`,
                  cols: [
                    m.patientName,
                    `v${m.contentVersion}`,
                    snapshotLabel(m.onePagerSnapshot),
                    m.dossierReady ? "ready" : "—",
                    retrievalLabel(m.retrieval),
                    m.reportAssetStatus ?? "—",
                    REPORT_READINESS_LABEL[m.readiness] ?? m.readiness,
                  ],
                }))}
                headers={["Patient", "Ver", "Snapshot", "Dossier", "Retrieval", "PNG asset", "Readiness"]}
                empty="No approved reports for this clinic yet."
              />

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
                Clinically approved is the doctor sign-off; the one-pager snapshot (a storage
                object), the dossier asset and a verified byte retrieval are checked separately and
                never inferred from the approval. The PNG render queue above is a background
                pipeline, shown for context only.
                {detail.reports.storageState === "NOT_CONNECTED" && (
                  <>
                    {" "}
                    Snapshot storage could not be read here, so snapshot/retrieval show{" "}
                    <em>Not connected</em> rather than a fabricated count.
                  </>
                )}
              </p>
            </Section>

            {/* 4b. Pipeline attention — COMPLETED assessments with no consultation */}
            <Section title="Pipeline attention">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Completed assessments" value={detail.pipeline.completedAssessments} />
                <Stat label="Missing consultation" value={detail.pipeline.assessmentsWithoutConsultation} />
              </div>
              <RecentTable
                rows={detail.pipeline.missing.map((m) => ({
                  key: m.assessmentId,
                  cols: [m.patientName, m.status, relativeTime(m.submittedAt)],
                }))}
                headers={["Patient", "Pipeline status", "Submitted"]}
                empty="Every completed assessment has a consultation."
              />
              <p className="text-xs text-muted-foreground">
                A completed assessment with no consultation is a pipeline gap, not doctor inaction —
                the consultation the doctor would review was never produced.
              </p>
            </Section>

            {/* 4c. Reconciliation — approved-version / reviewDecision conflicts */}
            <Section title="Reconciliation discrepancies">
              <Stat label="Conflicts" value={detail.reconciliation.discrepancies} />
              <RecentTable
                rows={detail.reconciliation.cases.map((c) => ({
                  key: c.assessmentId,
                  cols: [c.patientName, c.approvalStatus, c.reviewDecision],
                }))}
                headers={["Patient", "Version approval", "Assessment.reviewDecision"]}
                empty="No approval-state conflicts for this clinic."
              />
              <p className="text-xs text-muted-foreground">
                An approved consultation version whose Assessment.reviewDecision disagrees. Reported
                here for an operator to resolve; never reconciled automatically.
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

const MILESTONE_STATUS_TONE: Record<MilestoneStatus, BadgeTone> = {
  VERIFIED: "success",
  AUTO_SATISFIED: "info",
  ATTENTION: "danger",
  NOT_STARTED: "neutral",
  NOT_APPLICABLE: "neutral",
  UNKNOWN: "neutral",
};

// The rollout checklist: each milestone's live auto-evidence merged with a
// manual sign-off. "A verified Google identity link is not proof of a
// successful dashboard login" and "a QR route existing is not proof of a
// successful QR scan" are enforced in the derivation (lib/admin/opsDashboard/
// rollout.ts); this component renders the result and lets a Super Admin attest.
function RolloutSection({
  clinicId,
  rollout,
  onChanged,
}: {
  clinicId: string;
  rollout: ClinicDetail["rollout"];
  onChanged: () => void;
}) {
  const provisioned = rollout.signoffState === "CONNECTED";
  return (
    <Section title={`Rollout checklist — ${rollout.verifiedCount}/${rollout.total} verified`}>
      {rollout.attentionCount > 0 && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {rollout.attentionCount} milestone{rollout.attentionCount === 1 ? "" : "s"} need attention.
        </p>
      )}
      {!provisioned && (
        <p className="text-xs text-muted-foreground">
          <StatusBadge tone="neutral">Sign-off storage not provisioned</StatusBadge>{" "}
          Auto-derived evidence is shown below; manual sign-offs require the{" "}
          <code>ClinicMilestoneSignoff</code> migration to be applied in this environment.
        </p>
      )}
      <div className="space-y-2">
        {rollout.items.map((item) => (
          <MilestoneRow
            key={item.key}
            clinicId={clinicId}
            item={item}
            canSignoff={provisioned}
            onChanged={onChanged}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Auto-evidence is read live from the database. A linked identity is not a login, and a QR
        route is not a scan — doctor login, branch QR and pilot acceptance are confirmed by a human
        with documented evidence. Every sign-off is audited.
      </p>
    </Section>
  );
}

function MilestoneRow({
  clinicId,
  item,
  canSignoff,
  onChanged,
}: {
  clinicId: string;
  item: RolloutChecklistItem;
  canSignoff: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<MilestoneOutcome>(item.signoff?.outcome ?? "VERIFIED");
  const [evidence, setEvidence] = useState(item.signoff?.evidence ?? "");
  const [notes, setNotes] = useState(item.signoff?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/clinics/${clinicId}/rollout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          milestone: item.key,
          outcome,
          evidence: evidence.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(j.message ?? j.error ?? `HTTP ${r.status}`);
      }
      setOpen(false);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/clinics/${clinicId}/rollout`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ milestone: item.key }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(j.message ?? j.error ?? `HTTP ${r.status}`);
      }
      setOpen(false);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{item.label}</span>
            <StatusBadge tone={MILESTONE_STATUS_TONE[item.status]}>
              {MILESTONE_STATUS_LABEL[item.status]}
            </StatusBadge>
          </div>
          <div className="text-xs text-muted-foreground">{item.autoEvidence}</div>
          {item.signoff && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Signed {MILESTONE_OUTCOME_LABEL[item.signoff.outcome]}
              {item.signoff.actorName ? ` by ${item.signoff.actorName}` : ""} ·{" "}
              {relativeTime(item.signoff.signedOffAt)}
              {item.signoff.evidence ? ` · evidence: ${item.signoff.evidence}` : ""}
              {item.signoff.notes ? ` · ${item.signoff.notes}` : ""}
            </div>
          )}
        </div>
        {canSignoff && (
          <div className="flex shrink-0 gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
              {item.signoff ? "Edit sign-off" : "Sign off"}
            </Button>
            {item.signoff && (
              <Button variant="ghost" size="sm" onClick={clear} disabled={busy}>
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {open && canSignoff && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="uppercase tracking-wide">Outcome</span>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as MilestoneOutcome)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {MILESTONE_OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {MILESTONE_OUTCOME_LABEL[o]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Evidence (link, ticket id, or what was witnessed)"
            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex gap-1.5">
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save sign-off"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
