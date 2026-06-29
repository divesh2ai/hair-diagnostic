import type { TherapyNeed } from '../../../types';
import type { KitRecommendation, ScoredKit } from '../../kit-scorer/types';
import type { TherapyNeeds } from '../../therapy-engine/types';
import type { KitExplanationItem } from '../types';

import { KIT_EXPLANATIONS } from '../dictionaries/kits';
import { THERAPY_NEED_EXPLANATIONS } from '../dictionaries/therapyNeeds';
import { lookupOrFallback, formatBullet, deduplicateBullets, normaliseKey } from '../utils';
import { getKitSelectionLeadIn } from '../../shared/kitSelectionOpeners';

// ─────────────────────────────────────────────────────────────────────────────
// buildKitExplanation
//
// Generates a KitExplanationItem for every kit in the ranked kit list.
// Each item explains why the kit was selected, its expected outcomes, and
// its clinical + patient-facing purpose statements.
// ─────────────────────────────────────────────────────────────────────────────

export function buildKitExplanation(
  kitRecommendation: KitRecommendation,
  therapyNeeds: TherapyNeeds
): KitExplanationItem[] {
  return kitRecommendation.rankedKits.map((scoredKit) =>
    buildSingleKitExplanation(scoredKit, therapyNeeds)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildSingleKitExplanation(
  scoredKit: ScoredKit,
  therapyNeeds: TherapyNeeds
): KitExplanationItem {
  const kitKey = normaliseKey(scoredKit.kitId);
  const kitEntry = KIT_EXPLANATIONS[kitKey];

  // ── Clinical and patient purpose ──────────────────────────────────────────
  const clinicalPurpose = kitEntry?.clinical
    ?? `No clinical entry registered for kit: ${scoredKit.kitId}`;
  const patientFriendlyPurpose = kitEntry?.patient
    ?? `This supplement supports your hair health programme.`;

  // ── whySelected: compose from matched needs + engine reasons ─────────────
  const whySelected = buildWhySelected(scoredKit, therapyNeeds);

  // ── Expected outcomes: from dictionary + matched needs ────────────────────
  const expectedOutcomes = buildExpectedOutcomes(scoredKit, kitEntry?.expectedOutcomes ?? []);

  return {
    kitId: scoredKit.kitId,
    whySelected,
    expectedOutcomes,
    clinicalPurpose: formatBullet(clinicalPurpose),
    patientFriendlyPurpose: formatBullet(patientFriendlyPurpose),
  };
}

/**
 * Builds the whySelected bullet list for a kit by combining:
 * 1. Patient-facing therapy need explanations for each matched need
 * 2. Clinical reasons recorded by the kit scorer during selection
 * 3. Phase position context
 */
function buildWhySelected(
  scoredKit: ScoredKit,
  therapyNeeds: TherapyNeeds
): string[] {
  const bullets: string[] = [];
  const leadIn = getKitSelectionLeadIn(scoredKit.kitId);

  if (leadIn) {
    bullets.push(formatBullet(leadIn));
  }

  // Therapy need explanations (patient-facing) for each matched need
  for (const need of scoredKit.matchedNeeds) {
    const needEntry = lookupOrFallback(THERAPY_NEED_EXPLANATIONS, need as TherapyNeed);
    bullets.push(formatBullet(needEntry.patient));
  }

  // Kit scorer reasons (from rules engine — already human-readable strings)
  for (const reason of scoredKit.reasons) {
    bullets.push(formatBullet(reason));
  }

  // Enrich with need reason traces where available
  for (const need of scoredKit.matchedNeeds) {
    const reasons = therapyNeeds.needReasons[need as TherapyNeed] ?? [];
    for (const r of reasons) {
      bullets.push(formatBullet(r));
    }
  }

  return deduplicateBullets(bullets);
}

/**
 * Builds the expected outcomes list by combining:
 * 1. Registered kit dictionary outcomes
 * 2. Outcomes derived from matched therapy needs (patient-facing)
 */
function buildExpectedOutcomes(
  scoredKit: ScoredKit,
  dictionaryOutcomes: string[]
): string[] {
  const outcomes: string[] = [...dictionaryOutcomes];

  // Add therapy-need-specific outcomes for any needs the kit matches
  // that aren't already covered by the dictionary entry
  for (const need of scoredKit.matchedNeeds) {
    const needEntry = lookupOrFallback(THERAPY_NEED_EXPLANATIONS, need as TherapyNeed);
    // Patient text from the need entry makes a natural outcome statement
    outcomes.push(formatBullet(needEntry.patient));
  }

  return deduplicateBullets(outcomes);
}
