import type { StoredVersion } from "@hairos/packages/consultation-orchestrator";
import { evaluateClinicalReadinessForApproval } from "@shared/clinical-readiness/evaluator";
import type { ReadinessDecision } from "@shared/clinical-readiness/evaluator";
import { ArtifactType, AssessmentStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

/**
 * Approval + version metadata surfaced alongside the clinical content so the
 * doctor dashboard can render Approval Status / Version History without
 * recomputing anything. The consultation `content` stays the single source of
 * truth for clinical data; this is the non-clinical version envelope.
 */
export interface ConsultationMeta {
  contentVersion: number;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
  createdAt: string;
  createdBy: string;
  lastUpdatedAt: string;
  /**
   * Doctor-facing readiness verdict computed from the persisted
   * clinicalReadiness snapshot. The Doctor Dashboard displays blockers +
   * summary so the reviewer can act before hitting Approve.
   */
  clinicalReadiness: ReadinessDecision;
}

export function consultationMeta(stored: StoredVersion): ConsultationMeta {
  return {
    contentVersion: stored.contentVersion,
    approvalStatus: stored.metadata.approvalStatus ?? "PENDING_REVIEW",
    approvedBy: stored.metadata.approvedBy ?? null,
    approvedAt: stored.metadata.approvedAt ?? null,
    approvalNotes: stored.metadata.approvalNotes ?? null,
    createdAt: stored.createdAt,
    createdBy: stored.createdBy,
    lastUpdatedAt: stored.content.audit?.lastUpdatedAt ?? stored.createdAt,
    clinicalReadiness: evaluateClinicalReadinessForApproval(stored.content),
  };
}

// ── Operational state (report + order intent) ───────────────────────────────

/**
 * Compact operational view surfaced to the doctor UI alongside `meta`. Derived
 * from Assessment.status + REPORT artifact presence + KitOrderIntent presence
 * — never introduces a new persisted state.
 */
export interface ConsultationOperationalState {
  reportState: "not_started" | "generating" | "ready" | "failed";
  orderIntentId: string | null;
  orderIntentStatus: string | null;
}

const REPORT_GENERATING_STATUSES = new Set<string>([
  AssessmentStatus.NORMALIZING,
  AssessmentStatus.RUNNING_CLINICAL_ENGINE,
  AssessmentStatus.GENERATING_RECOMMENDATIONS,
  AssessmentStatus.GENERATING_NARRATIVE,
  AssessmentStatus.GENERATING_REPORT,
  AssessmentStatus.REPORT_GENERATING,
]);

export async function readOperationalState(
  prisma: PrismaClient,
  assessmentId: string,
): Promise<ConsultationOperationalState> {
  const [assessment, reportArtifact, intent] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { status: true },
    }),
    prisma.aIArtifact.findUnique({
      where: {
        assessmentId_type: { assessmentId, type: ArtifactType.REPORT },
      },
      select: { id: true },
    }),
    prisma.kitOrderIntent
      .findFirst({
        where: { assessmentId },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
      })
      .catch(() => null),
  ]);

  let reportState: ConsultationOperationalState["reportState"] = "not_started";
  const status = assessment?.status ?? null;
  if (reportArtifact) {
    reportState = "ready";
  } else if (status === AssessmentStatus.PARTIAL_FAILURE || status === AssessmentStatus.FAILED) {
    reportState = "failed";
  } else if (status && REPORT_GENERATING_STATUSES.has(status)) {
    reportState = "generating";
  } else {
    reportState = "not_started";
  }

  return {
    reportState,
    orderIntentId: intent?.id ?? null,
    orderIntentStatus: intent?.status ?? null,
  };
}
