import type { PatientAnswers } from '../../../types';
import type { ScoreAccumulator } from '../types';
import { signals } from '../signals';

// Lifestyle / immune / scalp / structural scoring.
// AA (105) and TTM (102) are scored highest — near-absolute but allow co-condition modifiers.
export function applyLifestyleScores(
  ans: PatientAnswers,
  acc: ScoreAccumulator,
  isMale: boolean,
  age: number
): void {
  const s = signals(ans);

  // ── Autoimmune (105) ──────────────────────────────────────────────────────
  if (
    s.immunity('Alopecia Areata') || s.immunity('Areata') ||
    s.hairtype('circular') || s.hairtype('patches')
  ) {
    acc['ALOPECIA_AREATA'] = (acc['ALOPECIA_AREATA'] ?? 0) + 105;
  }

  // ── TTM (102) — allows co-condition modifiers (TE + Phenotype) ───────────
  if (s.cause('pulling') || s.cause('Trichotillomania') || s.cause('TTM') || s.cause('OCD')) {
    acc['TTM'] = (acc['TTM'] ?? 0) + 102;
  }

  // ── Oxidative / lifestyle (58) ────────────────────────────────────────────
  if (s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol')) {
    acc['OXIDATIVE'] = (acc['OXIDATIVE'] ?? 0) + 58;
  }

  // ── Night shift / flying ──────────────────────────────────────────────────
  if (s.lifestyle('Night shift') || s.lifestyle('Night Shift')) {
    acc['NIGHT_SHIFT'] = (acc['NIGHT_SHIFT'] ?? 0) + 62;
  }
  if (s.lifestyle('flying') || s.lifestyle('Flying')) {
    acc['FREQUENT_FLYING'] = (acc['FREQUENT_FLYING'] ?? 0) + 58;
  }

  // ── Scalp inflammation — scored higher for young females (per Excel row 65) ─
  const hasScalpInflam =
    s.scalp('Redness') || s.scalp('irritation') || s.scalp('Boils') ||
    s.scalp('pimples') || s.scalp('Burning');
  const hasScalpSeborr = s.scalp('Dandruff') || s.scalp('Oily') || s.scalp('Itching');
  if (hasScalpInflam || hasScalpSeborr) {
    const scalpScore = !isMale && age < 30 ? 62 : 42;
    acc['SCALP_INFLAM'] = (acc['SCALP_INFLAM'] ?? 0) + scalpScore;
  }

  // ── Gut (62) ──────────────────────────────────────────────────────────────
  const hasActiveGut = (ans.gut ?? []).some(
    (g) => g != null && !g.toLowerCase().includes('no gut') && !g.toLowerCase().includes('none')
  );
  if (hasActiveGut && s.immunity('ulcer')) {
    acc['MOUTH_ULCERS'] = (acc['MOUTH_ULCERS'] ?? 0) + 72;
  } else if (hasActiveGut) {
    acc['GUT_ISSUES'] = (acc['GUT_ISSUES'] ?? 0) + 62;
  }

  // ── Hair breakage (52) — only when structural shaft damage is confirmed ───
  // Hard water is the only reachable shaft-damage signal in the current
  // questionnaire (Q3 'Broken/short' option retired). Heat/chemical alone is
  // insufficient.
  const hasHBRHardWater = s.cause('Hard water');
  if (hasHBRHardWater) {
    acc['HAIR_BREAKAGE'] = (acc['HAIR_BREAKAGE'] ?? 0) + 52;
  }
}
