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
  // Locked clinical rule: only structural gut-axis signals (GERD / IBS / Acid / Crohn)
  // expand the kit cap. Bloating and Constipation are mild and do not warrant an extra slot.
  const hasGut        =
    s.gut('GERD') || s.gut('IBS') || s.gut('Acid') || s.gut('Crohn');
  // Inflammation counts toward complexity: oily / dandruff / redness / burning
  // pull PHENOTYPE INFLAMATION into the protocol, which must coexist with
  // metabolic / pattern / shedding kits without forcing them out by the cap.
  const hasInflam =
    s.scalp('Oily') || s.scalp('Dandruff') || s.scalp('Redness') ||
    s.scalp('Burning') || s.scalp('Flaking') || s.scalp('irritation') ||
    s.scalp('Boils') || s.scalp('pimples') ||
    s.immunity('Allergies') || s.immunity('Skin rash') || s.immunity('Asthma');
  const { isRegrowGoal } = ctx.flags;

  const activeSignalCount = [smokingVaping, hasMetabolic, hasGut, isRegrowGoal, hasInflam]
    .filter(Boolean).length;

  if (activeSignalCount >= 3) return 7;
  if (activeSignalCount >= 2 || isRegrowGoal) return 6;
  if (smokingVaping || hasInflam) return 5;
  return 4;
}
