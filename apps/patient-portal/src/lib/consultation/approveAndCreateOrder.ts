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
import { SystemRole } from "@prisma/client";

export interface ApproveAndCreateOrderInput {
  assessmentId: string;
  actor: {
    userId: string | null;
    role: SystemRole;
    clinicId: string | null;
  };
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
}

export interface ApproveAndCreateOrderResult {
  approval: StoredVersion;
  intent: KitOrderIntent;
  intentCreated: boolean; // false when a prior click already created it
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

  // The KitOrderIntent.doctorId FK requires a real Doctor row; if the
  // approver is not a doctor and no reviewing doctor is set, refuse rather
  // than fabricate.
  const doctorId =
    assessment.reviewingDoctorId ??
    (input.actor.role === SystemRole.DOCTOR && input.actor.userId
      ? await resolveDoctorId(prisma, input.actor.userId)
      : null);
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

  const result = await prisma.$transaction(async (tx) => {
    // Idempotent create: use the unique index. If the intent already exists,
    // we do NOT emit a duplicate audit row.
    let intentCreated = false;
    let intent: KitOrderIntent | null = null;

    try {
      intent = await tx.kitOrderIntent.create({
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
      intentCreated = true;

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
    } catch (err) {
      // Unique-violation on the (consultationId, consultationVersionId) key
      // means a concurrent click already committed. Return that row.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        intent = await tx.kitOrderIntent.findUnique({
          where: {
            consultationId_consultationVersionId: {
              consultationId,
              consultationVersionId: versionRow.id,
            },
          },
        });
        if (!intent) throw err;
        intentCreated = false;
      } else {
        throw err;
      }
    }

    return { intent: intent!, intentCreated };
  });

  return {
    approval: approved,
    intent: result.intent,
    intentCreated: result.intentCreated,
  };
}

async function resolveDoctorId(
  prisma: PrismaClient,
  supabaseUserId: string,
): Promise<string | null> {
  const doctor = await prisma.doctor.findUnique({
    where: { supabaseUserId },
    select: { id: true },
  });
  return doctor?.id ?? null;
}
