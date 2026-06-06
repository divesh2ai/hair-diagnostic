/**
 * Conditions Knowledge Base — Registry Index
 *
 * Aggregates all condition entries into a typed registry.
 * Add new condition files here as KB is expanded.
 *
 * TODO: Add entries for remaining DiagnosisKey values:
 *   TE_POSTPREG, TE_DELIVERY, TE_ILLNESS,
 *   THYROID_HYPO, THYROID_HYPER,
 *   PCOS_ONLY, PCOS_OBESITY,
 *   PERI_MENOPAUSE, MENOPAUSE, POST_MENOPAUSE,
 *   IRON_DEFICIENCY, ALOPECIA_AREATA, PREGNANCY,
 *   WEIGHT_LOSS, GUT_ISSUES, SCALP_INFLAM, HAIR_BREAKAGE,
 *   OXIDATIVE, NIGHT_SHIFT, FREQUENT_FLYING, DIABETES,
 *   CHRONIC_MEDICAL, TTM, ENDOMETRIOSIS, EARLY_GREY,
 *   MOUTH_ULCERS, MULTI, REGROW_ONLY
 */

import type { ConditionKnowledgeRegistry } from '../../types';
import { FEMALE_AGA_123, FEMALE_AGA_45 } from './female_aga';
import { MALE_AGA_123, MALE_AGA_45 } from './male_aga';
import { TE_STRESS, TE_NUTRITION } from './telogen_effluvium';
import { ALOPECIA_AREATA } from './alopecia_areata';

export const CONDITIONS_KB: ConditionKnowledgeRegistry = {
  AGA_FEMALE_123: FEMALE_AGA_123,
  AGA_FEMALE_45: FEMALE_AGA_45,
  AGA_MALE_123: MALE_AGA_123,
  AGA_MALE_45: MALE_AGA_45,
  TE_STRESS: TE_STRESS,
  TE_NUTRITION: TE_NUTRITION,
  ALOPECIA_AREATA: ALOPECIA_AREATA,
  // TODO: TE_POSTPREG — post-pregnancy telogen effluvium entry
  // TODO: TE_DELIVERY — delivery-related TE entry
  // TODO: TE_ILLNESS — illness-triggered TE entry
  // TODO: THYROID_HYPO — hypothyroid hair loss entry
  // TODO: THYROID_HYPER — hyperthyroid hair loss entry
  // TODO: PCOS_ONLY — PCOS-driven AGA without obesity entry
  // TODO: PCOS_OBESITY — PCOS with obesity entry
  // TODO: PERI_MENOPAUSE — perimenopause hair loss entry
  // TODO: MENOPAUSE — menopause hair loss entry
  // TODO: POST_MENOPAUSE — post-menopause hair loss entry
  // TODO: IRON_DEFICIENCY — isolated iron deficiency entry
  // TODO: ALOPECIA_AREATA — autoimmune alopecia areata entry
  // TODO: PREGNANCY — pregnancy hair changes entry
  // TODO: WEIGHT_LOSS — GLP-1 / rapid weight loss entry
  // TODO: GUT_ISSUES — gut malabsorption entry
  // TODO: SCALP_INFLAM — scalp inflammation entry
  // TODO: HAIR_BREAKAGE — structural hair breakage entry
  // TODO: OXIDATIVE — oxidative stress hair loss entry
  // TODO: NIGHT_SHIFT — circadian disruption entry
  // TODO: FREQUENT_FLYING — travel stress entry
  // TODO: DIABETES — metabolic hair loss entry
  // TODO: CHRONIC_MEDICAL — chronic medical condition entry
  // TODO: TTM — trichotillomania entry
  // TODO: ENDOMETRIOSIS — endometriosis-related entry
  // TODO: EARLY_GREY — premature greying entry
  // TODO: MOUTH_ULCERS — autoimmune marker entry
  // TODO: MULTI — multi-factorial entry
  // TODO: REGROW_ONLY — regrowth goal entry
} as const;
