import type { PatientAnswers, DiagnosisKey } from '../../types';
import type { ClinicalFlags, ScoreAccumulator, ScoredDiagnosis } from './types';
import { signals } from './signals';
import { applyHormonalScores } from './rules/hormonalRules';
import { applyAgaScores, applyRule1ABoost } from './rules/agaRules';
import { applyMetabolicScores } from './rules/metabolicRules';
import { applyTeScores } from './rules/teRules';
import { applyLifestyleScores } from './rules/lifestyleRules';

// ─────────────────────────────────────────────────────────────────────────────
// SCORE CONDITIONS — flags → scored diagnosis result
//
// Owns all condition-scoring logic extracted from evaluateClinicalProfile.ts:
//   · regrow-only path (hormonal/metabolic dominance over AGA)
//   · grade 4/5 hard override (age >= 20 adults with advanced pattern loss)
//   · full weighted scoring engine (all rule modules + Rule 1A boost)
//   · dominant protocol selection (highest accumulated score)
//   · secondary condition collection (score >= 40, not dominant)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoredConditionResult {
  dominant: DiagnosisKey;
  topScore: number;
  secondary: ScoredDiagnosis[];
  allScores: ScoreAccumulator;
}

export function scoreConditions(
  ans: PatientAnswers,
  flags: ClinicalFlags,
): ScoredConditionResult {
  const { age, isMale, isGrade45, count, duration } = flags;

  // ── Regrow-only goal — hormonal/metabolic conditions still dominate ───────
  if (flags.isRegrowGoal && !flags.hasHairGoal) {
    return scoreRegrowConditions(ans, flags);
  }

  // ── Grade 4/5 hard override (age >= 20) ───────────────────────────────────
  // Advanced pattern loss in adults cannot be treated with TE protocol alone.
  if (age >= 20 && isGrade45) {
    const agaKey: DiagnosisKey = isMale ? 'AGA_MALE_45' : 'AGA_FEMALE_45';
    return singleDominantScore(agaKey, 95);
  }

  // ── Full weighted scoring engine ──────────────────────────────────────────
  const acc: ScoreAccumulator = {};
  const s = signals(ans);

  applyLifestyleScores(ans, acc, isMale, age);

  const hasAGASignals =
    count.toLowerCase().includes('thinning') ||
    count.toLowerCase().includes('no visible fall') ||
    s.hairtype('Thinning') || s.hairtype('widening') || s.hairtype('parting') ||
    s.cause('Genetics') || s.cause('Family history') ||
    s.scalp('Dandruff') || s.scalp('Oily') ||
    s.lifestyle('Bodybuilding') || s.lifestyle('Heavy gym') ||
    duration.includes('6–12') || duration.includes('More than');

  applyHormonalScores(ans, acc);
  applyMetabolicScores(ans, acc);
  applyAgaScores(s, acc, age, isMale, isGrade45, count, duration);
  applyTeScores(s, acc, hasAGASignals, age);
  applyRule1ABoost(acc); // must run last — depends on prior scores

  // ── Find dominant protocol (highest score) ────────────────────────────────
  let dominant: DiagnosisKey = 'TE_STRESS';
  let topScore = 0;
  for (const key of Object.keys(acc) as DiagnosisKey[]) {
    const score = acc[key] ?? 0;
    if (score > topScore) {
      topScore = score;
      dominant = key;
    }
  }

  // ── Collect secondary conditions (score >= 40, not dominant) ──────────────
  const secondary: ScoredDiagnosis[] = (Object.keys(acc) as DiagnosisKey[])
    .filter((k) => k !== dominant && (acc[k] ?? 0) >= 40)
    .map((k) => ({ key: k, score: acc[k] ?? 0, isPrimary: false }))
    .sort((a, b) => b.score - a.score);

  return { dominant, topScore, secondary, allScores: acc };
}

// ─────────────────────────────────────────────────────────────────────────────
// Regrow-only scoring
// When the patient says hair fall has stopped, hormonal/metabolic conditions
// still dominate over AGA — those are causal drivers, not secondary.
// ─────────────────────────────────────────────────────────────────────────────

function scoreRegrowConditions(
  ans: PatientAnswers,
  flags: ClinicalFlags,
): ScoredConditionResult {
  const s = signals(ans);
  const { isMale, isGrade45, age } = flags;

  let dominantKey: DiagnosisKey = 'REGROW_ONLY';

  if (s.hormonal('Post-menopause') || s.hormonal('Post menopause'))        dominantKey = 'POST_MENOPAUSE';
  else if (s.hormonal('Menopause') && !s.hormonal('Peri'))                  dominantKey = 'MENOPAUSE';
  else if (s.hormonal('Peri-menopause') || s.hormonal('peri'))              dominantKey = 'PERI_MENOPAUSE';
  else if (s.hormonal('PCOS') || s.hormonal('PCOD')) {
    const pcosObese =
      s.hormonal('Obesity') || s.lifestyle('Obesity') ||
      s.lifestyle('Sedentary') || s.lifestyle('weight');
    dominantKey = pcosObese ? 'PCOS_OBESITY' : 'PCOS_ONLY';
  }
  else if (s.thyroid('Hypothyroidism') || s.hormonal('Thyroid'))           dominantKey = 'THYROID_HYPO';
  else if (s.thyroid('Hyperthyroidism'))                                     dominantKey = 'THYROID_HYPER';
  else if (s.thyroid('Diabetes') || s.thyroid('Pre diabetes'))              dominantKey = 'DIABETES';
  else if (s.hormonal('Endometriosis'))                                      dominantKey = 'ENDOMETRIOSIS';
  else {
    // Check for AGA signals — regrow goal does not erase androgenetic pattern loss
    const hasAGAsignals =
      s.hairtype('Thinning') || s.hairtype('widening') || s.hairtype('parting') ||
      s.cause('Genetics') || s.cause('Family history') ||
      s.scalp('Dandruff') || s.scalp('Oily') ||
      age > 30 || s.lifestyle('Bodybuilding') || s.lifestyle('Heavy gym');

    if (hasAGAsignals) {
      dominantKey = isMale
        ? (isGrade45 ? 'AGA_MALE_45'   : 'AGA_MALE_123')
        : (isGrade45 ? 'AGA_FEMALE_45' : 'AGA_FEMALE_123');
    }
  }

  return singleDominantScore(dominantKey, 92);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function singleDominantScore(
  dominant: DiagnosisKey,
  topScore: number,
): ScoredConditionResult {
  return {
    dominant,
    topScore,
    secondary: [],
    allScores: { [dominant]: topScore },
  };
}
