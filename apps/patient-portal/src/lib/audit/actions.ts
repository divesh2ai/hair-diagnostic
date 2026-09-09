// The canonical list of audit action names, as DATA rather than as a type.
//
// Why this file exists
// ────────────────────
// `AuditAction` was a bare TypeScript union inside writeAuditLog.ts. A union
// is erased at build time, so nothing at runtime could enumerate the valid
// actions — which is why the audit console shipped a free-text "Action
// contains…" box against an API that does exact matching. A reviewer had no
// way to discover a valid name, and a near-miss returned a confident,
// completely wrong "No audit entries".
//
// Declaring the list here as a `const` array and DERIVING the union from it
// keeps the exact same type (every existing call site still type-checks) while
// giving the UI something to render a picker from and the API something to
// validate against.
//
// This module deliberately imports nothing. The audit filter UI is a client
// component, and pulling in writeAuditLog.ts — which imports Prisma — would
// drag the database client into the browser bundle.

/**
 * Every action name the platform may write. Grouped for the picker; the
 * grouping is presentation only and carries no behaviour.
 *
 * Adding a name here is what makes it filterable. Adding one to the union
 * without adding it here is now a type error, which is the point.
 */
export const AUDIT_ACTION_GROUPS = {
  "Clinical review": [
    "CONSULTATION_CREATED",
    "CLINICAL_PROCESSING_COMPLETED",
    "CLINICAL_PROCESSING_FAILED",
    "DOCTOR_NOTE_SAVED",
    "CONSULTATION_UPDATED",
    "CONSULTATION_APPROVED",
    "CONSULTATION_NEEDS_REVISION",
    "CONSULTATION_REJECTED",
    "RECOMMENDATION_FEEDBACK_SUBMITTED",
    "CLINICAL_RECORD_VIEWED",
    "PHASE_A_RECLAIMED",
    "KIT_BUDGET_SUBSTITUTION_APPLIED",
    "KIT_BUDGET_SUBSTITUTION_RESTORED",
  ],
  Reports: [
    "REPORT_GENERATION_STARTED",
    "REPORT_GENERATION_FAILED",
    "REPORT_RETRIED",
    "REPORT_GENERATED",
  ],
  "Kit orders & fulfilment": [
    "KIT_ORDER_INTENT_CREATED",
    "KIT_ORDER_INTENT_CANCELLED",
    "KIT_ORDER_PAYMENT_CONFIRMED",
    "KIT_ORDER_PAYMENT_DUPLICATE_IGNORED",
    "KIT_ORDER_FULFILMENT_MODE_SET",
    "KIT_FULFILMENT_REQUESTED",
    "KIT_FULFILMENT_STATE_CHANGED",
    "KIT_FULFILMENT_TRANSITION_REJECTED",
    "TREATMENT_START_RECORDED",
  ],
  "Patient delivery": [
    "PATIENT_REPORT_SHARED",
    "PATIENT_CART_SHARED",
    "PATIENT_DELIVERY_FAILED",
    "PATIENT_REPORT_OPENED",
    "PATIENT_CART_OPENED",
  ],
  "Clinic administration": [
    "CLINIC_CREATED",
    "CLINIC_UPDATED",
    "CLINIC_SUSPENDED",
    "CLINIC_ACTIVATED",
    "CLINIC_ARCHIVED",
    "CLINIC_LOCATION_CREATED",
    "CLINIC_LOCATION_UPDATED",
    "CLINIC_LOCATION_DELETED",
    "PLATFORM_SETTINGS_UPDATED",
  ],
  Invitations: [
    "DOCTOR_INVITATION_CREATED",
    "DOCTOR_INVITATION_RESENT",
    "DOCTOR_INVITATION_CANCELLED",
    "DOCTOR_INVITATION_EXPIRED",
  ],
  "Privileged exports": [
    "ADMIN_ORDER_EXPORT",
    "DOCTOR_ORDER_SUMMARY_EXPORT",
    "AUDIT_LOG_EXPORTED",
  ],
} as const;

/** Flat list, in group order. */
export const AUDIT_ACTIONS = Object.values(AUDIT_ACTION_GROUPS).flat();

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const ACTION_SET: ReadonlySet<string> = new Set<string>(AUDIT_ACTIONS);

/**
 * Narrow an untrusted string to a known action.
 *
 * The audit API previously passed whatever arrived in `?action=` straight into
 * a Prisma equality filter. That could not injure the database, but it could
 * not be distinguished from a real empty result either: an unknown name and a
 * genuinely quiet action both returned zero rows. Callers use this to tell the
 * two apart and say so in the response.
 */
export function isKnownAuditAction(value: string): value is AuditAction {
  return ACTION_SET.has(value);
}
