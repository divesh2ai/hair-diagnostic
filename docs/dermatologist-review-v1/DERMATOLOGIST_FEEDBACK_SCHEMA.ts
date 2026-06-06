/**
 * DERMATOLOGIST_FEEDBACK_SCHEMA.ts
 *
 * Canonical schema for capturing dermatologist feedback on a HairOS
 * blind-review pack. Every reviewer-submitted form MUST conform to
 * ReviewerFeedback. Aggregated consensus output MUST conform to
 * ConsensusReport.
 *
 * No clinical reasoning lives in this schema — it is purely a data
 * carrier for downstream aggregation into CLINICAL_REVIEW_SUMMARY.md
 * and into the release-gate evaluator.
 *
 * Stable contract: bumping any required field is a major version bump.
 */

export const DERMATOLOGIST_FEEDBACK_SCHEMA_VERSION = "1.0.0";

// ── Identifiers ───────────────────────────────────────────────────────────

/** Opaque, anonymized reviewer id. Real PII is held outside this schema. */
export type ReviewerId = string;

/** Stable case id from the blind-review pack (NOT the corpus caseId). */
export type ReviewCaseId = string;

/** Pack version this feedback was authored against. */
export type ReviewPackVersion = string; // e.g. "1.0.0"

// ── Quantitative scoring ──────────────────────────────────────────────────

/** Likert 1–5 (1=unacceptable, 5=excellent). Integer only. */
export type LikertScore = 1 | 2 | 3 | 4 | 5;

export interface CaseScores {
  diagnosticAccuracy: LikertScore;
  rootCauseAccuracy: LikertScore;
  recommendationQuality: LikertScore;
  monitoringQuality: LikertScore;
  patientExplainability: LikertScore;
  clinicalSafety: LikertScore;
  clinicalCompleteness: LikertScore;
  trustworthiness: LikertScore;
}

export type SignDecision = "YES" | "YES_WITH_MINOR_EDITS" | "NO";

// ── Qualitative findings ──────────────────────────────────────────────────

export type FindingCategory =
  | "DIAGNOSIS_ERROR"
  | "ROOTCAUSE_ERROR"
  | "PROTOCOL_ERROR"
  | "MONITORING_ERROR"
  | "NARRATIVE_ERROR"
  | "SAFETY_CONCERN"
  | "MISSING_INFORMATION";

export type FindingSeverity = "minor" | "moderate" | "major" | "critical";

export interface ReviewerFinding {
  /** Stable id within this feedback envelope (caseId + ordinal). */
  findingId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  /** Free-text comment from the reviewer. PHI-free by reviewer attestation. */
  comment: string;
  /**
   * Optional structured fix proposed by the reviewer. Stored verbatim;
   * no programmatic interpretation.
   */
  proposedFix?: string;
}

// ── Per-case feedback envelope ────────────────────────────────────────────

export interface CaseFeedback {
  caseId: ReviewCaseId;
  scores: CaseScores;
  signDecision: SignDecision;
  findings: ReviewerFinding[];
  /** Free-text overall comment for the case. */
  overallComment?: string;
}

// ── Reviewer envelope (one per reviewer per pack) ─────────────────────────

export interface ReviewerFeedback {
  schemaVersion: typeof DERMATOLOGIST_FEEDBACK_SCHEMA_VERSION;
  reviewPackVersion: ReviewPackVersion;
  reviewerId: ReviewerId;
  /** ISO-8601 submission timestamp. */
  submittedAt: string;
  /** Reviewer self-attestation — see CLINICAL_ACCEPTANCE_GATE_SPEC.md. */
  attestation: {
    isLicensedDermatologist: boolean;
    yearsInPractice: number;
    completedBlindReview: boolean;
  };
  cases: CaseFeedback[];
  /** Optional pack-level comment. */
  packComment?: string;
}

// ── Aggregated consensus output ───────────────────────────────────────────

export interface ConsensusAverages {
  diagnosticAccuracy: number;       // mean over all (reviewer × case)
  rootCauseAccuracy: number;
  recommendationQuality: number;
  monitoringQuality: number;
  patientExplainability: number;
  clinicalSafety: number;
  clinicalCompleteness: number;
  trustworthiness: number;
}

export interface FailureTheme {
  /** Aggregated category : ordinal cluster label. */
  themeKey: string;
  category: FindingCategory;
  count: number;
  /** Number of cases this theme appears in. */
  caseCoverage: number;
  /** Representative reviewer comments (deduped, ≤ 5). */
  examples: string[];
}

export interface SafetyConcernCluster {
  themeKey: string;
  severity: FindingSeverity;
  count: number;
  caseIds: ReviewCaseId[];
  examples: string[];
}

export interface RequestedChange {
  themeKey: string;
  category: FindingCategory;
  count: number;
  examples: string[];
}

export interface ConsensusReport {
  schemaVersion: typeof DERMATOLOGIST_FEEDBACK_SCHEMA_VERSION;
  reviewPackVersion: ReviewPackVersion;
  reviewerCount: number;
  caseCount: number;
  computedAt: string;
  averages: ConsensusAverages;
  willingToSignPercent: number;
  topFailureThemes: FailureTheme[];          // ≤ 10
  topSafetyConcerns: SafetyConcernCluster[]; // critical/major severity
  mostRequestedChanges: RequestedChange[];   // ≤ 10
  /** Per-case sign-rate and mean trust score. */
  caseBreakdown: Array<{
    caseId: ReviewCaseId;
    meanTrust: number;
    meanRecommendation: number;
    signYesRate: number;
    findingsCount: number;
  }>;
}

// ── Type guards ───────────────────────────────────────────────────────────

export const isLikertScore = (n: unknown): n is LikertScore =>
  typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;

export const isSignDecision = (s: unknown): s is SignDecision =>
  s === "YES" || s === "YES_WITH_MINOR_EDITS" || s === "NO";

export const isFindingCategory = (s: unknown): s is FindingCategory =>
  s === "DIAGNOSIS_ERROR" ||
  s === "ROOTCAUSE_ERROR" ||
  s === "PROTOCOL_ERROR" ||
  s === "MONITORING_ERROR" ||
  s === "NARRATIVE_ERROR" ||
  s === "SAFETY_CONCERN" ||
  s === "MISSING_INFORMATION";
