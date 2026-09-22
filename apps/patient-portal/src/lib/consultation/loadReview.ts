// Loading a consultation for doctor review, with a hard boundary between the
// clinical record and everything decorating it.
//
// ── The rule this file exists to enforce ────────────────────────────────────
// A doctor must never lose the clinical review because an optional artifact,
// a legacy field, a PDF status, an order status or an analytics read failed.
//
// Before this module, one `try` wrapped both the consultation and the
// operational badges, and any throw anywhere in it produced a 500 that the
// client rendered as "We could not load this consultation. Please refresh." —
// the same sentence for an expired session, another clinic's assessment, a
// historical record, and a genuine engine crash.
//
// ── CORE / OPTIONAL ─────────────────────────────────────────────────────────
// CORE      the consultation content, its version envelope, readiness. Without
//           it there is nothing to review, so a CORE failure is an error
//           screen with a reference id.
// OPTIONAL  report state, order state. A failure here degrades one panel and
//           the review proceeds.
//
// Nothing in this path performs I/O to RAG, an LLM, PDF rendering or WhatsApp.
// The composition step is CPU-bound and deterministic, and stays that way.
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { OrchestratorError } from "@hairos/packages/consultation-orchestrator";
import type { ConsultationOrchestrator } from "@hairos/packages/consultation-orchestrator";
import {
  consultationMeta,
  readOperationalState,
  type ConsultationMeta,
  type ConsultationOperationalState,
  type ConsultationOptionalFailure,
} from "@/lib/consultation/meta";
import {
  logLifecycleEvent,
  sanitizeErrorClass,
  type ConsultationLoadStage,
} from "@/lib/observability/lifecycle";

/**
 * Stable, machine-readable failure codes. The client switches on these, so
 * they are part of the API contract — add, never repurpose.
 */
export type ConsultationErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CROSS_CLINIC"
  | "ASSESSMENT_NOT_FOUND"
  | "CONSULTATION_NOT_COMPOSABLE"
  | "CONSULTATION_NOT_APPLICABLE"
  | "CONSULTATION_LOAD_FAILED";

/**
 * Why a record is clinically thinner than normal. Internal codes — the doctor
 * sees prose, never these.
 */
export type ReviewDegradedReason =
  | "LEGACY_RAW_RESPONSES_MISSING"
  | "REPORT_STATE_UNAVAILABLE"
  | "ORDER_STATE_UNAVAILABLE"
  | "ONE_PAGER_STATE_UNAVAILABLE";

/**
 * Which reason each optional dependency contributes when it cannot be read.
 *
 * A map rather than a ternary: the ternary this replaced labelled anything
 * that was not the report as an order failure, so the third dependency would
 * have been reported as the wrong one from the day it was added.
 */
const DEGRADED_REASON_BY_DEPENDENCY: Record<
  ConsultationOptionalFailure["dependency"],
  ReviewDegradedReason
> = {
  report: "REPORT_STATE_UNAVAILABLE",
  order: "ORDER_STATE_UNAVAILABLE",
  onePager: "ONE_PAGER_STATE_UNAVAILABLE",
};

export interface ReviewCore {
  status: "ready" | "degraded";
  consultation: unknown;
  meta: ConsultationMeta;
  degradedReasons: ReviewDegradedReason[];
}

/**
 * Operational visit context for the review header.
 *
 * ── Why this is OPTIONAL and not part of the Consultation ───────────────────
 * `Consultation.content` is an immutable snapshot: whatever is written into v1
 * stays there for the life of the record. "This patient is returning" and
 * "they came in for kit fulfilment" are facts about a visit, not clinical
 * findings, and freezing them into a versioned clinical document would be
 * wrong in both directions — they would go stale, and they would appear to
 * carry clinical weight they do not have.
 *
 * ── Why it costs nothing ────────────────────────────────────────────────────
 * The route already runs one raw query against Assessment to resolve the
 * clinic and the questionnaire presence. These four columns ride along in it.
 * No second fetch, no per-section endpoint, no migration.
 */
export interface ReviewVisitContext {
  /** Start of the doctor's waiting clock. Never the intake time. */
  submittedAt: string | null;
  /** INITIAL · FOLLOW_UP · KIT_FULFILMENT · REASSESSMENT · NEW_CONCERN · CONDITION_CHANGED */
  visitType: string | null;
  /** NEW · RETURNING · AMBIGUOUS */
  patientRelationship: string | null;
  /**
   * Operational review pathway — NOT clinical severity.
   *
   * Null for essentially every row today: the classifier is built but
   * disabled, so it has classified 0 of ~489 assessments. Consumers must
   * render nothing when it is null rather than defaulting to "Standard",
   * which would invent a classification that was never made.
   */
  reviewPathway: string | null;
}

export interface ReviewOptional {
  operational: ConsultationOperationalState | null;
  visit: ReviewVisitContext | null;
}

export type ConsultationReviewResult =
  | {
      ok: true;
      requestId: string;
      core: ReviewCore;
      optional: ReviewOptional;
      warnings: Array<{ code: string; stage: ConsultationLoadStage }>;
    }
  | {
      ok: false;
      requestId: string;
      httpStatus: number;
      code: ConsultationErrorCode;
      /** Doctor-facing. Never contains SQL, stack traces or tenant ids. */
      message: string;
      stage: ConsultationLoadStage;
    };

/** Doctor-facing copy per code. Deliberately free of implementation language. */
const MESSAGES: Record<ConsultationErrorCode, string> = {
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You don't have access to this assessment.",
  CROSS_CLINIC: "You don't have access to this assessment.",
  ASSESSMENT_NOT_FOUND: "This assessment is no longer available.",
  CONSULTATION_NOT_COMPOSABLE:
    "This historical record can't be opened for review — its original assessment responses were not stored.",
  CONSULTATION_NOT_APPLICABLE:
    "This is a Dr Skin FACT assessment. It has been submitted and stored, but the hair clinical review does not apply to it.",
  CONSULTATION_LOAD_FAILED: "We couldn't open this clinical review. Please retry.",
};

/**
 * Short, readable reference shown to the doctor and carried in every log line
 * for the request. `CR-` so a support inbox can recognise it on sight.
 */
export function newRequestId(): string {
  return `CR-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export interface LoadReviewInput {
  prisma: PrismaClient;
  orchestrator: ConsultationOrchestrator;
  assessmentId: string;
  clinicId: string;
  /** Doctor row the request acts as. */
  actingDoctorId: string;
  /** Authenticated role — may be SUPER_ADMIN acting through a Doctor row. */
  authRole: string;
  mode: "doctor" | "admin_view";
  /**
   * True when the assessment's stored questionnaire is absent. Read by the
   * caller from the same query that resolved the clinic, so this module adds
   * no extra round trip for it.
   */
  legacyAssessment: boolean;
  /**
   * Visit context, read by the caller from the same query that resolved the
   * clinic. Passed in rather than fetched here so this module adds no round
   * trip, and so a caller with no visit context (a test, a script) can omit it.
   */
  visit?: ReviewVisitContext | null;
  requestId: string;
  includeOperational?: boolean;
}

export async function loadConsultationReview(
  input: LoadReviewInput,
): Promise<ConsultationReviewResult> {
  const {
    prisma,
    orchestrator,
    assessmentId,
    clinicId,
    actingDoctorId,
    authRole,
    mode,
    legacyAssessment,
    visit,
    requestId,
  } = input;

  const startedAt = Date.now();
  const logBase = {
    requestId,
    assessmentId,
    clinicId,
    actingDoctorId,
    authRole,
    mode,
    legacyAssessment,
  } as const;

  // ── CORE ──────────────────────────────────────────────────────────────────
  let stored: Awaited<ReturnType<ConsultationOrchestrator["getOrCreateDetailed"]>>;
  try {
    stored = await orchestrator.getOrCreateDetailed({
      assessmentId,
      ctx: {
        // The real authenticated role, not a hardcoded "DOCTOR". The
        // orchestrator's own super-admin branch was unreachable while every
        // caller claimed to be a doctor.
        actorId: actingDoctorId,
        role: authRole,
        clinicId,
      },
    });
  } catch (err) {
    const { code, httpStatus, stage } = classifyCoreFailure(err);
    logLifecycleEvent({
      ...logBase,
      event: "consultation.load_failed",
      severity: "core",
      failureStage: stage,
      errorCode: code,
      errorClass: sanitizeErrorClass(err),
      durationMs: Date.now() - startedAt,
    });
    return {
      ok: false,
      requestId,
      httpStatus,
      code,
      message: MESSAGES[code],
      stage,
    };
  }

  // Serialising the version envelope is CORE — a readiness snapshot that
  // cannot be evaluated means the approval gate cannot be trusted.
  let meta: ConsultationMeta;
  try {
    meta = consultationMeta(stored);
  } catch (err) {
    logLifecycleEvent({
      ...logBase,
      event: "consultation.load_failed",
      severity: "core",
      failureStage: "SERIALIZATION",
      errorCode: "CONSULTATION_LOAD_FAILED",
      errorClass: sanitizeErrorClass(err),
      durationMs: Date.now() - startedAt,
    });
    return {
      ok: false,
      requestId,
      httpStatus: 500,
      code: "CONSULTATION_LOAD_FAILED",
      message: MESSAGES.CONSULTATION_LOAD_FAILED,
      stage: "SERIALIZATION",
    };
  }

  // ── OPTIONAL ──────────────────────────────────────────────────────────────
  // Past this point the review is guaranteed to render. `readOperationalState`
  // is total, but it is still wrapped: a total function is a contract, and a
  // contract on the far side of a clinical availability boundary is worth
  // enforcing rather than trusting.
  const warnings: Array<{ code: string; stage: ConsultationLoadStage }> = [];
  const degradedReasons: ReviewDegradedReason[] = [];

  if (legacyAssessment) degradedReasons.push("LEGACY_RAW_RESPONSES_MISSING");

  let operational: ConsultationOperationalState | null = null;
  if (input.includeOperational !== false) try {
    operational = await readOperationalState(prisma, assessmentId);
    for (const failure of operational.degraded) {
      warnings.push({ code: `OPTIONAL_${failure.dependency.toUpperCase()}_UNAVAILABLE`, stage: failure.stage });
      degradedReasons.push(DEGRADED_REASON_BY_DEPENDENCY[failure.dependency]);
      logLifecycleEvent({
        ...logBase,
        event: "consultation.optional_degraded",
        severity: "optional",
        failureStage: failure.stage,
        errorClass: failure.errorClass,
      });
    }
  } catch (err) {
    warnings.push({ code: "OPTIONAL_OPERATIONAL_UNAVAILABLE", stage: "UNKNOWN" });
    logLifecycleEvent({
      ...logBase,
      event: "consultation.optional_degraded",
      severity: "optional",
      failureStage: "UNKNOWN",
      errorClass: sanitizeErrorClass(err),
    });
  }

  if (legacyAssessment) {
    logLifecycleEvent({
      ...logBase,
      event: "consultation.legacy_degraded",
      severity: "optional",
      durationMs: Date.now() - startedAt,
    });
  }

  return {
    ok: true,
    requestId,
    core: {
      status: degradedReasons.length > 0 ? "degraded" : "ready",
      consultation: stored.content,
      meta,
      degradedReasons,
    },
    optional: { operational, visit: visit ?? null },
    warnings,
  };
}

/** Map an orchestrator/database failure onto the public error contract. */
function classifyCoreFailure(err: unknown): {
  code: ConsultationErrorCode;
  httpStatus: number;
  stage: ConsultationLoadStage;
} {
  if (err instanceof OrchestratorError) {
    switch (err.code) {
      case "not_found":
        return { code: "ASSESSMENT_NOT_FOUND", httpStatus: 404, stage: "ASSESSMENT_LOAD" };
      case "forbidden":
        return { code: "FORBIDDEN", httpStatus: 403, stage: "TENANT_CHECK" };
      case "not_composable":
        // 422, not 404: the record exists and the caller may see it. A 404
        // here is precisely the lie that started this work.
        return {
          code: "CONSULTATION_NOT_COMPOSABLE",
          httpStatus: 422,
          stage: "CONSULTATION_COMPOSE",
        };
      default:
        return { code: "CONSULTATION_LOAD_FAILED", httpStatus: 409, stage: "CONSULTATION_LOOKUP" };
    }
  }

  // A throw from inside buildConsultation's engine pipeline. Distinguished
  // from a database fault because the remedy is completely different: one is
  // retried, the other needs a clinical-engine fix.
  const name = sanitizeErrorClass(err);
  const stage: ConsultationLoadStage = name.startsWith("PrismaClient")
    ? "CONSULTATION_LOOKUP"
    : "CLINICAL_ENGINE";

  return { code: "CONSULTATION_LOAD_FAILED", httpStatus: 500, stage };
}
