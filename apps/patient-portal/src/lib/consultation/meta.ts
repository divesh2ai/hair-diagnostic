import type { StoredVersion } from "@hairos/packages/consultation-orchestrator";
import { evaluateClinicalReadinessForApproval } from "@shared/clinical-readiness/evaluator";
import type { ReadinessDecision } from "@shared/clinical-readiness/evaluator";
import { ArtifactType, AssessmentStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { resolveApprovedOrder } from "./approvedOrder";
import { signCartToken } from "@/lib/cartToken";
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
  /**
   * Whether `/reports/[id]/one-page` — the sheet the patient is actually
   * handed — can render for this assessment.
   *
   * It is a SEPARATE fact from `reportState`. The long-form PDF is a REPORT
   * artifact; the one-pager reads the NARRATIVES artifact and needs a
   * `clinical_report` object inside it. Assessments exist with one and not the
   * other (every seeded case has neither; a PARTIAL_FAILURE case can have
   * narratives and no PDF), so a UI that gates the one-pager on `reportState`
   * — or on nothing at all — offers a link to a page that cannot render.
   */
  onePagerState: "not_started" | "generating" | "ready" | "failed" | "unavailable";
  /**
   * The order belonging to the CURRENT approved consultation version, or null.
   *
   * Non-null here is the one condition under which a cart action may be
   * rendered: it means resolveApprovedOrder found an APPROVED current version
   * whose intent is READY_FOR_FULFILMENT, which is exactly what the cart API
   * requires to return 200. A null therefore guarantees the cart would answer
   * "no confirmed plan yet", so the UI must not offer a link.
   */
  orderIntentId: string | null;
  orderIntentStatus: string | null;
  /** Content version the order was cut from — lets the UI prove identity. */
  orderContentVersion: number | null;
  /**
   * Signed, assessment-bound token that opens the patient cart.
   *
   * Minted here rather than in the browser because the signing secret is
   * server-only. Non-null exactly when `orderIntentId` is non-null: a token
   * for a cart that would answer "no confirmed plan yet" is a link the UI must
   * not offer, and issuing one anyway would put a live credential into a
   * payload for no reason.
   *
   * Carries no patient data — see lib/cartToken.
   */
  cartToken: string | null;
  /**
   * Which optional dependencies could not be read. Present so the UI can say
   * "Order status temporarily unavailable" on that one panel instead of the
   * whole screen, and so the API can log *which* dependency failed rather
   * than swallowing it.
   */
  degraded: ConsultationOptionalFailure[];
}

export interface ConsultationOptionalFailure {
  dependency: "report" | "order" | "onePager";
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

  const [statusResult, reportResult, intentResult, onePagerResult] = await Promise.all([
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
      // Was `findFirst({ assessmentId }, orderBy: createdAt desc)` — the newest
      // intent of ANY status, including CANCELLED, and resolved by a different
      // rule than the cart API used. That let the UI offer a cart action for a
      // cancelled order and then land the doctor on a different (or missing)
      // one. Both surfaces now share resolveApprovedOrder, which keys off the
      // consultation's current version.
      () => resolveApprovedOrder(prisma as PrismaClient, assessmentId),
      "order",
      "OPTIONAL_ORDER_STATE",
    ),
    settle(
      () => readOnePagerNarrative(prisma, assessmentId),
      "onePager",
      "OPTIONAL_ONE_PAGER_STATE",
    ),
  ]);

  for (const r of [statusResult, reportResult, intentResult, onePagerResult]) {
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

  // The one-pager's own dependency answers first: a NARRATIVES artifact that
  // already carries a clinical_report makes the page renderable whatever the
  // assessment status says, and two of the three cases that have one are
  // PARTIAL_FAILURE. Only when the artifact is absent does the status explain
  // whether it is still coming.
  let onePagerState: ConsultationOperationalState["onePagerState"];
  if (onePagerResult.failure) {
    onePagerState = "unavailable";
  } else if (onePagerResult.value === true) {
    onePagerState = "ready";
  } else if (statusResult.failure) {
    onePagerState = "unavailable";
  } else {
    const status = statusResult.value?.status ?? null;
    if (status === AssessmentStatus.PARTIAL_FAILURE || status === AssessmentStatus.FAILED) {
      onePagerState = "failed";
    } else if (status && REPORT_GENERATING_STATUSES.has(status)) {
      onePagerState = "generating";
    } else {
      onePagerState = "not_started";
    }
  }

  return {
    reportState,
    onePagerState,
    orderIntentId: intentResult.value?.intentId ?? null,
    orderIntentStatus: intentResult.value?.status ?? null,
    orderContentVersion: intentResult.value?.contentVersion ?? null,
    cartToken: intentResult.value?.intentId ? signCartToken(assessmentId) : null,
    degraded,
  };
}

/**
 * Does the latest NARRATIVES artifact carry a composed `clinical_report`?
 *
 * Mirrors what `loadOnePageReportData` actually requires, so the answer here
 * and the behaviour of the page cannot disagree: newest-first rather than the
 * compound-unique lookup (that index is missing in some environments), and the
 * same "is it an object" test the loader applies before it throws its 202.
 *
 * The check runs in Postgres rather than pulling the narrative blob back for
 * a key lookup — the doctor review page loads this on every open.
 */
async function readOnePagerNarrative(
  prisma: PrismaClient,
  assessmentId: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ ready: boolean | null }>>`
    SELECT (jsonb_typeof("content" -> 'clinical_report') = 'object') AS "ready"
    FROM "AIArtifact"
    WHERE "assessmentId" = ${assessmentId}
      AND "type" = ${ArtifactType.NARRATIVES}::"ArtifactType"
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0]?.ready === true;
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
