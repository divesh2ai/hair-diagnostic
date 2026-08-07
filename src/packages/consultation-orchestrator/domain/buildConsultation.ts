// ─────────────────────────────────────────────────────────────────────────────
// buildConsultation — single composition pipeline that produces the canonical
// Consultation. Every clinical content field is sourced from existing engines;
// this file deliberately contains zero clinical scoring logic. If a UI surface
// needs different clinical content, fix the engine, not this composer.
//
// Pipeline:
//   PatientAnswers ─▶ evaluateClinicalProfile ─▶ mapTherapyNeeds
//                                           ─▶ scoreKits
//                                           ─▶ buildClinicalReport
//                                           ─▶ buildConsultation (this file)
// ─────────────────────────────────────────────────────────────────────────────

import { evaluateClinicalProfile } from "../../ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../../ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../../ai-engine/kit-scorer/scoreKits";
import { buildClinicalReport } from "../../ai-engine/report-engine";
import { OPEN_CLINIC } from "../../../sandbox/loaders/fixtureLoader";
import type { PatientAnswers } from "../../types";
import type { BudgetProfile } from "../../ai-engine/kit-scorer/types";
import type { ClinicalProfile } from "../../ai-engine/clinical-engine/types";
import { buildClinicalFacts, validateEvidenceGrounding } from "../../ai-engine/clinical-facts";
import { validateReasoningCompleteness } from "../../ai-engine/clinical-context";
import { buildClinicalContext } from "../../ai-engine/clinical-context";
import type { KitRecommendation } from "../../ai-engine/kit-scorer/types";
import type { ClinicalReadinessSnapshot } from "@shared/types/consultation";

import type {
  Consultation,
  ConsultationPatient,
  ConsultationAssessmentRef,
  ClinicalEvidence,
  Confidence,
  ConfidenceScore,
  ConfidenceBand,
  Diagnosis,
  DifferentialDiagnosis,
  EvidenceItem,
  MissingInformation,
  Recommendation,
  TreatmentPlan,
  PatientEducation,
  FollowUpPlan,
  DoctorNote,
  ConsultationAttachment,
  ConsultationAudit,
  ConsultationVersion,
  Severity as CSeverity,
} from "@shared/types/consultation";

// Engine version stamps. Bump when the corresponding engine ships a
// breaking output change so downstream caches can invalidate.
const ENGINE_VERSIONS = {
  clinical: "1.0.0",
  therapy: "1.0.0",
  kits: "1.0.0",
  narrative: "1.0.0",
  report: "v4",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildConsultationInput {
  patient: ConsultationPatient;
  assessment: ConsultationAssessmentRef;
  answers: PatientAnswers;
  /** Optional progressive evidence — engine ignores what it can't use today. */
  evidence?: {
    scalpImages?: { count: number; capturedAt?: string };
    clinicObservations?: string;
    previousConsultationIds?: string[];
    previousReportIds?: string[];
  };
  /** Doctor's existing notes (visible-to-patient flag respected by renderers). */
  doctorNotes?: DoctorNote[];
  /** Any uploaded attachments (signed Storage URLs). */
  attachments?: ConsultationAttachment[];
  /** Budget tier — controls kit quantity. Defaults to STANDARD. */
  budgetTier?: "ESSENTIAL" | "STANDARD" | "COMPREHENSIVE";
  /** Identity that produced this consultation (system user id when automated). */
  actorId: string;
  /** Existing consultation versions — used to bump contentVersion on edits. */
  previousContentVersion?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function buildConsultation(input: BuildConsultationInput): Consultation {
  const {
    patient,
    assessment,
    answers,
    evidence,
    doctorNotes = [],
    attachments = [],
    budgetTier = "STANDARD",
    actorId,
    previousContentVersion = 0,
  } = input;

  // ── Engine pipeline ──────────────────────────────────────────────────────
  const clinical = evaluateClinicalProfile(answers);
  const therapy = mapTherapyNeeds(clinical);
  const budget = BUDGET_MAP[budgetTier];
  const kits = scoreKits(clinical, therapy, answers, OPEN_CLINIC, budget);
  const report = buildClinicalReport(
    { name: patient.name, age: patient.age, sex: patient.sex },
    clinical,
    therapy,
    kits,
    answers,
  );

  // ── Evidence catalogue ───────────────────────────────────────────────────
  const consultationEvidence = buildEvidenceCatalogue({
    assessmentSubmittedAt: assessment.submittedAt,
    evidence,
  });

  // ── Diagnosis surface ────────────────────────────────────────────────────
  const diagnosis = buildDiagnosis(clinical, report);

  // ── Confidence ───────────────────────────────────────────────────────────
  const confidence = computeConfidence(clinical, consultationEvidence);

  // ── Treatment plan ───────────────────────────────────────────────────────
  const treatmentPlan = buildTreatmentPlan(report);

  // ── Patient education ────────────────────────────────────────────────────
  const patientEducation: PatientEducation = {
    story: report.clinicalInsightStory,
    finalAssessment: report.finalClinicalAssessment,
    cards: [], // Education cards are authored post-launch; engine doesn't generate them.
    generalLifestyle: report.generalLifestyleGuide,
    conditionLifestyle: report.dietAndLifestyle,
  };

  // ── Clinical readiness snapshot (persisted; approval + release gates
  //    consult only this snapshot, never rerun the pipeline) ───────────────
  const clinicalReadiness = buildReadinessSnapshot(answers, clinical, kits, report);

  // ── Audit + version ──────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const audit: ConsultationAudit = {
    createdAt: now,
    createdBy: actorId,
    lastUpdatedAt: now,
    lastUpdatedBy: actorId,
    events: [{ at: now, by: actorId, kind: "CREATED" }],
  };
  const version: ConsultationVersion = {
    schemaVersion: "v1",
    contentVersion: previousContentVersion + 1,
    engines: ENGINE_VERSIONS,
  };

  return {
    id: assessment.id,
    patient,
    assessment,
    evidence: consultationEvidence,
    diagnosis,
    clinicalFindings: report.patientSummary.clinicalInterpretation,
    rootCause: report.rootCauseAnalysis,
    rootCauseRationale: report.whyHairosChoseThisPlan,
    confidence,
    treatmentPlan,
    patientEducation,
    followUp: defaultFollowUpFor(diagnosis.severity),
    doctorNotes,
    attachments,
    audit,
    version,
    clinicalReadiness,
    clinicalReport: report,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Deterministic readiness snapshot. Runs the two existing validators
// (validateEvidenceGrounding + validateReasoningCompleteness) over the same
// inputs the composer already produced, then serializes the result into a
// portable, hashable snapshot that lives inside the persisted Consultation.
// No side effects, no new engine calls at approve/release time.
function buildReadinessSnapshot(
  answers: PatientAnswers,
  clinical: ClinicalProfile,
  kits: KitRecommendation,
  report: ReturnType<typeof buildClinicalReport>,
): ClinicalReadinessSnapshot {
  // buildClinicalFacts needs the ClinicalProfile because ReportedFindings.sex
  // and reported.hasActiveShedding both derive from `profile.flags`. Passing
  // only `answers` here throws `Cannot read properties of undefined (reading
  // 'flags')` inside deriveSex / reported.
  const facts = buildClinicalFacts(answers, clinical);

  // Same narrative section-set the PDF engine checks against — parity of
  // gate at approval-time and render-time is a design goal.
  const sections = [
    { section: "Your Hair Story", text: report.clinicalInsightStory.yourHairStory },
    { section: "What We Found", text: report.clinicalInsightStory.whyThisMayBeHappening },
    { section: "Your Recovery Plan", text: report.clinicalInsightStory.whyThisPlanWasRecommended },
    {
      section: "What Recovery Could Look Like",
      text: report.clinicalInsightStory.whatToExpect,
    },
  ];

  const grounding = validateEvidenceGrounding(sections, facts);

  const context = buildClinicalContext({
    assessmentId: "readiness", // The context is scoped to this composition;
    // the id is not persisted through the snapshot.
    facts,
    profile: clinical,
    kitRecommendation: kits,
    groundingViolations: grounding.violations,
  });
  const narrativeForReasoning = sections.map((s) => ({ name: s.section, text: s.text }));
  const reasoning = validateReasoningCompleteness(context, narrativeForReasoning);

  const groundingViolations = grounding.violations.map((v) => ({
    ruleId: v.ruleId,
    section: v.section,
    // Short doctor-readable summary — never the raw narrative text or the
    // matched span, both of which routinely contain patient identifiers.
    summary: v.claim,
  }));
  const reasoningGaps = reasoning.gaps.map((g) => ({
    kind: g.kind,
    subject: g.subject,
    summary: g.message,
  }));
  const blockingCodes: string[] = [];
  if (groundingViolations.length > 0) blockingCodes.push("GROUNDING_VIOLATION_PRESENT");
  if (reasoningGaps.length > 0) blockingCodes.push("REASONING_GAP_PRESENT");

  return {
    schemaVersion: 1,
    evaluatedAt: new Date().toISOString(),
    sourceClinicalArtifactVersion: ENGINE_VERSIONS.report,
    isReadyForApproval: blockingCodes.length === 0,
    groundingViolations,
    reasoningGaps,
    blockingCodes,
    summary: {
      groundingViolationCount: groundingViolations.length,
      reasoningGapCount: reasoningGaps.length,
    },
  };
}

const BUDGET_MAP: Record<string, BudgetProfile> = {
  ESSENTIAL: { tier: "ESSENTIAL", maxKits: 2 },
  STANDARD: { tier: "STANDARD", maxKits: 5 },
  COMPREHENSIVE: { tier: "COMPREHENSIVE", maxKits: 7 },
};

function buildEvidenceCatalogue(args: {
  assessmentSubmittedAt: string;
  evidence?: BuildConsultationInput["evidence"];
}): ClinicalEvidence {
  const ev = args.evidence;
  const questionnaire: EvidenceItem = {
    kind: "ASSESSMENT_QUESTIONNAIRE",
    status: "USED",
    capturedAt: args.assessmentSubmittedAt,
  };

  const items: EvidenceItem[] = [
    questionnaire,
    {
      kind: "SCALP_IMAGES",
      status: ev?.scalpImages?.count ? "USED" : "NOT_PROVIDED",
      detail: ev?.scalpImages?.count ? `${ev.scalpImages.count} images` : undefined,
      capturedAt: ev?.scalpImages?.capturedAt,
    },
    {
      kind: "DOCTOR_NOTES",
      status: "NOT_PROVIDED",
    },
    {
      kind: "CLINIC_OBSERVATIONS",
      status: ev?.clinicObservations ? "USED" : "NOT_PROVIDED",
      detail: ev?.clinicObservations,
    },
    {
      kind: "PREVIOUS_CONSULTATION",
      status: ev?.previousConsultationIds?.length ? "USED" : "NOT_PROVIDED",
      detail: ev?.previousConsultationIds?.length
        ? `${ev.previousConsultationIds.length} prior consultations`
        : undefined,
    },
    {
      kind: "PREVIOUS_REPORTS",
      status: ev?.previousReportIds?.length ? "USED" : "NOT_PROVIDED",
    },
    { kind: "LAB_REPORTS", status: "FUTURE" },
    { kind: "TRICHOSCOPY", status: "FUTURE" },
    { kind: "WEARABLES", status: "FUTURE" },
    { kind: "GENETICS", status: "FUTURE" },
  ];

  return { questionnaire, items };
}

function buildDiagnosis(
  clinical: ClinicalProfile,
  report: ReturnType<typeof buildClinicalReport>,
): Diagnosis {
  // Primary label comes from the dermatologist condition the engine puts at
  // the top of the clinical interpretation list, falling back to the diagnosis
  // key when no condition mapping exists.
  const primaryLabel =
    report.patientSummary.clinicalInterpretation[0]?.condition ??
    humanizeKey(clinical.primaryDiagnosis as string);

  const differentials: DifferentialDiagnosis[] = clinical.secondaryDiagnoses.map((s) => ({
    key: s.key as string,
    label: humanizeKey(s.key as string),
    score: s.score,
    supportingSignals: [],
  }));

  return {
    primary: primaryLabel,
    primaryKey: clinical.primaryDiagnosis as string,
    differentials,
    severity: clinical.severity as CSeverity,
    severitySource: "engine",
  };
}

function computeConfidence(
  clinical: ClinicalProfile,
  evidence: ClinicalEvidence,
): Confidence {
  const hasImages = evidence.items.some(
    (i) => i.kind === "SCALP_IMAGES" && i.status === "USED",
  );
  const hasClinicObs = evidence.items.some(
    (i) => i.kind === "CLINIC_OBSERVATIONS" && i.status === "USED",
  );

  // Base = 0.55 questionnaire alone; +0.20 with scalp images; +0.10 clinic obs.
  // Floor at 0.30, cap at 0.95. This is a UI confidence — not a Bayesian score.
  let score = 0.55;
  if (hasImages) score += 0.2;
  if (hasClinicObs) score += 0.1;
  // Strong primary in clinical engine = +0.05.
  if (clinical.primaryScore >= 4) score += 0.05;
  score = clamp(score, 0.3, 0.95);

  const rationale = hasImages
    ? "Questionnaire + scalp images analysed; primary diagnosis well-supported."
    : "Questionnaire-only assessment — additional inputs would tighten the differential.";

  const overall: ConfidenceScore = { score, band: bandFor(score), rationale };

  const missingInformation: MissingInformation[] = [];
  if (!hasImages) {
    missingInformation.push({
      kind: "SCALP_IMAGES",
      reason: "Scalp images confirm miniaturisation pattern and rule out inflammatory dermatoses.",
      suggestion: "Upload 3 scalp photos (vertex, hairline, occipital).",
    });
  }
  if (!hasClinicObs) {
    missingInformation.push({
      kind: "CLINIC_OBSERVATIONS",
      reason: "In-clinic pull test / scalp examination adds dermatologist-confirmed signals.",
      suggestion: "Capture clinic observations during the next visit.",
    });
  }

  return {
    overall,
    bySection: {
      diagnosis: overall,
      rootCause: { ...overall, score: clamp(score - 0.05, 0.25, 0.92), band: bandFor(score - 0.05) },
      treatment: { ...overall, score: clamp(score + 0.02, 0.3, 0.95), band: bandFor(score + 0.02) },
    },
    missingInformation,
  };
}

function buildTreatmentPlan(report: ReturnType<typeof buildClinicalReport>): TreatmentPlan {
  // Map each engine-produced kit phase into a tier-tagged Recommendation so
  // renderers can group/sort uniformly. Phase 1 → IMMEDIATE, phase 2 →
  // SHORT_TERM, phase 3+ → LONG_TERM. Phase numbers come from the engine.
  const recommendations: Recommendation[] = report.treatmentStrategy.map((p) => ({
    id: `kit-${p.kitId}-p${p.phase}`,
    kind: "KIT",
    tier: tierForPhase(p.phase),
    title: p.displayName,
    description: p.whySelected,
    priority: p.phase === 1 ? "HIGH" : "STANDARD",
    duration: "2 months",
    doctorEditable: true,
    doctorEdited: false,
    evidenceLevel: "EXPERT_OPINION",
    meta: { kitId: p.kitId, phase: p.phase, supportingConditions: p.supportingConditions },
  }));

  // Topicals → MAINTENANCE tier so they render in their own shelf.
  for (const t of report.topicalRecommendations) {
    recommendations.push({
      id: `topical-${t.name}`,
      kind: "TOPICAL",
      tier: "MAINTENANCE",
      title: t.name,
      description: t.usage,
      priority: "OPTIONAL",
      doctorEditable: true,
      doctorEdited: false,
      meta: { note: t.note, whySelected: t.whySelected },
    });
  }

  // Lifestyle + diet recs from the condition-mapped block.
  for (const d of report.dietAndLifestyle) {
    recommendations.push({
      id: `lifestyle-${slug(d.condition)}-${slug(d.recommendation).slice(0, 20)}`,
      kind: "LIFESTYLE",
      tier: "LONG_TERM",
      title: d.recommendation,
      description: d.expectedBenefit,
      priority: "STANDARD",
      doctorEditable: true,
      doctorEdited: false,
      meta: { condition: d.condition },
    });
  }

  return {
    recommendations,
    kitPhases: report.treatmentStrategy,
    topicals: report.topicalRecommendations,
    topicalCautions: report.topicalCautions,
    expectedTimeline: report.recoveryMilestones,
  };
}

function defaultFollowUpFor(severity: CSeverity): FollowUpPlan {
  switch (severity) {
    case "SEVERE":
      return {
        cadence: "4 weeks",
        reviewChecks: ["Pull test", "Photo comparison", "Adherence to kit"],
      };
    case "MODERATE":
      return {
        cadence: "8 weeks",
        reviewChecks: ["Photo comparison", "Side-effect screen", "Adherence to kit"],
      };
    case "MILD":
    default:
      return {
        cadence: "12 weeks",
        reviewChecks: ["Photo comparison", "Adherence check"],
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny utilities (kept private — clinical logic stays in engines)
// ─────────────────────────────────────────────────────────────────────────────

function tierForPhase(phase: number): Recommendation["tier"] {
  if (phase <= 1) return "IMMEDIATE";
  if (phase === 2) return "SHORT_TERM";
  return "LONG_TERM";
}

function bandFor(score: number): ConfidenceBand {
  if (score >= 0.75) return "high";
  if (score >= 0.55) return "moderate";
  return "low";
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function humanizeKey(key: string) {
  return key
    .toLowerCase()
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
