import { NormalizedClinicalProfile } from './types';

// ─── Internal helpers ─────────────────────────────────────────────────────────
// Normalise a raw answer value to a lower-cased, newline-stripped string.
// Option values in the DrFACT JSON schema contain embedded \n characters;
// stripping them makes substring matching safe.
function normalise(v: unknown): string {
  return String(v ?? '').replace(/\n/g, ' ').toLowerCase().trim();
}

// Return raw answer as a normalised string array (handles both single values
// and multi-select arrays submitted by the form).
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(normalise);
  if (v != null && String(v).trim() !== '') return [normalise(v)];
  return [];
}

// Push a signal only if it is not already present (prevents duplicates on
// multi-select answers that trigger the same rule twice).
function pushOnce(arr: string[], signal: string): void {
  if (!arr.includes(signal)) arr.push(signal);
}

// ─── Main normaliser ──────────────────────────────────────────────────────────
/**
 * Maps the current DrFACT questionnaire submission (schema question IDs) to a
 * NormalizedClinicalProfile.
 *
 * Current schema question IDs (from questionnaire.schema.json):
 *   name, age, goal, sex, duration, count, hairtype, scalp, cause,
 *   immunity, lifestyle, thyroid, medical, medical_detail, hormonal,
 *   gut, deficiency, diet, treatment, grade, extra
 *
 * The previous implementation used legacy keys (q5_hairfall_severity,
 * q6_thinning_pattern, …) that no longer exist in the live protocol, causing
 * every signal array to remain empty on every submission.
 */
export function normalizeQuestionnaire(rawAnswers: Record<string, any>): NormalizedClinicalProfile {
  const profile: NormalizedClinicalProfile = {
    hairfallSeverity: 'NONE',
    sheddingPattern: 'UNKNOWN',
    inflammatorySignals: [],
    hormonalSignals: [],
    metabolicSignals: [],
    deficiencySignals: [],
    psychologicalSignals: [],
    lifestyleSignals: [],
    medicalHistory: [],
  };

  const countVal    = normalise(rawAnswers['count']);
  const gradeVal    = normalise(rawAnswers['grade']);
  const scalpArr    = asArray(rawAnswers['scalp']);
  const causeArr    = asArray(rawAnswers['cause']);
  const lifestyleArr = asArray(rawAnswers['lifestyle']);
  const thyroidArr  = asArray(rawAnswers['thyroid']);
  const hormonalArr = asArray(rawAnswers['hormonal']);
  const defArr      = asArray(rawAnswers['deficiency']);
  const immunityArr = asArray(rawAnswers['immunity']);
  const medVal      = normalise(rawAnswers['medical']);
  const medDetail   = normalise(rawAnswers['medical_detail']);

  // ── 1. Hairfall Severity ────────────────────────────────────────────────────
  // Primary: active daily shedding count (schema id: "count")
  if (countVal.includes('100+') || countVal.includes('heavy loss')) {
    profile.hairfallSeverity = 'SEVERE';
  } else if (countVal.includes('50') && countVal.includes('100')) {
    profile.hairfallSeverity = 'LOW';
  } else if (countVal.includes('just thinning') || countVal.includes('no visible fall')) {
    profile.hairfallSeverity = 'LOW';
  }

  // Secondary: structural grade (schema id: "grade") — can escalate severity
  if (gradeVal.includes('grade 5') || gradeVal.includes('grade 4')) {
    if (['NONE', 'LOW', 'MODERATE'].includes(profile.hairfallSeverity)) profile.hairfallSeverity = 'SEVERE';
  } else if (gradeVal.includes('grade 3')) {
    if (['NONE', 'LOW'].includes(profile.hairfallSeverity)) profile.hairfallSeverity = 'MODERATE';
  } else if (gradeVal.includes('grade 2')) {
    if (profile.hairfallSeverity === 'NONE') profile.hairfallSeverity = 'LOW';
  } else if (gradeVal.includes('grade 1')) {
    if (profile.hairfallSeverity === 'NONE') profile.hairfallSeverity = 'LOW';
  }

  // ── 2. Shedding Pattern ─────────────────────────────────────────────────────
  if (countVal.includes('just thinning') || countVal.includes('no visible fall')) {
    profile.sheddingPattern = 'PARTITION';
  } else if (gradeVal.includes('grade 4') || gradeVal.includes('grade 5')) {
    profile.sheddingPattern = 'CROWN';
  } else if (gradeVal.includes('grade 1') || gradeVal.includes('grade 2')) {
    profile.sheddingPattern = 'FRONTAL';
  } else if (gradeVal.includes('grade 3')) {
    profile.sheddingPattern = 'DIFFUSE';
  } else if (gradeVal !== '') {
    profile.sheddingPattern = 'DIFFUSE';
  }

  // ── 3. Inflammatory Signals — from scalp (schema id: "scalp") ───────────────
  for (const s of scalpArr) {
    if (s.includes('dandruff') && !s.includes('oily') && !s.includes('itching')) {
      pushOnce(profile.inflammatorySignals, 'DRY_DANDRUFF');
    }
    if (s.includes('dandruff') && (s.includes('oily') || s.includes('itching'))) {
      pushOnce(profile.inflammatorySignals, 'OILY_DANDRUFF');
    }
    if (s.includes('oily scalp')) {
      pushOnce(profile.inflammatorySignals, 'OILY_SCALP');
    }
    if (s.includes('redness') || s.includes('irritation')) {
      pushOnce(profile.inflammatorySignals, 'SEVERE_INFLAMMATION');
    }
    if (s.includes('psoriasis') || s.includes('inflammation')) {
      pushOnce(profile.inflammatorySignals, 'SEVERE_INFLAMMATION');
    }
    if (s.includes('burning')) {
      pushOnce(profile.inflammatorySignals, 'SEVERE_INFLAMMATION');
    }
    if (s.includes('boils') || s.includes('pimples')) {
      pushOnce(profile.inflammatorySignals, 'SEVERE_INFLAMMATION');
    }
  }
  // Autoimmune — from immunity (schema id: "immunity")
  for (const i of immunityArr) {
    if (i.includes('alopecia areata')) pushOnce(profile.inflammatorySignals, 'ALOPECIA_AREATA');
    if (i.includes('scarring alopecia')) pushOnce(profile.medicalHistory, 'SCARRING_ALOPECIA');
    if (i.includes('psoriasis') || i.includes('eczema') || i.includes('skin rashes')) {
      pushOnce(profile.inflammatorySignals, 'AUTOIMMUNE_SKIN');
    }
  }

  // ── 4. Psychological Signals — from cause + lifestyle ───────────────────────
  if (causeArr.some(c => c.includes('stress') || c.includes('anxiety') || c.includes('depression'))) {
    pushOnce(profile.psychologicalSignals, 'HIGH_STRESS');
  }
  if (lifestyleArr.some(l => l.includes('night shift') || l.includes('frequent flying'))) {
    pushOnce(profile.psychologicalSignals, 'MODERATE_STRESS');
  }

  // ── 5. Metabolic Signals — from thyroid + lifestyle ─────────────────────────
  for (const t of thyroidArr) {
    if (t.includes('hypothyroid') || t.includes('hyperthyroid')) {
      pushOnce(profile.metabolicSignals, 'THYROID_IMBALANCE');
    }
    if (t.includes('diabetes') || t.includes('pre diabetes') || t.includes('pre-diabetes')) {
      pushOnce(profile.metabolicSignals, 'INSULIN_RESISTANCE');
    }
  }
  if (lifestyleArr.some(l => l.includes('obesity') || l.includes('sedentary') || l.includes('gaining weight'))) {
    pushOnce(profile.metabolicSignals, 'INSULIN_RESISTANCE');
  }

  // ── 6. Medical History — from medical + cause ────────────────────────────────
  if (medVal.includes('yes') || medVal.includes('medication')) {
    pushOnce(profile.medicalHistory, 'CHRONIC_MEDICATION');
    if (medDetail.trim()) {
      profile.medicalHistory.push(`CONDITION_${medDetail.substring(0, 32).toUpperCase().replace(/[\s/,]+/g, '_')}`);
    }
  }
  for (const c of causeArr) {
    if (c.includes('medication') || c.includes('illness') || c.includes('surgery')) {
      pushOnce(profile.medicalHistory, 'RECENT_ILLNESS_OR_SURGERY');
    }
    if (c.includes('glp-1') || c.includes('glp1') || c.includes('ozempic')) {
      pushOnce(profile.medicalHistory, 'GLP1_USE');
    }
    if (c.includes('post partum') || c.includes('postpartum') || c.includes('breastfeeding')) {
      pushOnce(profile.medicalHistory, 'POSTPARTUM');
    }
    if (c.includes('crash diet')) {
      pushOnce(profile.medicalHistory, 'CRASH_DIET_HISTORY');
    }
  }

  // ── 7. Deficiency Signals — from deficiency (schema id: "deficiency") ────────
  for (const d of defArr) {
    if (d.includes('iron') || d.includes('anaemia') || d.includes('anemia')) {
      pushOnce(profile.deficiencySignals, 'IRON');
    }
    if (d.includes('vitamin d') || d.includes('vit d') || d.includes('d3')) {
      pushOnce(profile.deficiencySignals, 'VITAMIN_D');
    }
    if (d.includes('vitamin b12') || d.includes('vit b12') || d.includes('b12')) {
      pushOnce(profile.deficiencySignals, 'VITAMIN_B12');
    }
  }

  // ── 8. Hormonal Signals — from hormonal + cause (schema id: "hormonal") ───────
  for (const h of hormonalArr) {
    if (h.includes('pcos') || h.includes('pcod')) {
      pushOnce(profile.hormonalSignals, 'PCOS');
    }
    if (h.includes('endometriosis')) {
      pushOnce(profile.hormonalSignals, 'ENDOMETRIOSIS');
    }
    if (h.includes('currently pregnant')) {
      pushOnce(profile.hormonalSignals, 'PREGNANCY_STATUS_PREGNANT');
    }
    if (h.includes('post-delivery') || h.includes('breastfeeding')) {
      pushOnce(profile.hormonalSignals, 'PREGNANCY_STATUS_POSTPARTUM');
    }
    if (h.includes('peri-menopause') || h.includes('perimenopause')) {
      pushOnce(profile.hormonalSignals, 'PERI_MENOPAUSE');
    }
    if (h.includes('post-menopause')) {
      pushOnce(profile.hormonalSignals, 'POST_MENOPAUSE');
    } else if (h.includes('menopause') && !h.includes('peri')) {
      pushOnce(profile.hormonalSignals, 'MENOPAUSE');
    }
    if (h.includes('hrt') || h.includes('hormone replacement')) {
      pushOnce(profile.hormonalSignals, 'HRT');
    }
  }
  // Postpartum cross-referenced from cause
  for (const c of causeArr) {
    if ((c.includes('post partum') || c.includes('postpartum')) &&
        !profile.hormonalSignals.includes('PREGNANCY_STATUS_POSTPARTUM')) {
      pushOnce(profile.hormonalSignals, 'PREGNANCY_STATUS_POSTPARTUM');
    }
  }

  // ── 9. Lifestyle Signals — from lifestyle (schema id: "lifestyle") ──────────
  for (const l of lifestyleArr) {
    if (l.includes('smoking') || l.includes('vaping')) pushOnce(profile.lifestyleSignals, 'SMOKING');
    if (l.includes('alcohol'))                          pushOnce(profile.lifestyleSignals, 'ALCOHOL');
    if (l.includes('bodybuilding') || l.includes('heavy gym')) pushOnce(profile.lifestyleSignals, 'BODYBUILDING');
    if (l.includes('obesity') || l.includes('sedentary') || l.includes('gaining weight')) {
      pushOnce(profile.lifestyleSignals, 'OBESITY_SEDENTARY');
    }
    if (l.includes('erratic') || l.includes('outside eating')) pushOnce(profile.lifestyleSignals, 'POOR_DIET');
    if (l.includes('night shift'))     pushOnce(profile.lifestyleSignals, 'NIGHT_SHIFT');
    if (l.includes('frequent flying')) pushOnce(profile.lifestyleSignals, 'FREQUENT_FLYING');
  }
  if (causeArr.some(c => c.includes('crash diet'))) pushOnce(profile.lifestyleSignals, 'CRASH_DIET');

  return profile;
}
