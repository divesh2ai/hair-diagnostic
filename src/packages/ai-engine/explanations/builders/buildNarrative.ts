import type { ExplanationContext, NarrativeLength, NarrativeResult } from '../types';

import { buildDoctorSummary } from './buildDoctorSummary';
import { buildPatientSummary } from './buildPatientSummary';
import { buildClinicalReasoning } from './buildClinicalReasoning';
import { buildKitExplanation } from './buildKitExplanation';
import { buildProtocolExplanation } from './buildProtocolExplanation';

import { CONDITION_EXPLANATIONS } from '../dictionaries/conditions';
import { PROTOCOL_EXPLANATIONS } from '../dictionaries/protocols';
import { KIT_EXPLANATIONS } from '../dictionaries/kits';
import { lookupOrFallback, normaliseKey } from '../utils';

// ─────────────────────────────────────────────────────────────────────────────
// buildNarrative
//
// Composes the final narrative from all explanation layers.
// Supports three lengths:
//   short    — 2–3 sentences: diagnosis + key kit
//   medium   — diagnosis, therapy needs, kit rationale overview
//   detailed — full clinical picture with all drivers, kits, rules, outcomes
// ─────────────────────────────────────────────────────────────────────────────

export function buildNarrative(
  context: ExplanationContext
): NarrativeResult {
  const length = context.narrativeLength ?? 'medium';

  const doctorSummary = buildDoctorSummary(context);
  const patientSummary = buildPatientSummary(context);
  const narrative = composeNarrative(context, length);

  return {
    doctorSummary,
    patientSummary,
    narrative,
    length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Narrative composers by length
// ─────────────────────────────────────────────────────────────────────────────

function composeNarrative(
  context: ExplanationContext,
  length: NarrativeLength
): string {
  switch (length) {
    case 'short':
      return composeShortNarrative(context);
    case 'medium':
      return composeMediumNarrative(context);
    case 'detailed':
      return composeDetailedNarrative(context);
  }
}

// ─── Short: 2–3 sentences covering primary diagnosis + first kit ──────────────

function composeShortNarrative(context: ExplanationContext): string {
  const { clinicalProfile, kitRecommendation } = context;
  const conditionEntry = lookupOrFallback(
    CONDITION_EXPLANATIONS,
    clinicalProfile.primaryDiagnosis
  );
  const firstKit = kitRecommendation.rankedKits[0];
  const kitEntry = firstKit ? KIT_EXPLANATIONS[normaliseKey(firstKit.kitId)] : null;

  const parts: string[] = [
    conditionEntry.patient,
    kitEntry
      ? `Your treatment begins with ${firstKit.kitId}: ${kitEntry.patient.toLowerCase()}`
      : kitRecommendation.protocolRationale,
  ];

  if (kitRecommendation.rankedKits.length > 1) {
    parts.push(
      `A total of ${kitRecommendation.rankedKits.length} phases are included in your protocol to address the full picture.`
    );
  }

  return parts.filter(Boolean).join(' ');
}

// ─── Medium: diagnosis, therapy needs overview, kit summary ──────────────────

function composeMediumNarrative(context: ExplanationContext): string {
  const { clinicalProfile, therapyNeeds, kitRecommendation } = context;

  const parts: string[] = [];

  // 1. Condition overview
  const conditionEntry = lookupOrFallback(
    CONDITION_EXPLANATIONS,
    clinicalProfile.primaryDiagnosis
  );
  parts.push(conditionEntry.patient);

  // 2. Secondary diagnosis (if present)
  if (clinicalProfile.secondaryDiagnoses.length > 0) {
    const sec = lookupOrFallback(
      CONDITION_EXPLANATIONS,
      clinicalProfile.secondaryDiagnoses[0].key
    );
    parts.push(`An additional contributing factor has also been identified: ${sec.patient.toLowerCase()}`);
  }

  // 3. Protocol overview
  const protocolEntry = lookupOrFallback(
    PROTOCOL_EXPLANATIONS,
    clinicalProfile.primaryDiagnosis
  );
  parts.push(protocolEntry.patient);

  // 4. Therapy needs summary (patient-facing — top 3 only for brevity)
  if (therapyNeeds.needs.length > 0) {
    const needLabels = therapyNeeds.needs
      .slice(0, 3)
      .map((n) => n.replace(/_/g, ' ').toLowerCase())
      .join(', ');
    parts.push(
      `The core therapeutic goals are: ${needLabels}.`
    );
  }

  // 5. Kit sequence (names only — brief)
  const kitNames = kitRecommendation.rankedKits.map((k) => k.kitId).join(' → ');
  parts.push(`Your protocol sequence is: ${kitNames}.`);

  // 6. Selection justification from engine
  if (kitRecommendation.selectionJustification) {
    parts.push(kitRecommendation.selectionJustification);
  }

  return parts.filter(Boolean).join(' ');
}

// ─── Detailed: full picture — drivers, each kit, rules, outcomes ──────────────

function composeDetailedNarrative(context: ExplanationContext): string {
  const { clinicalProfile, therapyNeeds, kitRecommendation } = context;

  const sections: string[] = [];

  // ── Section 1: Clinical picture ──────────────────────────────────────────
  const reasoning = buildClinicalReasoning(clinicalProfile, therapyNeeds);

  sections.push('=== CLINICAL PICTURE ===');
  sections.push(...reasoning.clinicalBullets);

  if (reasoning.dominantDrivers.length > 0) {
    sections.push(`Dominant drivers: ${reasoning.dominantDrivers.join('; ')}.`);
  }
  if (reasoning.riskFactors.length > 0) {
    sections.push(`Risk factors: ${reasoning.riskFactors.join(' ')}`);
  }

  // ── Section 2: Protocol rationale ────────────────────────────────────────
  const protocolExplanation = buildProtocolExplanation(kitRecommendation, clinicalProfile);

  sections.push('');
  sections.push('=== PROTOCOL RATIONALE ===');
  sections.push(protocolExplanation.selectedReason);

  if (protocolExplanation.firedPrecedenceRules.length > 0) {
    sections.push(
      `Precedence rules applied: ${protocolExplanation.firedPrecedenceRules.join(', ')}.`
    );
  }

  if (protocolExplanation.suppressedProtocols.length > 0) {
    sections.push('Suppressed kits:');
    for (const sup of protocolExplanation.suppressedProtocols) {
      const replacedNote = sup.replacedBy ? ` (replaced by ${sup.replacedBy})` : '';
      sections.push(`  • ${sup.suppressedKitId}${replacedNote}: ${sup.reason}`);
    }
  }

  // ── Section 3: Kit explanations ───────────────────────────────────────────
  const kitExplanations = buildKitExplanation(kitRecommendation, therapyNeeds);

  sections.push('');
  sections.push('=== KIT PROTOCOL ===');

  for (const kit of kitExplanations) {
    sections.push(`Phase ${kitExplanations.indexOf(kit) + 1}: ${kit.kitId}`);
    sections.push(`  Clinical purpose: ${kit.clinicalPurpose}`);
    sections.push(`  Patient purpose: ${kit.patientFriendlyPurpose}`);

    if (kit.whySelected.length > 0) {
      sections.push('  Why selected:');
      for (const why of kit.whySelected.slice(0, 3)) {
        sections.push(`    — ${why}`);
      }
    }

    if (kit.expectedOutcomes.length > 0) {
      sections.push('  Expected outcomes:');
      for (const outcome of kit.expectedOutcomes.slice(0, 3)) {
        sections.push(`    — ${outcome}`);
      }
    }

    sections.push('');
  }

  // ── Section 4: Rule trace (audit trail) ──────────────────────────────────
  if (kitRecommendation.ruleTrace.length > 0) {
    sections.push('=== RULE TRACE ===');
    for (const trace of kitRecommendation.ruleTrace) {
      sections.push(`Rule: ${trace.rule}`);
      sections.push(`  Reason: ${trace.reason}`);
      sections.push(`  Before: [${trace.before.join(', ')}]`);
      sections.push(`  After:  [${trace.after.join(', ')}]`);
    }
  }

  return sections.join('\n');
}
