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
  // Bare 'Menopause' hormonal option retired 2026-06-15 — no questionnaire path
  // produces this signal. MENOPAUSE score branch removed; PERI / POST handle
  // the menopause continuum.
  //
  // Use the menopause-specific substrings only — bare 'peri' would collide with
  // "Heavy bleeding periods" (locked rule 2026-06-15).
  const hasPeri =
    s.hormonal('Peri-menopause') || s.hormonal('Peri menopause') ||
    s.hormonal('Perimenopause')   || s.hormonal('Peri-Menopause');
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
  // Mutually exclusive feeding states from the cause step (questionnaire uses
  // "still feeding" / "not feeding" — NOT "breastfeeding"). Hormonal step uses
  // "Post-delivery or breastfeeding" which is implicitly the still-feeding path.
  //
  //   Explicit "not feeding"                 → TE_DELIVERY
  //   "Post partum — still feeding" OR
  //     "Post-delivery or breastfeeding"      → TE_POSTPREG (LACTIHEALTH path)
  //   Bare "Post partum" with no qualifier    → TE_POSTPREG (default to feeding;
  //                                              safer to include LACTIHEALTH)
  const postPartumCause       = s.cause('Post partum');
  const explicitlyNotFeeding  = s.cause('not feeding');
  const explicitlyStillFeeding =
    s.cause('still feeding') || s.hormonal('breastfeeding') || s.hormonal('Post-delivery');

  if (postPartumCause && explicitlyNotFeeding) {
    acc['TE_DELIVERY'] = (acc['TE_DELIVERY'] ?? 0) + 90;
  } else if (postPartumCause || explicitlyStillFeeding) {
    acc['TE_POSTPREG'] = (acc['TE_POSTPREG'] ?? 0) + 92;
  }
}
