/**
 * Ingredients Knowledge Base — Registry Index
 *
 * Aggregates every IngredientKnowledge owner. New ingredients are
 * authored in topic-bundled files and registered here.
 *
 * Coverage:
 *  • Existing canonical:        minoxidil family + micronutrients (8)
 *  • Adaptogens & sleep:        8 ingredients
 *  • Anti-inflammatories:       7 ingredients
 *  • Immune & structural:       13 ingredients
 *  • Androgen & metabolic:      15 ingredients
 * Total: 51 ingredients owned.
 */

import type { IngredientKnowledgeRegistry } from '../../types';

// Existing canonical owners
import { MINOXIDIL, FINASTERIDE, DUTASTERIDE, KETOCONAZOLE } from './minoxidil';
import { BIOTIN, ZINC, IRON_BISGLYCINATE, VITAMIN_D3 } from './micronutrients';

// Wave 1 — Adaptogens and sleep
import {
  ASHWAGANDHA,
  MELATONIN,
  L_THEANINE,
  L_TYROSINE,
  VALERIAN_ROOT,
  CHAMOMILE,
  TRYPTOPHAN,
  MAGNESIUM,
} from './adaptogens_sleep';

// Wave 2 — Anti-inflammatories and antioxidants
import {
  CURCUMIN,
  NAC,
  RESVERATROL,
  QUERCETIN,
  GREEN_TEA_EGCG,
  MUSHROOM_EXTRACT,
  OMEGA_3,
} from './anti_inflammatories';

// Wave 3 — Immune modulators, structural support, vascular/mitochondrial
import {
  LACTOFERRIN,
  COLOSTRUM,
  COQ10,
  NMN,
  PINE_BARK_EXTRACT,
  MSM,
  HORSETAIL_EXTRACT,
  NEM,
  BREWERS_YEAST,
  AMLA,
  LACTOBACILLUS,
  BIOPERINE,
  DIGESTIVE_ENZYMES,
} from './immune_structural';

// Wave 4 — Androgen modulators, hormonal, metabolic botanicals
import {
  BETA_SITOSTEROL,
  STINGING_NETTLE,
  GINSENG,
  MULBERRY_EXTRACT,
  MILK_THISTLE,
  MYO_INOSITOL,
  GARCINIA_CAMBOGIA,
  PUMPKIN_SEED_OIL,
  SPIRULINA,
  LYCOPENE,
  ARGININE,
  MORINGA_OLEIFERA,
  KELP_EXTRACT,
  FENUGREEK,
  GYMNEMA,
} from './androgen_metabolic';

export const INGREDIENTS_KB: IngredientKnowledgeRegistry = {
  // Existing canonical
  minoxidil: MINOXIDIL,
  finasteride: FINASTERIDE,
  dutasteride: DUTASTERIDE,
  ketoconazole: KETOCONAZOLE,
  biotin: BIOTIN,
  zinc: ZINC,
  iron_bisglycinate: IRON_BISGLYCINATE,
  vitamin_d3: VITAMIN_D3,

  // Adaptogens and sleep
  ashwagandha: ASHWAGANDHA,
  melatonin: MELATONIN,
  l_theanine: L_THEANINE,
  l_tyrosine: L_TYROSINE,
  valerian_root: VALERIAN_ROOT,
  chamomile: CHAMOMILE,
  tryptophan: TRYPTOPHAN,
  magnesium: MAGNESIUM,

  // Anti-inflammatories and antioxidants
  curcumin: CURCUMIN,
  nac: NAC,
  resveratrol: RESVERATROL,
  quercetin: QUERCETIN,
  green_tea_egcg: GREEN_TEA_EGCG,
  mushroom_extract: MUSHROOM_EXTRACT,
  omega_3: OMEGA_3,

  // Immune, structural, vascular
  lactoferrin: LACTOFERRIN,
  colostrum: COLOSTRUM,
  coq10: COQ10,
  nmn: NMN,
  pine_bark_extract: PINE_BARK_EXTRACT,
  msm: MSM,
  horsetail_extract: HORSETAIL_EXTRACT,
  nem: NEM,
  brewers_yeast: BREWERS_YEAST,
  amla: AMLA,
  lactobacillus: LACTOBACILLUS,
  bioperine: BIOPERINE,
  digestive_enzymes: DIGESTIVE_ENZYMES,

  // Androgen and metabolic
  beta_sitosterol: BETA_SITOSTEROL,
  stinging_nettle: STINGING_NETTLE,
  ginseng: GINSENG,
  mulberry_extract: MULBERRY_EXTRACT,
  milk_thistle: MILK_THISTLE,
  myo_inositol: MYO_INOSITOL,
  garcinia_cambogia: GARCINIA_CAMBOGIA,
  pumpkin_seed_oil: PUMPKIN_SEED_OIL,
  spirulina: SPIRULINA,
  lycopene: LYCOPENE,
  arginine: ARGININE,
  moringa_oleifera: MORINGA_OLEIFERA,
  kelp_extract: KELP_EXTRACT,
  fenugreek: FENUGREEK,
  gymnema: GYMNEMA,
} as const;
