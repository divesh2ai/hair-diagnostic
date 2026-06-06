/**
 * Topicals Knowledge Base — Registry Index
 *
 * TODO: Add entries for:
 *   minoxidil_2pct, minoxidil_spironolactone_combo,
 *   dutasteride_topical, trichogain_serum, cr_serum,
 *   trichonourish_eva, fha_andro_plus, f_emugrow_mcrd,
 *   ketoconazole_growth_serum_combo
 */

import type { TopicalKnowledgeRegistry } from '../../types';
import {
  MINOXIDIL_5PCT,
  MINOXIDIL_FINASTERIDE_COMBO,
  KETOCONAZOLE_SHAMPOO,
} from './minoxidil_topicals';

export const TOPICALS_KB: TopicalKnowledgeRegistry = {
  minoxidil_5pct: MINOXIDIL_5PCT,
  minoxidil_finasteride_topical: MINOXIDIL_FINASTERIDE_COMBO,
  ketoconazole_shampoo_2pct: KETOCONAZOLE_SHAMPOO,
  // TODO: minoxidil_2pct — lower-dose for female-first line
  // TODO: minoxidil_spironolactone_combo — for females with androgenic pattern
  // TODO: dutasteride_topical — dutasteride 0.01% topical for advanced male AGA
  // TODO: trichogain_serum — peptide + redensyl growth serum
  // TODO: cr_serum — custom regenerating serum
  // TODO: trichonourish_eva — scalp nourishment formulation
  // TODO: fha_andro_plus — female hormonal alopecia formulation
  // TODO: f_emugrow_mcrd — dutasteride + redensyl + emu oil compound
} as const;
