import type { StoredVersion } from "@hairos/packages/consultation-orchestrator";
import { evaluateClinicalReadinessForApproval } from "@shared/clinical-readiness/evaluator";
import type { ReadinessDecision } from "@shared/clinical-readiness/evaluator";
import { ArtifactType, AssessmentStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  sanitizeErrorClass,
  type ConsultationLoadStage,
} from "@/lib/observability/lifecycle";

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
  reportState: "not_started" | "generating" | "ready" | "failed" | "unavailable";
  orderIntentId: string | null;
  orderIntentStatus: string | null;
  /**
   * Which optional dependencies could not be read. Present so the UI can say
   * "Order status temporarily unavailable" on that one panel instead of the
   * whole screen, and so the API can log *which* dependency failed rather
   * than swallowing it.
   */
  degraded: ConsultationOptionalFailure[];
}

export interface ConsultationOptionalFailure {
  dependency: "report" | "order";
  stage: ConsultationLoadStage;
  errorClass: string;
}

const REPORT_GENERATING_STATUSES = new Set<string>([
  AssessmentStatus.NORMALIZING,
  AssessmentStatus.RUNNING_CLINICAL_ENGINE,
  AssessmentStatus.GENERATING_RECOMMENDATIONS,
  AssessmentStatus.GENERATING_NARRATIVE,
  AssessmentStatus.GENERATING_REPORT,
  AssessmentStatus.REPORT_GENERATING,
]);

/**
 * Read the optional operational panels. **Never throws.**
 *
 * ── Why this is a total function ────────────────────────────────────────────
 * This ran inside the same `try` as the clinical composition, and two of its
 * three queries had no error handling. So a failure computing a *report status
 * badge* returned 500 for the entire consultation and the doctor was told the
 * clinical review could not be loaded. The compound-unique lookup on
 * AIArtifact is the realistic trigger: `AIArtifact_assessmentId_type_key` is
 * one of the indexes the migration chain never creates, so it is exactly the
 * kind of thing that is present in one environment and absent in the next.
 *
 * Each dependency now degrades on its own and records which one failed. The
 * deliberate part is that it does *not* use a bare `.catch(() => null)`: a
 * silent null here and a genuinely absent artifact are different facts, and
 * only one of them is worth waking someone for.
 */
export async function readOperationalState(
  prisma: PrismaClient,
  assessmentId: string,
): Promise<ConsultationOperationalState> {
  const degraded: ConsultationOptionalFailure[] = [];

  const [statusResult, reportResult, intentResult] = await Promise.all([
    settle(
      () =>
        prisma.assessment.findUnique({
          where: { id: assessmentId },
          select: { status: true },
        }),
      "report",
      "OPTIONAL_PDF_STATE",
    ),
    settle(
      () =>
        prisma.aIArtifact.findUnique({
          where: { assessmentId_type: { assessmentId, type: ArtifactType.REPORT } },
          select: { id: true },
        }),
      "report",
      "OPTIONAL_PDF_STATE",
    ),
    settle(
      () =>
        prisma.kitOrderIntent.findFirst({
          where: { assessmentId },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
        }),
      "order",
      "OPTIONAL_ORDER_STATE",
    ),
  ]);

  for (const r of [statusResult, reportResult, intentResult]) {
    if (r.failure) degraded.push(r.failure);
  }

  let reportState: ConsultationOperationalState["reportState"];
  if (statusResult.failure || reportResult.failure) {
    // Do not guess. "unavailable" is distinct from "not_started" — one means
    // no report has been made, the other means we could not find out.
    reportState = "unavailable";
  } else {
    const status = statusResult.value?.status ?? null;
    if (reportResult.value) {
      reportState = "ready";
    } else if (status === AssessmentStatus.PARTIAL_FAILURE || status === AssessmentStatus.FAILED) {
      reportState = "failed";
    } else if (status && REPORT_GENERATING_STATUSES.has(status)) {
      reportState = "generating";
    } else {
      reportState = "not_started";
    }
  }

  return {
    reportState,
    orderIntentId: intentResult.value?.id ?? null,
    orderIntentStatus: intentResult.value?.status ?? null,
    degraded,
  };
}

/** Run one optional read, converting a throw into a described failure. */
async function settle<T>(
  run: () => Promise<T>,
  dependency: ConsultationOptionalFailure["dependency"],
  stage: ConsultationLoadStage,
): Promise<{ value: T | null; failure: ConsultationOptionalFailure | null }> {
  try {
    return { value: await run(), failure: null };
  } catch (err) {
    return {
      value: null,
      failure: { dependency, stage, errorClass: sanitizeErrorClass(err) },
    };
  }
}
