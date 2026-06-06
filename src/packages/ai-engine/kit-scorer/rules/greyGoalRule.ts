import type { KitId } from '../../../types';
import type { KitScorerContext } from '../types';
import type { ClinicalFlags } from '../../clinical-engine/types';

// When a patient selects Early Greying alongside a hair-fall/regrow concern:
// - EARLY GREYING CARE is appended at the END (hair fall protocol takes precedence).
// - OXIDATIVE STRESS added for melanocyte ROS damage ONLY when PHENOTYPE is absent.
//   (PHENOTYPE covers overlapping NAC/Resveratrol/Quercetin pathway;
//    OXIDATIVE STRESS uniquely adds Astaxanthin/CoQ10/ALA/Glutathione/Selenium.)
export function applyGreyGoalRule(ctx: KitScorerContext, flags: ClinicalFlags): KitScorerContext {
  if (!flags.hasGreyGoal) return ctx;

  const { isVeg } = flags;
  let phases = [...ctx.phases];
  const rules: string[] = [];

  const greyKit: KitId = isVeg ? 'EARLY GREYING CARE VEG' : 'EARLY GREYING CARE GOLD';
  const alreadyHasGrey = phases.some((k) => k.includes('EARLY GREYING CARE'));

  if (!alreadyHasGrey) {
    phases.push(greyKit);
    rules.push(
      'GREY_GOAL: EARLY GREYING CARE appended as final phase. ' +
      'Hair fall primary protocol takes precedence; grey co-concern addressed last.'
    );
  }

  // Melanocyte-protective oxidative support — only when PHENOTYPE not already present
  if (
    !phases.includes('OXIDATIVE STRESS') &&
    !phases.includes('PHENOTYPE INFLAMATION') &&
    phases.length < 5
  ) {
    phases.push('OXIDATIVE STRESS');
    rules.push(
      'GREY_OXIDATIVE: OXIDATIVE STRESS added for melanocyte protection. ' +
      'Astaxanthin/CoQ10/ALA/Glutathione/Selenium pathway — distinct from PHENOTYPE. ' +
      'Only added when PHENOTYPE is absent to avoid redundancy.'
    );
  }

  if (rules.length === 0) return ctx;
  return { ...ctx, phases, appliedRules: [...ctx.appliedRules, ...rules] };
}
