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
  | "consultation.approval_blocked"
  | "token.approval_accepted"
  | "token.approval_rejected"
  // Release / access gates
  | "pdf.release_allowed"
  | "pdf.release_denied"
  | "status.access_allowed"
  | "status.access_denied"
  // Terminal / attention required
  | "assessment.attention_required";

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
}

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
