import type { PatientAnswers } from '../../../types';
import type { ScoreAccumulator } from '../types';
import { signals } from '../signals';

// Thyroid, diabetes, iron deficiency, rapid weight loss / GLP-1 scoring.
// Diabetes is scored 90 (above chronic medical 80) — insulin resistance drives
// androgen amplification → follicle miniaturisation.
export function applyMetabolicScores(ans: PatientAnswers, acc: ScoreAccumulator): void {
  const s = signals(ans);

  // ── Thyroid (100 — highest deterministic score) ───────────────────────────
  if (s.thyroid('Hypothyroidism') || s.hormonal('Thyroid')) {
    acc['THYROID_HYPO'] = (acc['THYROID_HYPO'] ?? 0) + 100;
  }
  if (s.thyroid('Hyperthyroidism')) {
    acc['THYROID_HYPER'] = (acc['THYROID_HYPER'] ?? 0) + 100;
  }

  // ── Diabetes / Pre-diabetes (90) ─────────────────────────────────────────
  if (s.thyroid('Pre diabetes') || s.thyroid('Diabetes')) {
    acc['DIABETES'] = (acc['DIABETES'] ?? 0) + 90;
  } else if (ans.medical?.includes('Yes')) {
    acc['CHRONIC_MEDICAL'] = (acc['CHRONIC_MEDICAL'] ?? 0) + 80;
  }

  // ── Iron deficiency (80) ─────────────────────────────────────────────────
  if (s.deficiency('Iron') || s.deficiency('Anaemia')) {
    acc['IRON_DEFICIENCY'] = (acc['IRON_DEFICIENCY'] ?? 0) + 80;
  }

  // ── GLP-1 / crash diet / rapid weight loss ───────────────────────────────
  // GLP-1 Early: RAPID WEIGHT LOSS SHIELD is Kit 1 (scored 90 = dominant)
  // GLP-1 Late:  acute shedding peak passed; TE GOLD leads — also inject TE_STRESS at 50
  const hasGLP1Early = (ans.cause ?? []).some((c) => c.includes('within 6 months'));
  const hasGLP1Late  = (ans.cause ?? []).some((c) => c.includes('after 6 months'));
  const hasCrashDiet =
    s.cause('GLP-1') || s.cause('GLP1') || s.cause('crash diet') ||
    s.cause('Post crash') || s.diet('Crash') || s.diet('Keto');

  if (hasGLP1Early || hasGLP1Late || hasCrashDiet) {
    acc['WEIGHT_LOSS'] = (acc['WEIGHT_LOSS'] ?? 0) + 90;
  }
  if (hasGLP1Late) {
    acc['TE_STRESS'] = (acc['TE_STRESS'] ?? 0) + 50;
  }
}
