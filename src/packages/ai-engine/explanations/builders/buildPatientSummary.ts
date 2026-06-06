import type { RootCause } from '../../../types';
import type { ExplanationContext } from '../types';

import { CONDITION_EXPLANATIONS } from '../dictionaries/conditions';
import { SIGNAL_EXPLANATIONS } from '../dictionaries/signals';
import { PROTOCOL_EXPLANATIONS } from '../dictionaries/protocols';
import { KIT_EXPLANATIONS } from '../dictionaries/kits';
import { lookupOrFallback, sortBySeverityDesc, normaliseKey } from '../utils';

// ─────────────────────────────────────────────────────────────────────────────
// buildPatientSummary
//
// Generates an emotionally reassuring, medically grounded explanation
// personalised to the patient. Tone: warm, clear, non-technical, premium
// clinic quality. Avoids jargon. Avoids alarm. Is specific — not generic.
// ─────────────────────────────────────────────────────────────────────────────

export function buildPatientSummary(context: ExplanationContext): string {
  const { clinicalProfile, kitRecommendation, patientName } = context;
  const { primaryDiagnosis, secondaryDiagnoses, rootCauses, severity, flags } = clinicalProfile;

  const nameGreeting = patientName ? `${patientName}, ` : '';
  const sentences: string[] = [];

  // ── Sentence 1: Reassuring opener + what we found ─────────────────────────
  const conditionEntry = lookupOrFallback(CONDITION_EXPLANATIONS, primaryDiagnosis);
  const intensityWord = severity === 'SEVERE'
    ? 'a significant level of'
    : severity === 'MODERATE'
    ? 'a moderate degree of'
    : 'an early level of';
  sentences.push(
    `${nameGreeting}based on your assessment, we identified ${intensityWord} ${conditionEntry.patient.toLowerCase()}`
  );

  // ── Sentence 2: What is driving it (top root cause — patient language) ────
  if (rootCauses.length > 0) {
    const rootEntries = rootCauses.map((rc: RootCause) =>
      lookupOrFallback(SIGNAL_EXPLANATIONS, rc)
    );
    const primaryCause = sortBySeverityDesc(rootEntries)[0];
    sentences.push(`The primary contributing factor appears to be: ${primaryCause.patient.toLowerCase()}`);
  }

  // ── Sentence 3: Secondary contributors (if any — kept concise) ────────────
  if (secondaryDiagnoses.length > 0) {
    const secName = lookupOrFallback(CONDITION_EXPLANATIONS, secondaryDiagnoses[0].key);
    sentences.push(
      `We also identified an additional contributing factor: ${secName.patient.toLowerCase()}`
    );
  }

  // ── Sentence 4: Reassurance about treatability ────────────────────────────
  const treatabilityStatement = getTreatabilityStatement(primaryDiagnosis, severity);
  sentences.push(treatabilityStatement);

  // ── Sentence 5: Protocol overview (patient language) ─────────────────────
  const protocolEntry = lookupOrFallback(PROTOCOL_EXPLANATIONS, primaryDiagnosis);
  sentences.push(protocolEntry.patient);

  // ── Sentence 6: Kit 1 purpose (the first action they take) ───────────────
  const firstKit = kitRecommendation.rankedKits[0];
  if (firstKit) {
    const kitEntry = KIT_EXPLANATIONS[normaliseKey(firstKit.kitId)];
    if (kitEntry) {
      sentences.push(
        `Your first step is ${firstKit.kitId}: ${kitEntry.patient.toLowerCase()}`
      );
    }
  }

  // ── Sentence 7: How many kits and what to expect ─────────────────────────
  const kitCount = kitRecommendation.rankedKits.length;
  const timelineStatement = getTimelineStatement(primaryDiagnosis, severity, kitCount);
  sentences.push(timelineStatement);

  // ── Sentence 8: Special contextual note for specific flags ────────────────
  const contextNote = getContextualNote(flags);
  if (contextNote) sentences.push(contextNote);

  return sentences.filter(Boolean).map(capitaliseFirst).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

import type { DiagnosisKey, Severity } from '../../../types';
import type { ClinicalFlags } from '../../clinical-engine/types';

function getTreatabilityStatement(
  primaryDiagnosis: DiagnosisKey,
  severity: Severity
): string {
  const treatableConditions: Partial<Record<DiagnosisKey, string>> = {
    PREGNANCY:    'Your treatment during pregnancy is specifically selected to be completely safe for you and your baby.',
    REGROW_ONLY:  'The shedding phase has already resolved — which is a great sign. The focus now is entirely on encouraging new growth.',
    HAIR_BREAKAGE: 'Hair breakage from external damage responds very well to targeted shaft repair treatment.',
    EARLY_GREY:   'While we cannot reverse existing grey hair, we can meaningfully slow the process and protect the remaining pigment-producing cells.',
    ALOPECIA_AREATA: 'Alopecia areata is very responsive to immune-modulatory treatment, and significant regrowth is achievable for most patients.',
  };

  if (treatableConditions[primaryDiagnosis]) {
    return treatableConditions[primaryDiagnosis]!;
  }

  if (severity === 'SEVERE') {
    return 'While your hair loss is at a more advanced stage, a structured, consistent protocol can significantly slow further progression and support meaningful recovery.';
  }
  if (severity === 'MODERATE') {
    return 'The good news is that at this stage, the right treatment approach can produce very positive results with consistent use.';
  }
  return 'You have identified this at an early stage, which gives the treatment the best possible chance of a full and lasting response.';
}

function getTimelineStatement(
  primaryDiagnosis: DiagnosisKey,
  severity: Severity,
  kitCount: number
): string {
  const kitWord = kitCount === 1 ? 'one targeted supplement' : `a ${kitCount}-step supplement protocol`;

  if (primaryDiagnosis === 'PREGNANCY') {
    return 'Your pregnancy nutrition plan is a single, comprehensive supplement — simple and specifically designed for your stage.';
  }

  const timelineByDiagnosis: Partial<Record<DiagnosisKey, string>> = {
    REGROW_ONLY:  `Your ${kitWord} focuses entirely on stimulating dormant follicles back into active growth — with most patients noticing changes over 3–6 months.`,
    IRON_DEFICIENCY: `Your ${kitWord} restores iron first, which typically resolves the shedding within 8–12 weeks of reaching therapeutic levels.`,
    HAIR_BREAKAGE: `Your ${kitWord} repairs the structural damage to your hair fibre, with visible improvements typically within 6–10 weeks.`,
  };

  if (timelineByDiagnosis[primaryDiagnosis]) {
    return timelineByDiagnosis[primaryDiagnosis]!;
  }

  const severityTimeline = severity === 'SEVERE'
    ? '6–12 months of consistent use'
    : severity === 'MODERATE'
    ? '3–6 months of consistent use'
    : '6–12 weeks of consistent use';

  return `Your ${kitWord} works in sequence — each phase building on the last. Most patients notice meaningful improvement within ${severityTimeline}.`;
}

function getContextualNote(flags: ClinicalFlags): string {
  if (flags.isPregnant) {
    return 'Because you are pregnant, your entire treatment plan has been designed around complete safety for you and your baby — no compromises.';
  }
  if (flags.hasGLP1Early) {
    return 'Your treatment starts with a protective shield for your hair during the active weight-loss phase — this is the most important first step for GLP-1 users.';
  }
  if (flags.hasActiveShedding) {
    return 'Stopping the active shedding is the priority first step — once that stabilises, your hair has the best environment to start recovering.';
  }
  if (flags.isVeg) {
    return 'Because you follow a vegetarian diet, your protocol has been selected with your nutritional profile in mind, ensuring any specific nutrient gaps are addressed.';
  }
  return '';
}

function capitaliseFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
