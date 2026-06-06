import type { PatientAnswers } from '../../../types';
import type { ScoreAccumulator } from '../types';
import { signals } from '../signals';

// Scores menopause spectrum, PCOS, post-partum TE variants.
// Menopause/PCOS scores are 92–101 — they dominate AGA (65) and TE (55) correctly.
export function applyHormonalScores(ans: PatientAnswers, acc: ScoreAccumulator): void {
  const s = signals(ans);

  // ── Menopause spectrum (98) ───────────────────────────────────────────────
  if (s.hormonal('Post-menopause') || s.hormonal('Post menopause') || s.hormonal('Post-Menopause')) {
    acc['POST_MENOPAUSE'] = (acc['POST_MENOPAUSE'] ?? 0) + 98;
  }
  if (s.hormonal('Menopause') && !s.hormonal('Peri') && !s.hormonal('Post')) {
    acc['MENOPAUSE'] = (acc['MENOPAUSE'] ?? 0) + 98;
  }
  const hasPeri =
    s.hormonal('Peri-menopause') || s.hormonal('Peri menopause') ||
    s.hormonal('Perimenopause')   || s.hormonal('peri') || s.hormonal('Peri-Menopause');
  if (hasPeri) {
    acc['PERI_MENOPAUSE'] = (acc['PERI_MENOPAUSE'] ?? 0) + 98;
  }

  if (s.hormonal('Endometriosis')) {
    acc['ENDOMETRIOSIS'] = (acc['ENDOMETRIOSIS'] ?? 0) + 85;
  }

  // ── PCOS — 92 base; boosted to 101 when thyroid co-exists ────────────────
  if (s.hormonal('PCOS') || s.hormonal('PCOD')) {
    const pcosObese =
      s.hormonal('Obesity') || s.hormonal('PCOS / PCOD + Obesity') ||
      s.lifestyle('Obesity') || s.lifestyle('Sedentary') || s.lifestyle('weight');
    const key = pcosObese ? 'PCOS_OBESITY' : 'PCOS_ONLY';
    const thyroidCoExist =
      s.thyroid('Hypothyroidism') || s.hormonal('Thyroid disorder') || s.hormonal('Thyroid');
    acc[key] = (acc[key] ?? 0) + (thyroidCoExist ? 101 : 92);
  }

  // ── Post-partum TE ────────────────────────────────────────────────────────
  // Mutually exclusive: "not feeding" → TE_DELIVERY, else → TE_POSTPREG
  const postPartumNotFeeding =
    (s.cause('Post partum') && s.cause('not feeding')) ||
    (s.cause('Post partum') && !s.hormonal('breastfeeding') && !s.cause('breastfeed'));
  if (postPartumNotFeeding) {
    acc['TE_DELIVERY'] = (acc['TE_DELIVERY'] ?? 0) + 90;
  } else if (s.cause('Post partum') || s.hormonal('Post-delivery') || s.hormonal('breastfeeding')) {
    acc['TE_POSTPREG'] = (acc['TE_POSTPREG'] ?? 0) + 92;
  }
}
