import type { PatientAnswers } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';
import { detectMetabolicSignal } from '../rules/metabolicModifierRule';

// Determines max kit count based on patient clinical complexity.
// Directly extracted from the active-signal-count logic in getFunnelKits().
export function kitCapCalculator(ctx: KitScorerContext, ans: PatientAnswers): number {
  const s = signals(ans);

  const smokingVaping = s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol');
  const hasMetabolic  = detectMetabolicSignal(ans);
  const hasGut        =
    s.gut('GERD') || s.gut('Bloating') || s.gut('IBS') || s.gut('Acid') || s.gut('Crohn');
  const { isRegrowGoal } = ctx.flags;

  const activeSignalCount = [smokingVaping, hasMetabolic, hasGut, isRegrowGoal]
    .filter(Boolean).length;

  if (activeSignalCount >= 3) return 7;
  if (activeSignalCount >= 2 || isRegrowGoal) return 6;
  if (smokingVaping) return 5;
  return 4;
}
