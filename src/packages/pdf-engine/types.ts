import { NormalizedClinicalProfile } from '../questionnaire-normalizer/types';
import { VisualJourney } from '../visual-recommendation-engine/types';
import { KitRecommendation } from '../ai-engine/kit-scorer/types';
import type { ClinicalReport } from '../ai-engine/report-engine/types';
import type { GroundingViolation } from '../ai-engine/clinical-facts';
import type { ReasoningGap } from '../ai-engine/clinical-context';

export interface PatientInfo {
  name: string;
  age: number;
  gender: string;
}

export interface ClinicInfo {
  name: string;
  logoUrl?: string;
}

export interface DoctorInfo {
  name: string;
}

export interface ReportInputPayload {
  assessmentId: string;
  patient: PatientInfo;
  clinic: ClinicInfo;
  doctor: DoctorInfo;
  clinicalProfile: NormalizedClinicalProfile;
  /**
   * Visual journey is deferred (Phase 2 feature). Active pipeline passes
   * `null`; the dossier path in PatientReportTemplate renders without it.
   */
  visualJourney?: VisualJourney | null;
  kitRecommendation?: KitRecommendation | null;
  therapyPlan?: unknown;
  clinicalReport?: ClinicalReport | null;
  createdAt: Date;
  /**
   * Evidence-grounding violations from the narrative-assembly stage.
   * When non-empty, the PDF engine refuses to render and throws a typed
   * `EvidenceGroundingError` carrying the violations. Caller must either
   * fix the underlying narrative or explicitly bypass with
   * `bypassGroundingViolations: true` (audit only — never use in production).
   * Implements Rule 10 — fail validation rather than ship a report that
   * mentions findings the patient never reported.
   */
  groundingViolations?: readonly GroundingViolation[];
  /** Explicit override flag. Should only be set by internal QA / replay tools. */
  bypassGroundingViolations?: boolean;

  /**
   * Reasoning-completeness gaps from validateReasoningCompleteness.
   * Non-empty values block rendering for the same reason as
   * groundingViolations — a report that doesn't explain its own
   * recommendations is not safe to ship. Same bypass semantics.
   */
  reasoningGaps?: readonly ReasoningGap[];
  bypassReasoningGaps?: boolean;
}
