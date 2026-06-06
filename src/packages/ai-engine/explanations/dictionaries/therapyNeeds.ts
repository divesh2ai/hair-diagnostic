import type { TherapyNeedDictionary } from '../types';

// Explanations for every TherapyNeed variant.
// All 19 variants are covered exhaustively.
export const THERAPY_NEED_EXPLANATIONS: TherapyNeedDictionary = {

  DHT_SUPPRESSION: {
    clinical:
      'Reduce 5α-reductase type II activity and AR sensitivity at the follicular level to halt DHT-mediated miniaturisation and slow progression of androgenetic alopecia.',
    patient:
      'Blocking the DHT hormone that is causing your follicles to shrink, to stop the thinning process from advancing.',
    severity: 'high',
    category: 'hormonal',
  },

  INFLAMMATION_CONTROL: {
    clinical:
      'Attenuate NF-kB/TNF-α/IL-6 perifollicular inflammatory signalling to restore the follicular microenvironment required for anagen phase initiation and maintenance.',
    patient:
      'Reducing scalp and systemic inflammation that is creating a hostile environment where healthy hair growth cannot occur.',
    severity: 'moderate',
    category: 'inflammatory',
  },

  FOLLICLE_STIMULATION: {
    clinical:
      'Drive follicular anagen re-entry via EGF, KGF, IGF-1, and WNT/β-catenin pathway upregulation to promote new terminal hair fibre production.',
    patient:
      'Waking up dormant hair follicles and encouraging them to produce new, healthy hair again.',
    severity: 'moderate',
    category: 'growth',
  },

  METABOLIC_SUPPORT: {
    clinical:
      'Correct insulin-AMPK pathway dysregulation and reduce hyperinsulinaemia to lower free androgen bioavailability, improve SHBG levels, and restore IGF-1 anagen signalling.',
    patient:
      'Correcting metabolic imbalances — including blood sugar irregularities — that are indirectly fuelling hormonal hair thinning.',
    severity: 'moderate',
    category: 'metabolic',
  },

  IMMUNE_MODULATION: {
    clinical:
      'Re-establish follicular immune privilege via regulatory T-cell (Treg) upregulation and IL-10-mediated perifollicular immune suppression to prevent autoimmune follicular attack.',
    patient:
      'Rebalancing your immune system so it stops interfering with healthy hair follicle function and supports the conditions for regrowth.',
    severity: 'high',
    category: 'immune',
  },

  IRON_REPLETION: {
    clinical:
      'Restore serum ferritin to a minimum of 70 ng/mL to optimise follicular matrix cell oxygen delivery and anagen phase maintenance in iron-deficiency TE.',
    patient:
      'Rebuilding iron stores so your hair follicles receive the oxygen-carrying support they need to stay in the growth phase.',
    severity: 'high',
    category: 'nutritional',
  },

  HORMONAL_REBALANCING: {
    clinical:
      'Restore oestrogen-to-androgen ratio and normalise LH/FSH dynamics to reduce androgenic follicular susceptibility and counteract oestrogen-decline-driven miniaturisation.',
    patient:
      'Restoring hormonal balance to reduce the impact of thinning-related hormones and protect follicles during hormonal transitions.',
    severity: 'high',
    category: 'hormonal',
  },

  ANTIOXIDANT_SUPPORT: {
    clinical:
      'Replenish superoxide dismutase, glutathione, and catalase activity to neutralise reactive oxygen species and protect follicular DNA and melanocyte integrity from oxidative damage.',
    patient:
      'Protecting your hair follicles and pigment cells from free radical damage that ages and weakens them prematurely.',
    severity: 'moderate',
    category: 'oxidative',
  },

  GUT_RESTORATION: {
    clinical:
      'Restore intestinal microbiome diversity and mucosal barrier integrity to optimise micronutrient bioavailability and reduce gut-driven systemic LPS-mediated inflammation.',
    patient:
      'Healing your gut so your body can properly absorb the nutrients your hair follicles depend on for healthy growth.',
    severity: 'moderate',
    category: 'gastrointestinal',
  },

  THYROID_SUPPORT: {
    clinical:
      'Support T3/T4 synthesis co-factors and enhance cellular thyroid receptor sensitivity to restore basal metabolic rate and follicular anagen competence.',
    patient:
      'Supporting thyroid function so your body\'s metabolism can sustainably power healthy hair growth cycles.',
    severity: 'high',
    category: 'endocrine',
  },

  CIRCADIAN_RESET: {
    clinical:
      'Restore melatonin secretion rhythm via circadian-synchronising compounds, normalise cortisol diurnal pattern, and re-synchronise nocturnal growth hormone pulsatility for follicular anagen maintenance.',
    patient:
      'Resetting your body clock to restore the hormonal rhythms that regulate your hair follicles\' growth cycles.',
    severity: 'moderate',
    category: 'circadian',
  },

  SHAFT_REPAIR: {
    clinical:
      'Restore cortical keratin cross-linking density, cuticle layer integrity, and intercellular lipid bilayer composition to prevent mid-shaft fracture and improve tensile resistance.',
    patient:
      'Repairing damaged hair fibres to restore their strength, smoothness, and resistance to breakage from external stressors.',
    severity: 'low',
    category: 'structural',
  },

  SHEDDING_ARREST: {
    clinical:
      'Stabilise active telogen effluvium by restoring follicular anagen phase duration through targeted micronutrient replenishment, anti-inflammatory support, and cortisol modulation.',
    patient:
      'Stopping the excessive daily shedding by providing your follicles with what they need to stay anchored in the growth phase.',
    severity: 'high',
    category: 'shedding',
  },

  LACTATION_SUPPORT: {
    clinical:
      'Address elevated lactational micronutrient demands — Fe, B12, iodine, zinc, DHA, folate — while strictly maintaining safety for both breastfeeding mother and infant.',
    patient:
      'Providing nutritional support specifically tailored to the increased demands of breastfeeding, while protecting your hair health throughout this period.',
    severity: 'moderate',
    category: 'maternal',
  },

  MELANOCYTE_PROTECTION: {
    clinical:
      'Protect melanocyte stem cells in the follicular bulge from oxidative apoptosis via copper-dependent tyrosinase support, catalase restoration, and PABA/B12/folic acid supplementation.',
    patient:
      'Protecting the pigment-producing cells in your follicles from the oxidative damage that drives premature greying.',
    severity: 'moderate',
    category: 'pigmentation',
  },

  ANDROGENIC_CORRECTION: {
    clinical:
      'Reduce androgen excess via inositol and D-chiro-inositol insulin sensitisation, spearmint-mediated 5α-reductase inhibition, and SHBG upregulation to lower free androgen activity.',
    patient:
      'Reducing the excess androgens that are causing hair thinning, using targeted plant-based hormonal balancers.',
    severity: 'high',
    category: 'hormonal',
  },

  NEUROLOGICAL_OCD_SUPPORT: {
    clinical:
      'Modulate OCD-spectrum compulsive behaviour via NAC (glutamate pathway), inositol (serotonin sensitisation), magnesium (NMDA receptor regulation), and B6 (GABA synthesis co-factor).',
    patient:
      'Supporting the neurological pathways involved in compulsive hair pulling to reduce the urge and create the conditions for follicle recovery.',
    severity: 'high',
    category: 'neurological',
  },

  WEIGHT_LOSS_RECOVERY: {
    clinical:
      'Mitigate GLP-1 agonist or caloric restriction-induced TE by replenishing protein status, ferritin, zinc, and IGF-1 precursors depleted during rapid weight loss.',
    patient:
      'Protecting and nourishing your hair follicles through the period of rapid weight change so they have the resources to stay healthy.',
    severity: 'high',
    category: 'nutritional',
  },

  PREGNANCY_SUPPORT: {
    clinical:
      'Provide pregnancy-safe micronutrient coverage: folate, iron, DHA, iodine, B12, calcium, and vitamin D3 at evidence-based prenatal dosing with full foetal safety profile.',
    patient:
      'Safely supporting your health and your baby\'s development with carefully selected pregnancy-safe nutrients.',
    severity: 'low',
    category: 'maternal',
  },
};
