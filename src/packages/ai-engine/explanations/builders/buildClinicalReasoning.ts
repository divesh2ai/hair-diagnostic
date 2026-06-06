import type { RootCause, DiagnosisKey, TherapyNeed } from '../../../types';
import type { ClinicalProfile } from '../../clinical-engine/types';
import type { TherapyNeeds } from '../../therapy-engine/types';
import type { ClinicalReasoningResult } from '../types';

import { SIGNAL_EXPLANATIONS } from '../dictionaries/signals';
import { CONDITION_EXPLANATIONS } from '../dictionaries/conditions';
import { THERAPY_NEED_EXPLANATIONS } from '../dictionaries/therapyNeeds';
import { SCALP_STATE_EXPLANATIONS, RISK_FACTOR_EXPLANATIONS } from '../dictionaries/riskFactors';
import {
  lookupOrFallback,
  sortBySeverityDesc,
  deduplicateBullets,
  formatBullet,
} from '../utils';

// ─────────────────────────────────────────────────────────────────────────────
// buildClinicalReasoning
//
// Assembles structured clinical reasoning from a ClinicalProfile and TherapyNeeds.
// Returns two parallel bullet lists (clinical + patient) plus dominant drivers
// and risk factor summaries — all derived from registered dictionaries.
// ─────────────────────────────────────────────────────────────────────────────

export function buildClinicalReasoning(
  clinicalProfile: ClinicalProfile,
  therapyNeeds: TherapyNeeds
): ClinicalReasoningResult {
  const clinicalBullets: string[] = [];
  const patientBullets: string[] = [];

  // ── 1. Primary diagnosis ───────────────────────────────────────────────────
  const primaryEntry = lookupOrFallback(CONDITION_EXPLANATIONS, clinicalProfile.primaryDiagnosis);
  clinicalBullets.push(formatBullet(`Primary: ${primaryEntry.clinical}`));
  patientBullets.push(formatBullet(primaryEntry.patient));

  // ── 2. Secondary diagnoses (sorted by score desc, already sorted upstream) ─
  for (const secondary of clinicalProfile.secondaryDiagnoses) {
    const secEntry = lookupOrFallback(CONDITION_EXPLANATIONS, secondary.key);
    clinicalBullets.push(formatBullet(`Secondary (${secondary.key}): ${secEntry.clinical}`));
    patientBullets.push(formatBullet(secEntry.patient));
  }

  // ── 3. Root causes (sorted by severity desc for display priority) ──────────
  const rootCauseEntries = clinicalProfile.rootCauses.map((rc: RootCause) =>
    lookupOrFallback(SIGNAL_EXPLANATIONS, rc)
  );
  const sortedRootCauses = sortBySeverityDesc(rootCauseEntries);

  for (const entry of sortedRootCauses) {
    clinicalBullets.push(formatBullet(entry.clinical));
    patientBullets.push(formatBullet(entry.patient));
  }

  // ── 4. Scalp states ────────────────────────────────────────────────────────
  for (const scalpState of clinicalProfile.scalpStates) {
    const scalpEntry = lookupOrFallback(SCALP_STATE_EXPLANATIONS, scalpState);
    if (scalpEntry.severity !== 'low') {
      // Only surface non-trivial scalp states to avoid noise
      clinicalBullets.push(formatBullet(`Scalp: ${scalpEntry.clinical}`));
      patientBullets.push(formatBullet(scalpEntry.patient));
    }
  }

  // ── 5. Therapy need rationale ──────────────────────────────────────────────
  // Use needReasons for traceability — each need carries its clinical justification
  for (const need of therapyNeeds.needs) {
    const needEntry = lookupOrFallback(THERAPY_NEED_EXPLANATIONS, need as TherapyNeed);
    const reasons = therapyNeeds.needReasons[need as TherapyNeed] ?? [];
    const reasonSuffix = reasons.length > 0 ? ` (${reasons.join('; ')})` : '';
    clinicalBullets.push(formatBullet(`${need}: ${needEntry.clinical}${reasonSuffix}`));
    patientBullets.push(formatBullet(needEntry.patient));
  }

  // ── 6. Dominant drivers — top causes driving the primary diagnosis ─────────
  const dominantDrivers = resolveDominantDrivers(
    clinicalProfile.primaryDiagnosis,
    clinicalProfile.rootCauses
  );

  // ── 7. Risk factors ────────────────────────────────────────────────────────
  const riskFactors = resolveRiskFactors(clinicalProfile);

  return {
    clinicalBullets: deduplicateBullets(clinicalBullets),
    patientBullets: deduplicateBullets(patientBullets),
    dominantDrivers,
    riskFactors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the top 1–3 root cause labels that most directly drive the primary diagnosis. */
function resolveDominantDrivers(
  primaryDiagnosis: DiagnosisKey,
  rootCauses: RootCause[]
): string[] {
  // Mapping: which root causes are most clinically relevant per primary diagnosis
  const DIAGNOSIS_DOMINANT_CAUSES: Partial<Record<DiagnosisKey, RootCause[]>> = {
    AGA_MALE_123:    ['DHT', 'GENETICS'],
    AGA_MALE_45:     ['DHT', 'GENETICS'],
    AGA_FEMALE_123:  ['DHT', 'HORMONAL_SHIFT', 'GENETICS'],
    AGA_FEMALE_45:   ['DHT', 'HORMONAL_SHIFT', 'GENETICS'],
    TE_STRESS:       ['STRESS'],
    TE_NUTRITION:    ['POOR_NUTRITION', 'IRON_DEFICIENCY'],
    TE_POSTPREG:     ['POST_PARTUM', 'HORMONAL_SHIFT'],
    TE_DELIVERY:     ['POST_PARTUM', 'HORMONAL_SHIFT'],
    TE_ILLNESS:      ['ILLNESS', 'MEDICATION'],
    THYROID_HYPO:    ['HYPOTHYROID'],
    THYROID_HYPER:   ['HYPERTHYROID'],
    PCOS_ONLY:       ['PCOS', 'DHT'],
    PCOS_OBESITY:    ['PCOS', 'METABOLIC', 'DHT'],
    PERI_MENOPAUSE:  ['HORMONAL_SHIFT', 'DHT'],
    MENOPAUSE:       ['HORMONAL_SHIFT', 'DHT'],
    POST_MENOPAUSE:  ['HORMONAL_SHIFT', 'METABOLIC', 'DHT'],
    IRON_DEFICIENCY: ['IRON_DEFICIENCY'],
    ALOPECIA_AREATA: ['AUTOIMMUNE'],
    WEIGHT_LOSS:     ['RAPID_WEIGHT_LOSS', 'POOR_NUTRITION'],
    GUT_ISSUES:      ['GUT_MALABSORPTION'],
    SCALP_INFLAM:    ['STRESS', 'METABOLIC'],
    OXIDATIVE:       ['OXIDATIVE_STRESS'],
    NIGHT_SHIFT:     ['CIRCADIAN_DISRUPTION'],
    FREQUENT_FLYING: ['CIRCADIAN_DISRUPTION', 'OXIDATIVE_STRESS'],
    DIABETES:        ['METABOLIC', 'DHT'],
    TTM:             ['TRICHOTILLOMANIA'],
    ENDOMETRIOSIS:   ['HORMONAL_SHIFT', 'POOR_NUTRITION'],
    EARLY_GREY:      ['OXIDATIVE_STRESS', 'POOR_NUTRITION'],
    MULTI:           ['STRESS', 'GUT_MALABSORPTION', 'DHT'],
    REGROW_ONLY:     ['STRESS', 'POOR_NUTRITION'],
  };

  const relevantCauses = DIAGNOSIS_DOMINANT_CAUSES[primaryDiagnosis] ?? [];

  // Return only the root causes that are both relevant for this diagnosis and
  // actually present in the patient's root cause list — max 3
  const matched = relevantCauses.filter((rc) => rootCauses.includes(rc)).slice(0, 3);

  // Fall back to the top 3 root causes by severity if no matched causes
  if (matched.length === 0) {
    return rootCauses.slice(0, 3).map((rc) => {
      const entry = lookupOrFallback(SIGNAL_EXPLANATIONS, rc);
      return entry.clinical.split('.')[0];
    });
  }

  return matched.map((rc) => {
    const entry = lookupOrFallback(SIGNAL_EXPLANATIONS, rc);
    return entry.clinical.split('.')[0]; // First sentence only for concise driver label
  });
}

/** Assembles patient-specific risk factors as labelled strings for the report. */
function resolveRiskFactors(profile: ClinicalProfile): string[] {
  const factors: string[] = [];

  if (profile.flags.isGrade45) {
    const entry = RISK_FACTOR_EXPLANATIONS['grade_45'];
    if (entry) factors.push(formatBullet(entry.clinical));
  }

  if (profile.flags.age > 50) {
    const entry = RISK_FACTOR_EXPLANATIONS['age_over_50'];
    if (entry) factors.push(formatBullet(entry.clinical));
  }

  if (profile.secondaryDiagnoses.length > 1) {
    const entry = RISK_FACTOR_EXPLANATIONS['multiple_secondary_diagnoses'];
    if (entry) factors.push(formatBullet(entry.clinical));
  }

  if (profile.flags.hasActiveShedding && profile.flags.isGrade45) {
    factors.push(formatBullet(
      'Concurrent active shedding on advanced AGA grade elevates urgency — shedding arrest is Phase 1 priority.'
    ));
  }

  if (profile.flags.hasGLP1Early || profile.flags.hasGLP1Late) {
    const entry = RISK_FACTOR_EXPLANATIONS['glp1_active'];
    if (entry) factors.push(formatBullet(entry.clinical));
  }

  return deduplicateBullets(factors);
}
