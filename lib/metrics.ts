// Pure, shared domain logic for the Clinic Usage & Adoption Monitor.
// Used by BOTH the live Supabase path and the read-only snapshot path so the
// definitions of "logged in", "approved", "pending" and "blocked" can never
// drift between them.

export type AdoptionStage = "NEVER_LOGGED_IN" | "LOGGED_IN_NO_REVIEWS" | "USING_HAIROS";

export type FilterKey =
  | "ALL"
  | "NEVER_LOGGED_IN"
  | "LOGGED_IN_NO_REVIEWS"
  | "USING_HAIROS"
  | "PENDING_REVIEWS"
  | "REPORT_ISSUES";

/** Raw per-clinic row — identical shape from Supabase or the JSON snapshot. */
export interface RawClinic {
  slug: string;
  name: string;
  clinicStatus: string;
  doctorName: string | null;
  provisioning: string | null;
  provider: string | null;
  authIdentifier: string | null;
  signedIn: boolean;
  lastSignInAt: string | null;
  submitted: number;
  approved: number;
  pending: number;
  lastReviewAt: string | null;
  kitIntents: number;
  reportReady: number;
  reportQueued: number;
  reportFailed: number;
  waSent: number;
}

export interface RawAssessment {
  clinicSlug: string;
  patient: string;
  age: number | null;
  gender: string | null;
  submitted: string | null;
  procStatus: string | null;
  reviewDecision: string | null;
  reviewedAt: string | null;
  consultApproval: string | null;
  kit: number;
  reportStatuses: string | null;
  waSent: number;
}

export interface Issue {
  level: "blocked" | "warn";
  label: string;
}

export interface ClinicMetric extends RawClinic {
  adoptionStage: AdoptionStage;
  dbActivated: boolean; // provisioned in the platform (database activation)
  doctorAdopted: boolean; // doctor actually logged in AND reviewed (real adoption)
  hasPendingReviews: boolean;
  hasReportIssues: boolean;
  undelivered: number; // report-ready but not delivered to patient
  issues: Issue[];
}

export interface MonitorData {
  meta: {
    source: string;
    extractedAt: string;
    live: boolean;
    targets: Record<string, number>;
  };
  clinics: ClinicMetric[];
  assessments: RawAssessment[];
  totals: Totals;
}

export interface Totals {
  clinics: number;
  dbActivated: number;
  doctorsWithSignIn: number;
  doctorsAdopted: number;
  submitted: number;
  approved: number;
  pending: number;
  reportReady: number;
  reportQueued: number;
  reportFailed: number;
  kitIntents: number;
  waSent: number;
  undelivered: number;
}

/**
 * Derive adoption + workflow signals for one clinic.
 *
 * Guard-rails baked in here (see task requirement 6):
 *  - "approved" means a doctor review decision of APPROVED — NOT that automated
 *    processing reached COMPLETED. The caller only ever passes the APPROVED count.
 *  - "doctor adoption" requires a recorded sign-in AND a real review action
 *    (an approved assessment or a recorded review time). A patient assessment
 *    arriving via QR does NOT by itself count as doctor usage.
 *  - "database activation" is independent: a clinic/doctor can be provisioned
 *    in the DB with zero doctor adoption.
 */
export function deriveClinic(c: RawClinic): ClinicMetric {
  const reviewed = c.approved > 0 || c.lastReviewAt != null;
  const doctorAdopted = c.signedIn && reviewed;

  let adoptionStage: AdoptionStage;
  if (!c.signedIn) adoptionStage = "NEVER_LOGGED_IN";
  else if (!reviewed) adoptionStage = "LOGGED_IN_NO_REVIEWS";
  else adoptionStage = "USING_HAIROS";

  // Report-ready output that has not reached the patient over WhatsApp.
  const undelivered = Math.max(0, c.reportReady - c.waSent);
  const hasReportIssues = c.reportFailed > 0 || c.reportQueued > 0 || undelivered > 0;
  const hasPendingReviews = c.pending > 0;

  const issues: Issue[] = [];
  if (adoptionStage === "NEVER_LOGGED_IN" && c.submitted > 0) {
    issues.push({ level: "blocked", label: `${c.submitted} patient assessment${c.submitted > 1 ? "s" : ""} waiting — doctor has never signed in` });
  }
  if (adoptionStage === "NEVER_LOGGED_IN" && c.submitted === 0) {
    issues.push({ level: "warn", label: `Provisioning: ${labelProvisioning(c.provisioning)} — no sign-in yet` });
  }
  if (adoptionStage === "LOGGED_IN_NO_REVIEWS") {
    issues.push({ level: "blocked", label: `Signed in but 0 reviews — ${c.pending} assessment${c.pending > 1 ? "s" : ""} untouched` });
  }
  if (hasPendingReviews && adoptionStage === "USING_HAIROS") {
    issues.push({ level: "warn", label: `${c.pending} pending doctor review${c.pending > 1 ? "s" : ""}` });
  }
  if (c.reportFailed > 0) {
    issues.push({ level: "blocked", label: `${c.reportFailed} report render${c.reportFailed > 1 ? "s" : ""} failed` });
  }
  if (undelivered > 0) {
    issues.push({ level: "warn", label: `${undelivered} report${undelivered > 1 ? "s" : ""} ready but not delivered on WhatsApp` });
  }
  if (c.reportQueued > 0) {
    issues.push({ level: "warn", label: `${c.reportQueued} report${c.reportQueued > 1 ? "s" : ""} queued (not yet rendered)` });
  }

  return {
    ...c,
    adoptionStage,
    dbActivated: c.clinicStatus === "ACTIVE",
    doctorAdopted,
    hasPendingReviews,
    hasReportIssues,
    undelivered,
    issues,
  };
}

export function labelProvisioning(p: string | null): string {
  switch (p) {
    case "ACTIVE": return "Active";
    case "INVITED": return "Invited";
    case "READY_TO_INVITE": return "Ready to invite";
    case "CONTACT_REQUIRED": return "Contact required";
    default: return p ?? "Unknown";
  }
}

export const STAGE_LABEL: Record<AdoptionStage, string> = {
  NEVER_LOGGED_IN: "Never logged in",
  LOGGED_IN_NO_REVIEWS: "Logged in · no reviews",
  USING_HAIROS: "Using HairOS",
};

export function matchesFilter(c: ClinicMetric, f: FilterKey): boolean {
  switch (f) {
    case "ALL": return true;
    case "NEVER_LOGGED_IN": return c.adoptionStage === "NEVER_LOGGED_IN";
    case "LOGGED_IN_NO_REVIEWS": return c.adoptionStage === "LOGGED_IN_NO_REVIEWS";
    case "USING_HAIROS": return c.adoptionStage === "USING_HAIROS";
    case "PENDING_REVIEWS": return c.hasPendingReviews;
    case "REPORT_ISSUES": return c.hasReportIssues;
  }
}

export function computeTotals(clinics: ClinicMetric[]): Totals {
  const sum = (sel: (c: ClinicMetric) => number) => clinics.reduce((a, c) => a + sel(c), 0);
  return {
    clinics: clinics.length,
    dbActivated: clinics.filter((c) => c.dbActivated).length,
    doctorsWithSignIn: clinics.filter((c) => c.signedIn).length,
    doctorsAdopted: clinics.filter((c) => c.doctorAdopted).length,
    submitted: sum((c) => c.submitted),
    approved: sum((c) => c.approved),
    pending: sum((c) => c.pending),
    reportReady: sum((c) => c.reportReady),
    reportQueued: sum((c) => c.reportQueued),
    reportFailed: sum((c) => c.reportFailed),
    kitIntents: sum((c) => c.kitIntents),
    waSent: sum((c) => c.waSent),
    undelivered: sum((c) => c.undelivered),
  };
}

export const FILTERS: { key: FilterKey; label: string; help: string }[] = [
  { key: "ALL", label: "All clinics", help: "Every provisioned clinic" },
  { key: "NEVER_LOGGED_IN", label: "Never logged in", help: "No recorded sign-in" },
  { key: "LOGGED_IN_NO_REVIEWS", label: "Logged in / no reviews", help: "Signed in but no review activity" },
  { key: "USING_HAIROS", label: "Using HairOS", help: "Signed in and reviewing patients" },
  { key: "PENDING_REVIEWS", label: "Pending reviews", help: "Assessments awaiting a doctor decision" },
  { key: "REPORT_ISSUES", label: "Report issues", help: "Reports queued/failed or not delivered" },
];
