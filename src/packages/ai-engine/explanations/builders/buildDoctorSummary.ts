import type { RootCause, TherapyNeed } from '../../../types';
import type { ExplanationContext } from '../types';

import { CONDITION_EXPLANATIONS } from '../dictionaries/conditions';
import { SIGNAL_EXPLANATIONS } from '../dictionaries/signals';
import { THERAPY_NEED_EXPLANATIONS } from '../dictionaries/therapyNeeds';
import { PROTOCOL_EXPLANATIONS } from '../dictionaries/protocols';
import { lookupOrFallback, sortBySeverityDesc, formatBullet } from '../utils';

// ─────────────────────────────────────────────────────────────────────────────
// buildDoctorSummary
//
// Generates a concise, medically coherent paragraph for the prescribing
// clinician. Tone: clinical, audit-friendly, dermatologist-facing.
// No marketing language. No hedging. Pure clinical reasoning.
// ─────────────────────────────────────────────────────────────────────────────

export function buildDoctorSummary(context: ExplanationContext): string {
  const { clinicalProfile, therapyNeeds, kitRecommendation } = context;
  const { primaryDiagnosis, secondaryDiagnoses, rootCauses, severity, flags } = clinicalProfile;

  const sentences: string[] = [];

  // ── Sentence 1: Primary diagnosis + severity ──────────────────────────────
  const conditionEntry = lookupOrFallback(CONDITION_EXPLANATIONS, primaryDiagnosis);
  const severityLabel = severity === 'SEVERE' ? 'severe' : severity === 'MODERATE' ? 'moderate' : 'mild';
  sentences.push(
    `${severityLabel.charAt(0).toUpperCase() + severityLabel.slice(1)} ${conditionEntry.clinical}`
  );

  // ── Sentence 2: Secondary diagnoses (if present) ──────────────────────────
  if (secondaryDiagnoses.length > 0) {
    const secLabels = secondaryDiagnoses
      .slice(0, 3)
      .map((s) => {
        const e = lookupOrFallback(CONDITION_EXPLANATIONS, s.key);
        return e.clinical.split('.')[0];
      });
    sentences.push(
      `Concurrent secondary condition${secondaryDiagnoses.length > 1 ? 's' : ''}: ${secLabels.join('; ')}.`
    );
  }

  // ── Sentence 3: Root cause summary (top 3 by severity) ────────────────────
  if (rootCauses.length > 0) {
    const rootEntries = rootCauses.map((rc: RootCause) =>
      lookupOrFallback(SIGNAL_EXPLANATIONS, rc)
    );
    const topCauses = sortBySeverityDesc(rootEntries).slice(0, 3);
    const causeList = topCauses.map((e) => e.clinical.split('.')[0]).join('; ');
    sentences.push(`Aetiological drivers identified: ${causeList}.`);
  }

  // ── Sentence 4: Therapy needs ─────────────────────────────────────────────
  if (therapyNeeds.needs.length > 0) {
    const needLabels = therapyNeeds.needs
      .slice(0, 5)
      .map((n: TherapyNeed) => {
        const e = lookupOrFallback(THERAPY_NEED_EXPLANATIONS, n);
        return e.clinical.split('.')[0];
      });
    sentences.push(`Therapeutic objectives: ${needLabels.join('; ')}.`);
  }

  // ── Sentence 5: Protocol selection rationale ──────────────────────────────
  const protocolEntry = lookupOrFallback(PROTOCOL_EXPLANATIONS, primaryDiagnosis);
  sentences.push(protocolEntry.clinical);

  // ── Sentence 6: Kit stack summary ─────────────────────────────────────────
  const kitStack = kitRecommendation.rankedKits
    .map((k, i) => `Phase ${i + 1}: ${k.kitId}`)
    .join(' → ');
  sentences.push(`Prescribed protocol stack: ${kitStack}.`);

  // ── Sentence 7: Applied rules (precedence/audit trail) ────────────────────
  if (kitRecommendation.appliedRules.length > 0) {
    sentences.push(
      `Applied precedence rules: ${kitRecommendation.appliedRules.join(', ')}.`
    );
  }

  // ── Sentence 8: Clinical flags relevant to safety ─────────────────────────
  const safetyFlags: string[] = [];
  if (flags.isPregnant) safetyFlags.push('active pregnancy — absolute protocol lock applied');
  if (flags.isGrade45) safetyFlags.push(`advanced grade (${flags.grade}) — reduced reversal probability`);
  if (flags.hasGLP1Early) safetyFlags.push('GLP-1 early phase — rapid weight loss shield at Phase 1');
  if (flags.hasGLP1Late) safetyFlags.push('GLP-1 late phase — active shedding pattern noted');
  if (flags.hasActiveShedding) safetyFlags.push('active telogen shedding confirmed');
  if (flags.isVeg) safetyFlags.push('vegetarian diet — nutritional TE risk elevated');

  if (safetyFlags.length > 0) {
    sentences.push(`Clinical flags: ${safetyFlags.join('; ')}.`);
  }

  return sentences.filter(Boolean).join(' ');
}
