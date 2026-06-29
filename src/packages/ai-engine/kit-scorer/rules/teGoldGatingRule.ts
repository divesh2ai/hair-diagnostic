import type { PatientAnswers, KitId } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';

// ─────────────────────────────────────────────────────────────────────────────
// HAIR FACT TE GOLD gating rule (locked clinical rule).
//
//   TE GOLD is prescribed ONLY when hair fall duration is within 3 months
//   (acute shedding window). Signal-only triggers (stress / nutritional /
//   iatrogenic / etc.) do NOT qualify a patient for TE GOLD once the shedding
//   has lasted longer than 3 months. Locked clinical rule.
//
//   Breastfeeding exclusion: post-partum + still-feeding patients NEVER
//   receive TE GOLD — LACTIHEALTH already covers the lactation-driven
//   nutritional shedding mechanism. Layering TE GOLD on a breastfeeding
//   patient duplicates micronutrient load without clinical benefit.
//
//   Runs AFTER prioritisation and signal-gated injection so it sees the
//   final sequence. Idempotent: if no TE GOLD is present, no-op.
// ─────────────────────────────────────────────────────────────────────────────

const TE_GOLD_KITS: KitId[] = ['HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG'];

export function isTeGoldDurationAboveThreeMonths(duration?: string): boolean {
  const normalized = (duration ?? '').trim().toLowerCase();
  if (!normalized) return false;

  if (
    /less than\s*3|under\s*3|below\s*3|0\s*[–-]\s*3|1\s*[–-]\s*3|up to\s*3/i.test(normalized)
  ) {
    return false;
  }

  const parsedNumbers = (normalized.match(/\d+/g) ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (parsedNumbers.some((value) => value > 3)) return true;

  return /more than|over\s*3|above\s*3|after\s*3|>\s*3/i.test(normalized);
}

function isBreastfeeding(ans: PatientAnswers): boolean {
  const s = signals(ans);
  const explicitlyNotFeeding = s.cause('not feeding');
  if (explicitlyNotFeeding) return false;
  return (
    s.cause('Post partum') ||
    s.cause('still feeding') ||
    s.hormonal('breastfeeding') ||
    s.hormonal('Post-delivery')
  );
}

export function applyTeGoldGatingRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
): KitScorerContext {
  const hasTeGold = ctx.phases.some((k) => TE_GOLD_KITS.includes(k));
  if (!hasTeGold) return ctx;

  if (isBreastfeeding(ans)) {
    const phases = ctx.phases.filter((k) => !TE_GOLD_KITS.includes(k));
    return {
      ...ctx,
      phases,
      appliedRules: [
        ...ctx.appliedRules,
        'TE_GOLD_BREASTFEEDING_STRIP: HAIR FACT TE GOLD removed — patient is post-partum + still feeding. LACTIHEALTH already covers the lactation-driven nutritional shedding mechanism; layering TE GOLD duplicates micronutrient load.',
      ],
    };
  }

  if (isTeGoldDurationAboveThreeMonths(ans.duration)) {
    const phases = ctx.phases.filter((k) => !TE_GOLD_KITS.includes(k));
    return {
      ...ctx,
      phases,
      appliedRules: [
        ...ctx.appliedRules,
        'TE_GOLD_DURATION_CAP: HAIR FACT TE GOLD removed — hair fall has been present longer than 3 months. TE GOLD is reserved for acute shedding (≤ 3 months) regardless of signal triggers.',
      ],
    };
  }

  return ctx;
}
