import type { DiagnosisKey } from '../../../types';
import type { ScoreAccumulator } from '../types';
import type { SignalHelper } from '../signals';

// AGA base score is 65 — lower than hormonal (98), thyroid (100), TTM (102).
// This ensures PERI/MENOPAUSE/THYROID always wins when also selected.
export function applyAgaScores(
  s: SignalHelper,
  acc: ScoreAccumulator,
  age: number,
  isMale: boolean,
  isGrade45: boolean,
  count: string,
  duration: string
): void {
  const hasAGASignals =
    count.toLowerCase().includes('thinning') ||
    count.toLowerCase().includes('no visible fall') ||
    s.hairtype('Thinning') || s.hairtype('widening') || s.hairtype('parting') ||
    s.cause('Genetics') || s.cause('Family history') ||
    s.scalp('Dandruff') || s.scalp('Oily') ||
    s.lifestyle('Bodybuilding') || s.lifestyle('Heavy gym') ||
    duration.includes('6–12') || duration.includes('More than');

  if (hasAGASignals || age > 30) {
    let agaScore = hasAGASignals ? 65 : 45;
    if (age > 30) agaScore += 5; // age modifier per Excel row 65

    const agaKey: DiagnosisKey = isMale
      ? (isGrade45 ? 'AGA_MALE_45'   : 'AGA_MALE_123')
      : (isGrade45 ? 'AGA_FEMALE_45' : 'AGA_FEMALE_123');

    acc[agaKey] = (acc[agaKey] ?? 0) + agaScore;
  }
}

// Rule 1A boost: FPHL + PCOS + Rapid Weight Loss co-existing → boost FPHL above PCOS.
// Must run AFTER base scoring to avoid chicken-and-egg dependency.
export function applyRule1ABoost(acc: ScoreAccumulator): void {
  const hasFPHL  = (acc['AGA_FEMALE_123'] ?? 0) > 0 || (acc['AGA_FEMALE_45'] ?? 0) > 0;
  const hasPCOS  = (acc['PCOS_ONLY'] ?? 0) > 0 || (acc['PCOS_OBESITY'] ?? 0) > 0;
  const hasWLoss = (acc['WEIGHT_LOSS'] ?? 0) > 0;

  if (hasFPHL && hasPCOS && hasWLoss) {
    const key: DiagnosisKey =
      (acc['AGA_FEMALE_45'] ?? 0) > 0 ? 'AGA_FEMALE_45' : 'AGA_FEMALE_123';
    acc[key] = (acc[key] ?? 0) + 95; // lift above PCOS (92) and WEIGHT_LOSS (90)
  }
}
