// Shared shapes for the Super Admin operations dashboard.
//
// One vocabulary, defined once and reused by the overview endpoint, the
// clinic drilldown, and the UI, so a number can never mean one thing on the
// KPI strip and another in the table. The semantic rules these types encode
// (why an intent is not an order, why COMPLETED is not APPROVED, why a missing
// payments table is "Not connected" rather than ₹0) live beside the queries in
// metrics.ts — the types only carry the result.

/** How a capability-gated section resolved. */
export type CapabilityState =
  // The backing table/columns exist and were read.
  | "CONNECTED"
  // The backing migration is not applied in this environment. The honest
  // answer is "we cannot see this here", never a fabricated zero.
  | "NOT_CONNECTED";

export interface DashboardCapabilities {
  /** KitOrderPayment — confirmed/paid orders and revenue. */
  payments: CapabilityState;
  /** WhatsappDelivery — report send + provider-delivery evidence. */
  delivery: CapabilityState;
  /**
   * auth.users readability for last-sign-in. False = sign-in is UNKNOWN, which
   * is not the same as "never signed in" and must never be rendered as such.
   */
  authReadable: boolean;
}

/** An inclusive-exclusive instant window [from, to). */
export interface TimeWindow {
  fromIso: string;
  toIso: string;
  /** Human label for the KPI strip, e.g. "Today" or "1–7 Nov". */
  label: string;
}

/** A single KPI: a windowed figure beside its all-time total. */
export interface Kpi {
  today: number;
  allTime: number;
}

/**
 * A capability-gated KPI. When state is NOT_CONNECTED the numbers are null and
 * the UI shows "Not connected", never 0.
 */
export interface GatedKpi {
  state: CapabilityState;
  today: number | null;
  allTime: number | null;
}

export interface DashboardKpis {
  clinicsRegistered: number;
  clinicsOperational: number;
  doctorsTotal: number;
  /** Doctors whose Supabase account has ever recorded a sign-in. */
  doctorsSignedIn: number;
  assessments: Kpi;
  approvals: Kpi;
  /**
   * Distinct cases a doctor actually reviewed — a consultation whose current
   * version carries a COMPLETED decision: APPROVED, REVISION_REQUESTED (the
   * "needs revision" decision) or REJECTED. PENDING_REVIEW is NOT a completed
   * review and is excluded. This is the honest adoption signal: a rejection or
   * a revision request is genuine clinical work, where an approval count alone
   * would hide it. One consultation per case, so repeated actions never inflate
   * the total.
   */
  reviewedCases: Kpi;
  /** AssessmentStatus.COMPLETED — the AI pipeline finished, NOT a doctor sign-off. */
  completedAssessments: number;
  /** Consultation currentVersion.approvalStatus = PENDING_REVIEW — awaiting a doctor. */
  pendingReviews: number;
  /**
   * COMPLETED assessments that have no consultation at all. This is a pipeline
   * gap, NOT doctor inaction — the doctor cannot review a consultation that was
   * never created. Surfaced on its own so it is never miscounted as a pending
   * review.
   */
  assessmentsWithoutConsultation: number;
  /**
   * Assessments whose approved-version state and Assessment.reviewDecision
   * disagree (e.g. an APPROVED consultation version on an assessment whose
   * reviewDecision is not APPROVED). A data-integrity signal, reported, never
   * silently reconciled.
   */
  reconciliationDiscrepancies: number;
  /** ReportAsset PATIENT_REPORT_PDF with status READY — a confirmed dossier asset. */
  dossiersReady: number;
  reportsSent: GatedKpi;
  reportsDelivered: GatedKpi;
}

/** The operational facets a clinic can match — these drive the table filters. */
export interface ClinicFlags {
  neverLoggedIn: boolean;
  noAssessments: boolean;
  /** A consultation version is PENDING_REVIEW — a doctor still has to act. */
  pendingReview: boolean;
  /**
   * A COMPLETED assessment has no consultation. Pipeline attention, deliberately
   * distinct from pendingReview: it is not the doctor's turn, the consultation
   * was never produced.
   */
  missingConsultation: boolean;
  /** An approved-version / reviewDecision conflict exists. */
  reconciliationDiscrepancy: boolean;
  reportDeliveryAttention: boolean;
  activelyUsing: boolean;
  /**
   * A doctor has signed in but there is no genuine clinical work yet (no
   * reviewed case). "Logged in" is not "using" — a login alone does not prove
   * clinical work.
   */
  loggedInNoActivity: boolean;
  /**
   * The clinic DID genuine clinical work before, but nothing recent — the
   * "stopped using HairOS" signal. Distinct from never-started.
   */
  noRecentActivity: boolean;
  /**
   * Adoption cannot be established because the authentication/activity evidence
   * could not be read (e.g. auth.users unreadable) and no clinical signal is
   * present. Reported as Unknown, never as a confident "never" or zero.
   */
  trackingUnavailable: boolean;
}

export type ClinicPrimaryStatus =
  | "NEVER_LOGGED_IN"
  | "NO_ASSESSMENTS"
  | "RECONCILIATION_DISCREPANCY"
  | "MISSING_CONSULTATION"
  | "PENDING_REVIEW"
  | "REPORT_DELIVERY_ATTENTION"
  | "ACTIVELY_USING"
  // The doctor can get in but has not started clinical work yet.
  | "LOGGED_IN_NO_ACTIVITY"
  // Was adopted; has gone quiet — i.e. appears to have stopped using HairOS.
  | "NO_RECENT_ACTIVITY"
  // Can't be determined from the evidence available here.
  | "UNKNOWN_TRACKING"
  // Provisioned but not yet past onboarding (no login, no work).
  | "ONBOARDING_IDLE"
  | "SUSPENDED"
  | "ARCHIVED";

export interface ClinicDoctorSummary {
  doctorId: string;
  name: string;
  /** auth.users.last_sign_in_at (ISO), null = account exists but never used, or no account. */
  lastSignInAt: string | null;
  hasAccount: boolean;
}

export interface ClinicOpsRow {
  clinicId: string;
  name: string;
  slug: string;
  status: string; // ClinicStatus
  /** Primary branch name, or the count summary when multi-branch. */
  primaryBranch: string | null;
  branchCount: number;
  doctorCount: number;
  patientCount: number;
  /** The doctor who most recently signed in (for the "last login" column). */
  topDoctor: ClinicDoctorSummary | null;
  lastSignInAt: string | null;
  assessments: Kpi;
  approvals: Kpi;
  /**
   * Distinct cases reviewed by a doctor (APPROVED / REVISION_REQUESTED /
   * REJECTED). The genuine "a doctor actually reviewed patients" figure, kept
   * separate from the approval-only count.
   */
  reviewedCases: Kpi;
  /** AssessmentStatus.COMPLETED count (pipeline finished, NOT approved). */
  completedAssessments: number;
  awaitingReview: number;
  /** COMPLETED assessments with no consultation — pipeline attention. */
  assessmentsWithoutConsultation: number;
  /** Approved-version / reviewDecision conflicts for this clinic. */
  reconciliationDiscrepancies: number;
  kitIntents: number; // active (READY_FOR_FULFILMENT) — an authorization, NOT a paid order
  kitIntentsCancelled: number;
  confirmedOrders: GatedKpi; // KitOrderPayment PAID
  /**
   * Report accounting, with the clinical sign-off and the rendered asset kept
   * separate. Availability of an asset is NEVER inferred from approval — the
   * one-pager snapshot (a storage object) and dossier retrieval are verified in
   * the per-clinic drilldown, where storage is testable.
   */
  reports: {
    /** Approved consultation versions — the clinical sign-off. */
    approved: number;
    /** ReportAsset PATIENT_REPORT_PDF with status READY — a confirmed asset. */
    dossiersReady: number;
  };
  reportsSent: GatedKpi;
  reportsDelivered: GatedKpi;
  /**
   * The most recent activity of ANY kind (patient submission or audited event)
   * — used for the general "last activity" column.
   */
  lastActivityAt: string | null;
  /**
   * The most recent AUTHENTICATED DOCTOR clinical action (an approval, or an
   * audited doctor action — review, note, treatment update). System jobs,
   * background pipelines and Super Admin activity are excluded. Null when no
   * such action is recorded. This, not the patient-submission clock, is what
   * decides recent clinical activity — so a doctor with an older sign-in but
   * recent clinical work still reads as using HairOS.
   */
  lastDoctorActivityAt: string | null;
  primaryStatus: ClinicPrimaryStatus;
  flags: ClinicFlags;
}

export interface OpsOverview {
  window: TimeWindow;
  capabilities: DashboardCapabilities;
  kpis: DashboardKpis;
  clinics: ClinicOpsRow[];
  /** When the server produced this payload (ISO). */
  generatedAt: string;
}
