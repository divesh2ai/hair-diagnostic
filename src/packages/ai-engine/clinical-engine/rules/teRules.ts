import type { ScoreAccumulator } from '../types';
import type { SignalHelper } from '../signals';

// TE scoring — lower base scores (55–72) so primary conditions (thyroid, PCOS) always dominate.
export function applyTeScores(
  s: SignalHelper,
  acc: ScoreAccumulator,
  hasAGASignals: boolean,
  age: number
): void {
  // Illness / surgery / medication — TE_ILLNESS scored 72 (above generic TE)
  if (s.cause('Medication') || s.cause('Recent Illness') || s.cause('Illness') || s.cause('Surgery')) {
    acc['TE_ILLNESS'] = (acc['TE_ILLNESS'] ?? 0) + 72;
  }

  const hasStress    = s.cause('Stress') || s.cause('Anxiety') || s.cause('Depression');
  const hasNutrition = s.cause('Nutritional');

  if (hasStress && !hasNutrition) acc['TE_STRESS']    = (acc['TE_STRESS']    ?? 0) + 55;
  if (hasNutrition)               acc['TE_NUTRITION']  = (acc['TE_NUTRITION'] ?? 0) + 58;

  // Fallback TE — only when no stronger signal drives a primary condition
  const hasActiveGut = false; // computed by lifestyleRules; use conservatively
  if (!hasStress && !hasNutrition && !hasAGASignals && !hasActiveGut && age <= 30) {
    acc['TE_STRESS'] = (acc['TE_STRESS'] ?? 0) + 30;
  }
}
