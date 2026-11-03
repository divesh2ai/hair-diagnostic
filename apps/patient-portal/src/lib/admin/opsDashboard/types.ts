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
  pendingReviews: number;
  reportsSent: GatedKpi;
  reportsDelivered: GatedKpi;
}

/** The operational facets a clinic can match — these drive the table filters. */
export interface ClinicFlags {
  neverLoggedIn: boolean;
  noAssessments: boolean;
  pendingReview: boolean;
  reportDeliveryAttention: boolean;
  activelyUsing: boolean;
}

export type ClinicPrimaryStatus =
  | "NEVER_LOGGED_IN"
  | "NO_ASSESSMENTS"
  | "PENDING_REVIEW"
  | "REPORT_DELIVERY_ATTENTION"
  | "ACTIVELY_USING"
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
  awaitingReview: number;
  kitIntents: number; // active (READY_FOR_FULFILMENT) — an authorization, NOT a paid order
  kitIntentsCancelled: number;
  confirmedOrders: GatedKpi; // KitOrderPayment PAID
  reportsAvailable: number; // approved consultation versions
  reportsSent: GatedKpi;
  reportsDelivered: GatedKpi;
  lastActivityAt: string | null;
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
