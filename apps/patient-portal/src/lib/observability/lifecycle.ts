// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle observability.
//
// One small structured emitter that every assessment / consultation lifecycle
// caller uses. The output is a single JSON line per event on stdout so Vercel
// / any log aggregator can index it without additional infra. If Sentry gets
// wired later the same call sites don't need to change — this helper is the
// single seam.
//
// SAFETY: The payload shape is closed. Callers may only pass
// LifecycleEventPayload fields. We deliberately do NOT accept an open
// Record<string, unknown> — that's how patient answers, tokens, and signed
// URLs leak into ops logs. If a new metadata dimension is needed, add it
// here explicitly.
//
// Failure codes are stable identifiers, not free text. Add new ones to
// LifecycleFailureCode; do not stringify exception messages into logs.
// ─────────────────────────────────────────────────────────────────────────────

export type LifecycleEventName =
  // Assessment lifecycle
  | "assessment.submitted"
  | "phaseA.claimed"
  | "phaseA.claim_lost"
  | "phaseA.completed"
  | "phaseA.failed"
  | "phaseB.started"
  | "phaseB.failed"
  | "pdf.generation_started"
  | "pdf.generation_completed"
  // Consultation lifecycle
  | "consultation.created"
  | "consultation.revised"
  | "consultation.approved"
  // The three below were already being emitted by the approve / order /
  // feedback / retry routes but were missing from this union, so every one of
  // those call sites was a type error and the events they name were outside
  // the closed set this module exists to enforce.
  | "consultation.approved_with_order"
  | "consultation.needs_revision"
  | "consultation.rejected"
  | "consultation.approval_blocked"
  | "feedback.denied"
  | "report_retry.started"
  | "report_retry.denied"
  | "token.approval_accepted"
  | "token.approval_rejected"
  // Release / access gates
  | "pdf.release_allowed"
  | "pdf.release_denied"
  | "status.access_allowed"
  | "status.access_denied"
  // Terminal / attention required
  | "assessment.attention_required"
  // ── Clinic floor ──────────────────────────────────────────────────────────
  // Everything below exists for one reason: a doctor standing in front of a
  // waiting patient must not be the first person to learn that the backend is
  // broken. Each one marks a point where the clinic flow can fail silently —
  // the patient sees a spinner, the dashboard shows an empty queue, and
  // nothing else anywhere says why.
  | "patient.lookup_failed"
  | "clinicvisit.created"
  | "clinicvisit.link_failed"
  | "doctor.queue_load_failed"
  | "schema.drift_detected"
  | "ratelimit.backend_unavailable"
  // ── Doctor consultation review load ───────────────────────────────────────
  // `consultation.load_failed` is the CORE failure — the doctor saw an error
  // screen. `consultation.optional_degraded` is the OPTIONAL failure — the
  // doctor reviewed the patient normally and one panel said "unavailable".
  // They are separate events because they need separate alert thresholds: one
  // is an outage, the other is background noise until it becomes a trend.
  | "consultation.load_failed"
  | "consultation.optional_degraded"
  | "consultation.legacy_degraded"
  | "consultation.orphan_recovered";

export type LifecycleFailureCode =
  // Auth
  | "unauthenticated"
  | "cross_clinic"
  | "invalid_token"
  | "expired_token"
  // Assessment state
  | "not_found"
  | "state_ineligible"
  | "retry_exhausted"
  // Approval / release
  | "not_approved"
  | "stale_version"
  | "grounding_violation"
  | "reasoning_gap"
  // Clinic floor
  /** Code is deployed ahead of its migration — see lib/prismaErrors. */
  | "schema_drift"
  | "rate_limited"
  // Generic
  | "internal_error";

// The closed payload shape. Nothing that could contain PII, tokens, signed
// URLs, or free-text clinical content is allowed here.
export interface LifecycleEventPayload {
  event: LifecycleEventName;
  assessmentId?: string;
  clinicId?: string | null;
  executionId?: string | null;
  stage?: string;
  statusBefore?: string;
  statusAfter?: string;
  durationMs?: number;
  retryCount?: number;
  failureCode?: LifecycleFailureCode;
  /**
   * Sanitized exception class name (e.g. "PrismaClientKnownRequestError").
   * NEVER stringify the exception message — those leak query strings, patient
   * fields, and internal paths.
   */
  errorClass?: string;
  /**
   * Audience of the access decision. Used for status/PDF gates so we can
   * distinguish "same-clinic doctor allowed" from "anonymous patient allowed".
   */
  audience?: "clinic" | "super_admin" | "patient_token" | "anonymous";
  /** Optional attention-required subtype for the doctor dashboard signal. */
  attention?: "phaseA_failed" | "phaseB_failed" | "retry_exhausted" | "stuck";

  // ── Consultation review load ──────────────────────────────────────────────
  /**
   * Correlation id, also shown to the doctor as a reference on a CORE failure.
   * This is the field that turns "a doctor says the page broke" into one log
   * line. Random per request; carries no patient information.
   */
  requestId?: string;
  /** Where in the load it went wrong. See ConsultationLoadStage. */
  failureStage?: ConsultationLoadStage;
  /**
   * Whether the failure denied the clinical review or only degraded a panel.
   * The single most important field for triage.
   */
  severity?: "core" | "optional";
  /** Stable API error code returned to the client, when one was. */
  errorCode?: string;
  /** Authenticated role, distinct from the Doctor the request acts as. */
  authRole?: string;
  /** "doctor" for a doctor acting as themselves, "admin_view" otherwise. */
  mode?: "doctor" | "admin_view";
  /** The Doctor row the request resolved to. Not the auth user id. */
  actingDoctorId?: string;
  /** True when the assessment's stored questionnaire was missing/unusable. */
  legacyAssessment?: boolean;
  /** Consultation row existed with no currentVersion and had to be repaired. */
  orphanRecoveryAttempted?: boolean;
  orphanRecoverySucceeded?: boolean;
}

/**
 * Failure stages for the doctor consultation load.
 *
 * Replaces a single `[CONSULTATION_API_FAIL]` string that could mean an auth
 * problem, a tenant rejection, a legacy row, a clinical engine exception or a
 * JSON serialisation fault — with no way to tell which without a stack trace
 * nobody had.
 */
export type ConsultationLoadStage =
  | "AUTH"
  | "TENANT_CHECK"
  | "ASSESSMENT_LOAD"
  | "CONSULTATION_LOOKUP"
  | "CONSULTATION_COMPOSE"
  | "CONSULTATION_RECOVERY"
  | "CLINICAL_ENGINE"
  | "OPTIONAL_PDF_STATE"
  | "OPTIONAL_ORDER_STATE"
  | "OPTIONAL_ONE_PAGER_STATE"
  | "SERIALIZATION"
  | "UNKNOWN";

/**
 * Emit one structured lifecycle event. Never throws. Writes one JSON line to
 * stdout with a stable prefix so filters like `vercel logs --scope=... | grep
 * '[lifecycle]'` are cheap.
 */
export function logLifecycleEvent(payload: LifecycleEventPayload): void {
  try {
    const line = {
      ...payload,
      t: new Date().toISOString(),
    };
    // Deliberately console.log (not console.info) so it lands in the default
    // stream Vercel captures without INFO-level filtering.
    console.log(`[lifecycle] ${JSON.stringify(line)}`);
  } catch {
    // Never let a logging failure impact the request path.
  }
}

/**
 * Extract a safe error class name for a thrown value. Never surfaces the
 * message — messages routinely contain raw SQL fragments, patient rows, or
 * URLs.
 */
export function sanitizeErrorClass(err: unknown): string {
  if (err && typeof err === "object" && err.constructor && err.constructor.name) {
    return err.constructor.name;
  }
  return "UnknownError";
}
