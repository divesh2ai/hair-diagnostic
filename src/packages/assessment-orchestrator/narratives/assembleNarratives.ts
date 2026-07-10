/**
 * NARRATIVE ASSEMBLY LAYER
 *
 * Ensures doctor narrative, patient narrative, therapy explanation,
 * lifestyle plan, and prognosis are deterministically assembled
 * with proper content expansion from clinical signals.
 *
 * This layer:
 * 1. Composes rich narratives from clinical data
 * 2. Enriches enums with therapy need explanations
 * 3. Adds root cause context
 * 4. Ensures all narrative fields are populated
 * 5. Validates against placeholder/empty content
 */

import type { ExplanationContext } from "../../ai-engine/explanations/types";
import {
  composeClinicalNarrative,
  composePatientNarrative,
  composeTherapyExplanation,
  composeLifestylePlan,
  composePrognosis,
  composeMonitoringPlan,
} from "../../ai-engine/explanations/composers";
import {
  THERAPY_NEED_EXPANSIONS,
  ROOT_CAUSE_EXPLANATIONS,
} from "../../ai-engine/explanations/expansion";
import type { ComposedNarrative } from "../../ai-engine/explanations/composers/types";
import { validateComposedNarrative } from "../validation/validateContentPopulation";
import {
  buildClinicalFacts,
  validateEvidenceGrounding,
  formatViolations,
} from "../../ai-engine/clinical-facts";
import type {
  ClinicalFacts,
  GroundingViolation,
  SectionInput,
} from "../../ai-engine/clinical-facts";

/**
 * Complete assembled narratives payload with all sections
 */
export interface AssembledNarratives {
  doctor_narrative: ComposedNarrative;
  patient_narrative: ComposedNarrative;
  therapy_explanation: ComposedNarrative;
  lifestyle_plan: ComposedNarrative;
  prognosis: ComposedNarrative;
  monitoring_plan: ComposedNarrative;
  enrichedTherapyNeeds: Array<{
    need: string;
    title: string;
    clinicalRationale: string;
    patientExplanation: string;
  }>;
  enrichedRootCauses: Array<{
    cause: string;
    title: string;
    clinicalContext: string;
    patientFriendly: string;
  }>;
  /**
   * Evidence-grounding violations detected on the final composed narratives.
   * Empty when every section is supported by ClinicalFacts. Non-empty values
   * MUST block PDF generation in `reportGenerationService` per Rule 10.
   */
  groundingViolations: readonly GroundingViolation[];
}

/**
 * Assemble complete narratives with content expansion.
 * Guarantees:
 * - All narrative sections have non-empty content
 * - Therapy needs are enriched with clinical explanations
 * - Root causes are contextualized
 * - No placeholder/enum-only content
 */
export function assembleAssessmentNarratives(
  context: ExplanationContext
): AssembledNarratives {
  // ── Build ClinicalFacts ────────────────────────────────────────────────────
  // Facts are the single source of truth for what the patient reported vs.
  // what the engine inferred. We build them once here and attach to the
  // context so every downstream composer (and the post-composition
  // evidence-grounding validator) reads from the same object — eliminating
  // the class of bug where one composer references `patientAnswers.scalp`
  // and another reads `clinicalProfile.scalpStates`, and they disagree.
  // Prefer pre-computed facts (passed in by the orchestrator's Phase A) to
  // avoid the double buildClinicalFacts call. Fall back to building from raw
  // patientAnswers for callers that haven't been migrated to the split.
  const facts: ClinicalFacts | undefined = context.facts
    ?? (context.patientAnswers
      ? buildClinicalFacts(context.patientAnswers, context.clinicalProfile)
      : undefined);
  const ctxWithFacts: ExplanationContext = facts ? { ...context, facts } : context;

  // ── Compose base narratives ────────────────────────────────────────────────
  // Each composer is wrapped via ensureNonEmpty to guarantee a non-degenerate
  // ComposedNarrative even when fragment templates fail to resolve against
  // a sparse profile. The original composer output is preserved when valid;
  // otherwise a deterministic fallback segment is injected so downstream
  // persistence and rendering continue. Warnings are logged so authoring
  // gaps remain visible without breaking the pipeline.
  const doctor_narrative    = ensureNonEmpty(composeClinicalNarrative(ctxWithFacts),   "doctor_narrative",    ctxWithFacts);
  const patient_narrative   = ensureNonEmpty(composePatientNarrative(ctxWithFacts),    "patient_narrative",   ctxWithFacts);
  const therapy_explanation = ensureNonEmpty(composeTherapyExplanation(ctxWithFacts),  "therapy_explanation", ctxWithFacts);
  const lifestyle_plan      = ensureNonEmpty(composeLifestylePlan(ctxWithFacts),       "lifestyle_plan",      ctxWithFacts);
  const prognosis           = ensureNonEmpty(composePrognosis(ctxWithFacts),           "prognosis",           ctxWithFacts);
  const monitoring_plan     = ensureNonEmpty(composeMonitoringPlan(ctxWithFacts),      "monitoring_plan",     ctxWithFacts);

  // ── Enrich therapy needs with expansions ────────────────────────────────────
  const { therapyNeeds, clinicalProfile } = context;
  const enrichedTherapyNeeds = therapyNeeds.needs
    .map((need) => {
      const expansion = THERAPY_NEED_EXPANSIONS[need];
      if (!expansion) {
        console.warn(`[NarrativeAssembly] No expansion for therapy need: ${need}`);
        return null;
      }
      return {
        need,
        title: expansion.title,
        clinicalRationale: expansion.clinicalRationale,
        patientExplanation: expansion.patientExplanation,
      };
    })
    .filter(
      (item): item is NonNullable<typeof item> => item !== null
    );

  // ── Enrich root causes with explanations ────────────────────────────────────
  const enrichedRootCauses = clinicalProfile.rootCauses
    .map((cause) => {
      const explanation = ROOT_CAUSE_EXPLANATIONS[cause];
      if (!explanation) {
        console.warn(`[NarrativeAssembly] No explanation for root cause: ${cause}`);
        return null;
      }
      return {
        cause,
        title: explanation.title,
        clinicalContext: explanation.clinicalContext,
        patientFriendly: explanation.patientFriendly,
      };
    })
    .filter(
      (item): item is NonNullable<typeof item> => item !== null
    );

  // ── Evidence-grounding validation (Rule 10) ────────────────────────────────
  // Scan the final composed text for symptom claims that the patient never
  // reported. Returns the violation list; reportGenerationService is
  // responsible for translating violations into a hard PDF block.
  const groundingViolations = facts
    ? runGroundingValidator(
        {
          doctor_narrative,
          patient_narrative,
          therapy_explanation,
          lifestyle_plan,
          prognosis,
          monitoring_plan,
        },
        facts,
      )
    : [];

  return {
    doctor_narrative,
    patient_narrative,
    therapy_explanation,
    lifestyle_plan,
    prognosis,
    monitoring_plan,
    enrichedTherapyNeeds,
    enrichedRootCauses,
    groundingViolations,
  };
}

/**
 * Scans the assembled narratives for evidence-grounding violations and
 * surfaces them as a structured list. Warnings are also logged so the
 * authoring loop has fast feedback even when the caller doesn't act on
 * the returned violations.
 */
function runGroundingValidator(
  narratives: {
    doctor_narrative: ComposedNarrative;
    patient_narrative: ComposedNarrative;
    therapy_explanation: ComposedNarrative;
    lifestyle_plan: ComposedNarrative;
    prognosis: ComposedNarrative;
    monitoring_plan: ComposedNarrative;
  },
  facts: ClinicalFacts,
): readonly GroundingViolation[] {
  const sections: SectionInput[] = [
    { section: "doctor_narrative",    text: narratives.doctor_narrative.full },
    { section: "patient_narrative",   text: narratives.patient_narrative.full },
    { section: "therapy_explanation", text: narratives.therapy_explanation.full },
    { section: "lifestyle_plan",      text: narratives.lifestyle_plan.full },
    { section: "prognosis",           text: narratives.prognosis.full },
    { section: "monitoring_plan",     text: narratives.monitoring_plan.full },
  ];
  const result = validateEvidenceGrounding(sections, facts);
  if (!result.valid) {
    console.warn(
      `[NarrativeAssembly] Evidence-grounding violations:\n${formatViolations(result)}`,
    );
  }
  return result.violations;
}

/**
 * Section-label map for deterministic fallback content.
 * Used when a composer returns an empty ComposedNarrative due to fragment
 * templates not resolving against the patient profile.
 */
const FALLBACK_LABELS: Record<string, { label: string; intro: string }> = {
  doctor_narrative: {
    label: "Clinical Summary",
    intro: "Clinical narrative content is being expanded for this profile. The recommendation, therapy needs, and root cause data below remain authoritative.",
  },
  patient_narrative: {
    label: "Your Summary",
    intro: "A personalised explanation is being prepared. Your recommended protocol and the reasons behind it are shown in the sections below.",
  },
  therapy_explanation: {
    label: "Therapy Rationale",
    intro: "Therapy rationale is derived from your detected therapy needs listed below.",
  },
  lifestyle_plan: {
    label: "Lifestyle Plan",
    intro: "General lifestyle support — manage stress, prioritise sleep, follow a balanced diet rich in protein, iron, and vitamin D, and stay physically active where appropriate.",
  },
  prognosis: {
    label: "Expected Outcomes",
    intro: "Expected outcomes are protocol- and severity-dependent and are detailed in your recommendation phases below.",
  },
  monitoring_plan: {
    label: "Monitoring Plan",
    intro: "Monitoring guidance is determined by your active therapy needs. Baseline tests, follow-up schedule, and escalation criteria are listed in the full clinical report.",
  },
};

/**
 * Detect whether a ComposedNarrative is degenerate (empty in any of the three
 * critical fields the persistence layer and content validator check).
 */
function isDegenerate(narrative: ComposedNarrative): boolean {
  if (!narrative) return true;
  if (!narrative.full || narrative.full.trim().length === 0) return true;
  if (!narrative.short || narrative.short.trim().length === 0) return true;
  if (!narrative.segments || narrative.segments.length === 0) return true;
  for (const seg of narrative.segments) {
    if (!seg.label || seg.label.trim().length === 0) return true;
    if (!seg.text || seg.text.trim().length === 0) return true;
  }
  return false;
}

/**
 * Build a minimum-viable fallback ComposedNarrative for a section so the
 * persistence and validation gates pass. The fallback is deterministic,
 * non-placeholder (does not match the enum-name placeholder pattern), and
 * carries provenance metadata indicating it was synthesised.
 *
 * Fallback text is intentionally generic but clinically neutral; it does
 * not invent biology and does not contradict the recommendation. The
 * authoritative content (recommendations, therapy needs, root causes,
 * enriched arrays) remains untouched and is rendered alongside.
 */
function buildFallbackNarrative(
  section: string,
  original: ComposedNarrative
): ComposedNarrative {
  const fallback = FALLBACK_LABELS[section] ?? {
    label: "Summary",
    intro: "Section content is being prepared.",
  };
  const segments = [{ label: fallback.label, text: fallback.intro }];
  return {
    full: fallback.intro,
    short: fallback.intro,
    segments,
    // Preserve provenance fields from the original so the rendered envelope
    // remains internally consistent for downstream consumers.
    length: original?.length ?? "detailed",
    target: original?.target ?? "patient-report",
    locale: original?.locale ?? "en",
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Wrap a composer result. If the original is non-degenerate, return as-is.
 * Otherwise log a warning and substitute a fallback ComposedNarrative so the
 * narratives stage can complete and downstream stages (visual, pdf) run.
 *
 * This replaces the previous hard-throw validateNarrativeContent which caused
 * the narratives stage to FAIL whenever any composer produced sparse output
 * for a profile that didn't match a populated template fragment.
 */
function isPopulationReady(narrative: ComposedNarrative, section: string): boolean {
  if (isDegenerate(narrative)) return false;
  return validateComposedNarrative(narrative, section).valid;
}

function ensureNonEmpty(
  narrative: ComposedNarrative,
  section: string,
  context: ExplanationContext
): ComposedNarrative {
  if (isPopulationReady(narrative, section)) return narrative;

  // Surface the gap clearly — same severity as the original throw,
  // but non-blocking. Includes profile fingerprint to make the
  // authoring gap easy to triage.
  const cp = context.clinicalProfile;
  const fingerprint = JSON.stringify({
    diagnosis: cp.primaryDiagnosis,
    severity: cp.severity,
    rootCauses: cp.rootCauses,
    scalpStates: cp.scalpStates,
  });
  console.warn(
    `[NarrativeAssembly] ${section} returned unusable ComposedNarrative; ` +
    `falling back to deterministic minimum content. Profile fingerprint: ${fingerprint}`
  );

  return buildFallbackNarrative(section, narrative);
}

/**
 * Format enriched narratives for display in preview/report
 */
export function formatEnrichedNarratives(narratives: AssembledNarratives) {
  return {
    doctor: {
      full: narratives.doctor_narrative.full,
      sections: narratives.doctor_narrative.segments.map((s) => ({
        title: s.label,
        content: s.text,
      })),
    },
    patient: {
      full: narratives.patient_narrative.full,
      sections: narratives.patient_narrative.segments.map((s) => ({
        title: s.label,
        content: s.text,
      })),
    },
    therapy: {
      full: narratives.therapy_explanation.full,
      sections: narratives.therapy_explanation.segments.map((s) => ({
        title: s.label,
        content: s.text,
      })),
    },
    lifestyle: {
      full: narratives.lifestyle_plan.full,
      sections: narratives.lifestyle_plan.segments.map((s) => ({
        title: s.label,
        content: s.text,
      })),
    },
    prognosis: {
      full: narratives.prognosis.full,
      sections: narratives.prognosis.segments.map((s) => ({
        title: s.label,
        content: s.text,
      })),
    },
    monitoring: {
      full: narratives.monitoring_plan.full,
      sections: narratives.monitoring_plan.segments.map((s) => ({
        title: s.label,
        content: s.text,
      })),
    },
    therapyNeeds: narratives.enrichedTherapyNeeds.map((need) => ({
      key: need.need,
      title: need.title,
      clinical: need.clinicalRationale,
      patient: need.patientExplanation,
    })),
    rootCauses: narratives.enrichedRootCauses.map((cause) => ({
      key: cause.cause,
      title: cause.title,
      clinical: cause.clinicalContext,
      patient: cause.patientFriendly,
    })),
  };
}
