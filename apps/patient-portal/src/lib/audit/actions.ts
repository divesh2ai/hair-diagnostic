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
    // The doctor/clinic confirming the approved order on the Clinic Order
    // screen — the order lifecycle event that sits between the intent being
    // created and payment/fulfilment. Distinct from KIT_ORDER_PAYMENT_CONFIRMED
    // (money) and TREATMENT_START_RECORDED (the patient beginning treatment).
    "CLINIC_ORDER_CONFIRMED",
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
    "MANUAL_SHARE_OPENED",
  ],
  // Rendered clinical artefacts. Separate from "Patient delivery" because
  // producing an artefact and giving it to a patient are different events with
  // different consequences: a render that failed harms nobody, a delivery that
  // went to the wrong person does.
  "Report assets": [
    "REPORT_ASSET_REQUESTED",
    "REPORT_ASSET_RENDERED",
    "REPORT_ASSET_FAILED",
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
  "Support": [
    "SUPPORT_TICKET_CREATED",
    "SUPPORT_TICKET_UPDATED",
    "SUPPORT_MESSAGE_SENT",
    "DOCTOR_ACTIVATED",
    "DOCTOR_DEACTIVATED",
  ],
  "Doctor authentication": [
    "DOCTOR_PHONE_LOGIN_LINKED",
    "DOCTOR_PHONE_LOGIN_DENIED_UNREGISTERED",
    "DOCTOR_PHONE_LOGIN_DENIED_CONFLICT",
    // A matched, provisioned number whose clinical access has been withdrawn.
    // Separate from DENIED_UNREGISTERED so "we closed this account" is never
    // reported, or audited, as "we do not know this number".
    "DOCTOR_PHONE_LOGIN_DENIED_INACTIVE",
    // Supabase mints a separate auth user per channel, so a doctor already
    // linked by email arrives at mobile login with a second uid for the same
    // person. This records that second identity being attached to the existing
    // Doctor row — a link, not a denial, and not the same event as
    // DOCTOR_PHONE_LOGIN_LINKED, which is a first login onto an unlinked row.
    "DOCTOR_PHONE_IDENTITY_ATTACHED",
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
