// Doctor Clinical Validation Loop — Approve & create kit order command.
//
// The doctor's primary action collapses two responsibilities behind a single
// endpoint:
//
//   1. Approve the current consultation version — with compare-and-set
//      semantics against the version the doctor was reviewing (guards
//      against a colleague's concurrent edit being silently blessed).
//   2. Create the KitOrderIntent that authorises operations to act.
//
// This module deliberately does NOT wrap the consultation orchestrator's
// approval flow inside a Prisma transaction — that flow spans domain-level
// event emission, out-of-band dispatch, and the ConsultationRepo port
// abstraction. A long, nested transaction around it would strand connections
// and blur ownership.
//
// Instead:
//   • Step 1 runs through orchestrator.approve() with expectedContentVersion.
//     The orchestrator itself is idempotent (same approver + same status +
//     same version = no-op) so a duplicated first step is a cheap read.
//   • Step 2 runs in a small $transaction that couples the KitOrderIntent
//     creation with the audit-log rows describing it. `create` on the unique
//     (consultationId, consultationVersionId) key means concurrent clicks
//     race safely: the loser catches P2002, re-reads the winning intent, and
//     returns it without emitting a duplicate audit row.

import { Prisma } from "@prisma/client";
import type { KitOrderIntent, PrismaClient } from "@prisma/client";
import type { Consultation, TreatmentPhase } from "@shared/types/consultation";
import {
  makeOrchestrator,
  ReadinessBlockedError,
  OrchestratorError,
  type StoredVersion,
} from "@hairos/packages/consultation-orchestrator";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { setFulfilmentMode } from "@/lib/fulfilment/fulfilmentStore";
import { resolveNewOrderFulfilmentMode } from "@/lib/fulfilment/newOrderMode";
import { saveOnePagerSnapshot, type SnapshotResult } from "@/lib/reports/one-page/snapshot";
import { requestOnePagerRender } from "@/lib/reports/assets/jobService";
import { SystemRole } from "@prisma/client";

export interface ApproveAndCreateOrderInput {
  assessmentId: string;
  actor: {
    userId: string | null;
    role: SystemRole;
    clinicId: string | null;
  };
  /**
   * The acting doctor's Doctor-row id. Used to bind KitOrderIntent.doctorId
   * when the assessment has no reviewingDoctorId yet — which is the normal
   * state for clinic-QR submissions, shared-queue cases arrive unassigned and
   * the doctor who decides becomes the reviewer of record. Passed explicitly
   * because `actor.userId` is an ambiguous "user id" and cannot be looked up as
   * a Supabase user id here (the caller already holds the resolved Doctor row).
   */
  actingDoctorId?: string | null;
  /**
   * The version the doctor was reviewing. Required — the endpoint refuses to
   * approve if a concurrent revision has advanced past this number.
   */
  expectedContentVersion: number;
  /** Optional free-text approval note. */
  notes?: string;
  /**
   * Senior-doctor override of the readiness gate. The orchestrator enforces
   * that this may bypass reasoning gaps ONLY — never grounding violations.
   * Carries the typed clinical justification for the audit trail.
   */
  readinessOverride?: { reason: string };
  /**
   * When true, skip the one-pager snapshot (object-store upload) and render
   * request on this call, returning as soon as the approval + kit order are
   * durable. The client fires those in a follow-up request
   * (/api/consultation/[id]/report/prepare → prepareApprovedReport) after it
   * shows "Approved", so the doctor never waits on report preparation. The
   * approval and order are already committed either way.
   */
  deferReportPrep?: boolean;
}

export interface ApproveAndCreateOrderResult {
  approval: StoredVersion;
  intent: KitOrderIntent;
  intentCreated: boolean; // false when a prior click already created it
  /**
   * Whether the patient's one-pager was preserved for this version.
   *
   * Reported rather than hidden: a failure here does not undo the approval,
   * but "the record of what we released was not kept" is a fact the caller is
   * entitled to see and act on.
   */
  snapshot: SnapshotResult;
  /**
   * The ReportAsset this approval asked to be rendered, or null when the
   * request could not be recorded (unmigrated database, or an unavailable
   * one). Null is not a failure of the approval — it means the doctor will be
   * told, truthfully, that the one-pager is unavailable.
   */
  reportAssetId: string | null;
}

export class ApproveAndCreateOrderError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "forbidden"
      | "stale_version"
      | "readiness_blocked"
      | "no_kits"
      | "no_doctor_id",
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApproveAndCreateOrderError";
  }
}

/**
 * Extract the canonical kit lineup from an approved consultation.
 * TreatmentPhase.kitPhases[].kitId in phase order is the doctor's final
 * ordered lineup.
 */
export function extractKitIds(content: Consultation): string[] {
  const phases = (content.treatmentPlan?.kitPhases ?? []) as TreatmentPhase[];
  return phases
    .slice()
    .sort((a, b) => (a.phase ?? 0) - (b.phase ?? 0))
    .map((p) => p.kitId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function approveAndCreateOrder(
  prisma: PrismaClient,
  input: ApproveAndCreateOrderInput,
): Promise<ApproveAndCreateOrderResult> {
  const orchestrator = makeOrchestrator(prisma);

  // ── Step 1: approval with compare-and-set on contentVersion ──────────────
  //
  // orchestrator.approve() already:
  //   • Loads the latest version by assessmentId.
  //   • Enforces clinic access (throws OrchestratorError code=forbidden).
  //   • Enforces stale-version guard (throws OrchestratorError code=invalid).
  //   • Enforces readiness (throws ReadinessBlockedError).
  //   • Is idempotent for (same status, same approver, same version).
  //
  // We translate its exceptions to the endpoint's stable codes.
  let approved: StoredVersion;
  try {
    approved = await orchestrator.approve({
      assessmentId: input.assessmentId,
      ctx: {
        actorId: input.actor.userId ?? "system",
        role: input.actor.role,
        clinicId: input.actor.clinicId,
      },
      status: "APPROVED",
      notes: input.notes,
      expectedContentVersion: input.expectedContentVersion,
      readinessOverride: input.readinessOverride,
    });
  } catch (err) {
    if (err instanceof ReadinessBlockedError) {
      throw new ApproveAndCreateOrderError(
        "readiness_blocked",
        err.decision.doctorSummary,
        err.decision,
      );
    }
    if (err instanceof OrchestratorError) {
      if (err.code === "not_found") {
        throw new ApproveAndCreateOrderError("not_found", err.message);
      }
      if (err.code === "forbidden") {
        throw new ApproveAndCreateOrderError("forbidden", err.message);
      }
      // "invalid" here means the stale-version / state-ineligible case.
      throw new ApproveAndCreateOrderError("stale_version", err.message);
    }
    throw err;
  }

  // ── Step 2: order intent + audit rows in a single, small transaction ─────
  //
  // Kit lineup snapshot is captured HERE from the approved content — future
  // revisions never mutate a shipped intent.
  const kitIds = extractKitIds(approved.content);
  if (kitIds.length === 0) {
    throw new ApproveAndCreateOrderError(
      "no_kits",
      "Approved consultation has no kit lineup — nothing to order",
    );
  }

  // Resolve the reviewing doctor for foreign-key + audit. Falls back to the
  // authenticated actor if the consultation's Assessment.reviewingDoctorId is
  // null (e.g. an admin approving on the doctor's behalf).
  const assessment = await prisma.assessment.findUnique({
    where: { id: input.assessmentId },
    select: { reviewingDoctorId: true, clinicId: true, patientId: true },
  });
  if (!assessment) {
    throw new ApproveAndCreateOrderError(
      "not_found",
      `Assessment ${input.assessmentId} not found`,
    );
  }

  // The KitOrderIntent.doctorId FK requires a real Doctor row. Prefer the
  // assessment's reviewing doctor; otherwise bind the acting doctor who is
  // making this decision (clinic-QR cases arrive unassigned). Only refuse when
  // neither is available rather than fabricate an owner.
  const doctorId = assessment.reviewingDoctorId ?? input.actingDoctorId ?? null;
  if (!doctorId) {
    throw new ApproveAndCreateOrderError(
      "no_doctor_id",
      "Cannot create kit order intent: no reviewing doctor is bound to this assessment",
    );
  }

  const consultationRow = await prisma.consultation.findUnique({
    where: { assessmentId: input.assessmentId },
    select: { id: true },
  });
  if (!consultationRow) {
    throw new ApproveAndCreateOrderError(
      "not_found",
      "Consultation row missing after approval",
    );
  }
  const consultationId = consultationRow.id;

  // Version row — StoredVersion.contentVersion is monotonic per consultation;
  // combined with consultationId it uniquely identifies the version we just
  // approved.
  const versionRow = await prisma.consultationVersion.findUnique({
    where: {
      consultationId_contentVersion: {
        consultationId,
        contentVersion: approved.contentVersion,
      },
    },
    select: { id: true },
  });
  if (!versionRow) {
    throw new ApproveAndCreateOrderError(
      "not_found",
      "Approved ConsultationVersion row missing",
    );
  }

  // Idempotent create coupled with its audit row.
  //
  // ── Why the P2002 recovery reads OUTSIDE the transaction ─────────────────
  // On Postgres, the first statement to error inside a transaction aborts the
  // WHOLE transaction: every subsequent command fails with 25P02 ("current
  // transaction is aborted") until it rolls back. So a duplicate-key create
  // followed by a re-read of the winning row IN THE SAME `tx` cannot work — the
  // re-read hits 25P02 and surfaces as an opaque 500. That is exactly the error
  // a doctor saw on a double-click, a retry, or re-approving a version that
  // already has an order. The create + audit stay transactional; the recovery
  // read runs afterwards on the base client, once the failed transaction has
  // rolled back.
  const uniqueWhere = {
    consultationId_consultationVersionId: {
      consultationId,
      consultationVersionId: versionRow.id,
    },
  } as const;

  let result: { intent: KitOrderIntent; intentCreated: boolean };
  try {
    const created = await prisma.$transaction(async (tx) => {
      const intent = await tx.kitOrderIntent.create({
        data: {
          consultationId,
          consultationVersionId: versionRow.id,
          assessmentId: input.assessmentId,
          clinicId: assessment.clinicId,
          doctorId,
          kitIds,
          quantities: Prisma.JsonNull, // no quantities defined in the pilot
          // Default status is READY_FOR_FULFILMENT — doctor approval is the
          // clinical authorisation.
        },
      });

      await writeAuditLog({
        action: "KIT_ORDER_INTENT_CREATED",
        entityType: "KitOrderIntent",
        entityId: intent.id,
        actorId: input.actor.userId ?? null,
        actorRole: input.actor.role,
        actorType: input.actor.role === SystemRole.DOCTOR ? "doctor" : "admin",
        assessmentId: input.assessmentId,
        metadata: {
          clinicId: assessment.clinicId,
          consultationId,
          consultationVersionId: versionRow.id,
          contentVersion: approved.contentVersion,
          kitIdCount: kitIds.length,
          // Records when this order was authorised via a doctor override of
          // the readiness gate — the reason lives on the immutable approval
          // event; here we flag that the order rode on one.
          ...(input.readinessOverride
            ? { readinessOverridden: true, readinessOverrideReason: input.readinessOverride.reason }
            : {}),
        },
        prismaClient: tx,
      });

      return intent;
    });
    result = { intent: created, intentCreated: true };
  } catch (err) {
    // Unique-violation on the (consultationId, consultationVersionId) key means
    // the intent already exists — a concurrent click, a retry, or a re-approval
    // of the same version. The transaction has rolled back (no duplicate audit
    // row), so read the winning row with the base client and return it.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.kitOrderIntent.findUnique({
        where: uniqueWhere,
      });
      if (!existing) throw err;
      result = { intent: existing, intentCreated: false };
    } else {
      throw err;
    }
  }

  // ── Step 2b: stamp where this order's kits are going ──────────────────────
  //
  // Every new order carries an explicit destination. The value comes from the
  // clinic's own commercial setting rather than from a null column
  // reinterpreted at read time — see lib/fulfilment/newOrderMode for why that
  // distinction matters. The doctor can still override this one order before
  // it enters fulfilment.
  //
  // ── Why this is OUTSIDE the transaction ───────────────────────────────────
  // `fulfilmentMode` lives on 20260829_post_approval_workflow. On an
  // environment where that migration has not been applied, the UPDATE fails
  // with 42703 — and a failed statement poisons the WHOLE Postgres transaction
  // (25P02), exactly the trap documented a few lines above. Running it inside
  // `tx` would mean an unmigrated database could no longer approve a
  // consultation at all: a brand-new operational column would have broken the
  // clinical path.
  //
  // So it runs after the commit and cannot fail the approval. The cost is a
  // brief window where the order exists without a stamped destination, which
  // readers already handle — `resolveFulfilmentMode` treats an absent value as
  // the documented legacy fallback and reports it as not explicit.
  if (result.intentCreated) {
    try {
      const mode = await resolveNewOrderFulfilmentMode(prisma, assessment.clinicId);
      await setFulfilmentMode({ kitOrderIntentId: result.intent.id, mode });
    } catch (err) {
      // Includes FulfilmentNotProvisionedError on an unmigrated database.
      // Logged without identifiers; the order stands either way.
      console.warn(
        `[approve] could not stamp fulfilment mode: ${
          err instanceof Error ? err.name : "unknown"
        }`,
      );
    }
  }

  // ── Steps 3 & 4: preserve + request the one-pager ─────────────────────────
  //
  // These are the only doctor-CRITICAL-path work that is not the decision
  // itself: a one-pager snapshot (an object-store UPLOAD — the slow one) and a
  // render request (a durable PENDING ReportAsset row). The approval, the kit
  // order and the assessment mirror are already committed above, so neither may
  // be undone by a slow object store or an unavailable renderer.
  //
  // deferReportPrep moves both off this request. The doctor sees "Approved" as
  // soon as the approval + order are durable, and the client fires
  // /api/consultation/[id]/report/prepare (→ prepareApprovedReport) which runs
  // these two in its own request — reliable because it is a real awaited
  // request, not a fire-and-forget promise that a serverless freeze could drop.
  let snapshot: SnapshotResult;
  let reportAssetId: string | null;
  if (input.deferReportPrep) {
    snapshot = { ok: false, reason: "report_not_ready", detail: "deferred to /report/prepare" };
    reportAssetId = null;
  } else {
    const prep = await runOnePagerPrep(prisma, {
      assessmentId: input.assessmentId,
      clinicId: assessment.clinicId,
      patientId: assessment.patientId,
      consultationId,
      consultationVersionId: versionRow.id,
      contentVersion: approved.contentVersion,
      approvedBy: approved.metadata.approvedBy ?? null,
      actorId: input.actor.userId,
    });
    snapshot = prep.snapshot;
    reportAssetId = prep.reportAssetId;
  }

  return {
    approval: approved,
    intent: result.intent,
    intentCreated: result.intentCreated,
    snapshot,
    reportAssetId,
  };
}

interface OnePagerPrepIds {
  assessmentId: string;
  clinicId: string;
  patientId: string | null;
  consultationId: string;
  consultationVersionId: string;
  contentVersion: number;
  approvedBy: string | null;
  actorId: string | null;
}

/**
 * Preserve the released sheet (snapshot upload) and request the one-pager
 * render for an already-approved version. Both are total (describe failures
 * rather than throwing); a failure costs the patient a picture, not their
 * approval. Awaited so a serverless invocation cannot be frozen mid-upload.
 */
async function runOnePagerPrep(
  prisma: PrismaClient,
  ids: OnePagerPrepIds,
): Promise<{ snapshot: SnapshotResult; reportAssetId: string | null }> {
  const snapshot = await saveOnePagerSnapshot({
    assessmentId: ids.assessmentId,
    clinicId: ids.clinicId,
    contentVersion: ids.contentVersion,
    approvedBy: ids.approvedBy,
  });
  if (!snapshot.ok) {
    console.warn(
      `[one-pager-snapshot] ${ids.assessmentId} v${ids.contentVersion} not preserved:`,
      snapshot.reason,
      snapshot.detail,
    );
  }
  const render = await requestOnePagerRender({
    clinicId: ids.clinicId,
    patientId: ids.patientId,
    assessmentId: ids.assessmentId,
    consultationId: ids.consultationId,
    consultationVersionId: ids.consultationVersionId,
    contentVersion: ids.contentVersion,
    actorId: ids.actorId,
  });
  return { snapshot, reportAssetId: render.assetId };
}

/**
 * The deferred half of approval's report work, run from a follow-up request
 * after the doctor already sees "Approved". Re-derives the approved version's
 * ids from the assessment and runs runOnePagerPrep. A no-op (reason returned)
 * when there is no approved version yet — it is only ever called right after a
 * successful approval, and it is idempotent on the approved version.
 */
export async function prepareApprovedReport(
  prisma: PrismaClient,
  params: { assessmentId: string; actorId?: string | null },
): Promise<{ ok: boolean; reason?: string }> {
  const [assessment, consultation] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: params.assessmentId },
      select: { clinicId: true, patientId: true },
    }),
    prisma.consultation.findUnique({
      where: { assessmentId: params.assessmentId },
      select: {
        id: true,
        currentVersion: {
          select: {
            id: true,
            contentVersion: true,
            approvalStatus: true,
            approvedBy: true,
          },
        },
      },
    }),
  ]);
  const version = consultation?.currentVersion;
  if (!assessment || !consultation || !version) {
    return { ok: false, reason: "no_version" };
  }
  if (String(version.approvalStatus) !== "APPROVED") {
    return { ok: false, reason: "not_approved" };
  }
  await runOnePagerPrep(prisma, {
    assessmentId: params.assessmentId,
    clinicId: assessment.clinicId,
    patientId: assessment.patientId,
    consultationId: consultation.id,
    consultationVersionId: version.id,
    contentVersion: version.contentVersion,
    // The doctor recorded on the approved version row itself.
    approvedBy: version.approvedBy ?? null,
    actorId: params.actorId ?? null,
  });
  return { ok: true };
}
