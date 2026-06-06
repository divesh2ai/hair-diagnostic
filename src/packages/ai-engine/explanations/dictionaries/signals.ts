import type { SignalDictionary } from '../types';

// Explanations for every RootCause variant.
// clinical → prescriber-facing; patient → plain language, empathetic.
export const SIGNAL_EXPLANATIONS: SignalDictionary = {
  STRESS: {
    clinical:
      'Psychosocial stress-induced telogen phase acceleration. Elevated cortisol drives premature follicular regression and NF-kB mediated perifollicular inflammation.',
    patient:
      'Stress is pushing more hair follicles into the resting phase than normal, which leads to increased shedding.',
    severity: 'moderate',
    category: 'psychosocial',
  },

  DHT: {
    clinical:
      'Androgen-mediated follicular miniaturisation. 5α-reductase converts testosterone to DHT, which binds androgen receptors on susceptible follicles and drives progressive shaft diameter reduction.',
    patient:
      'A hormone called DHT is causing the hair follicles in certain areas of your scalp to gradually shrink, producing finer and shorter hair over time.',
    severity: 'high',
    category: 'hormonal',
  },

  GENETICS: {
    clinical:
      'Polygenic androgenetic predisposition confirmed by family history. AR gene polymorphisms elevate follicular sensitivity to circulating androgens.',
    patient:
      'Your family history suggests a genetic tendency towards pattern hair loss. This is very common and responds well to the right treatment strategy.',
    severity: 'moderate',
    category: 'genetic',
  },

  IRON_DEFICIENCY: {
    clinical:
      'Iron-deficiency anaemia driving telogen effluvium. Depleted serum ferritin impairs haemoglobin-mediated oxygen delivery to follicular matrix cells, prolonging telogen dwell time.',
    patient:
      'Low iron levels are starving your hair follicles of the oxygen and nutrients they need to stay in the growth phase, causing increased shedding.',
    severity: 'high',
    category: 'nutritional',
  },

  HYPOTHYROID: {
    clinical:
      'Hypothyroid-associated diffuse alopecia. Insufficient T3/T4 reduces follicular basal metabolic rate, shortens anagen duration, and elevates TSH-driven systemic inflammation.',
    patient:
      'An underactive thyroid is slowing your body\'s metabolism, which reduces the energy available to hair follicles for sustained growth.',
    severity: 'high',
    category: 'endocrine',
  },

  HYPERTHYROID: {
    clinical:
      'Hyperthyroid-driven oxidative follicular stress. Excess thyroid hormone accelerates cellular turnover, elevates reactive oxygen species burden, and destabilises follicular keratinocyte cycling.',
    patient:
      'An overactive thyroid is placing your body in a state of excessive metabolic activity, which disrupts the balanced hormonal environment hair follicles need.',
    severity: 'high',
    category: 'endocrine',
  },

  PCOS: {
    clinical:
      'PCOS-associated hyperandrogenism. Elevated DHEAS and free testosterone drive scalp follicular miniaturisation and increased sebum via 5α-reductase activity, compounded by LH/FSH dysregulation.',
    patient:
      'Hormonal imbalances related to PCOS are making your hair follicles sensitive to androgens, which leads to thinning across the crown and temples.',
    severity: 'high',
    category: 'hormonal',
  },

  METABOLIC: {
    clinical:
      'Insulin resistance-mediated androgenisation. Hyperinsulinaemia upregulates ovarian androgen synthesis and suppresses SHBG, amplifying free androgen bioavailability at the follicular level.',
    patient:
      'Metabolic imbalances — including blood sugar irregularities — are indirectly raising the hormone levels that cause hair thinning.',
    severity: 'moderate',
    category: 'metabolic',
  },

  POOR_NUTRITION: {
    clinical:
      'Micronutrient deficiency pattern. Insufficient biotin, zinc, selenium, iron, or essential amino acids impairs keratin synthesis and disrupts normal follicular cycling.',
    patient:
      'Your diet may be lacking key nutrients that your hair follicles depend on to produce healthy, strong hair.',
    severity: 'moderate',
    category: 'nutritional',
  },

  POST_PARTUM: {
    clinical:
      'Post-partum synchronised telogen effluvium. Pregnancy-maintained supraphysiological oestrogen collapses post-delivery, causing widespread follicular shift from anagen to telogen.',
    patient:
      'The rapid hormonal shift after childbirth is causing a temporary but significant shedding phase as your body readjusts. This is very common and reversible.',
    severity: 'high',
    category: 'hormonal',
  },

  GUT_MALABSORPTION: {
    clinical:
      'Intestinal malabsorption syndrome reducing bioavailability of hair-critical micronutrients (Fe, Zn, B12, folate, selenium). Gut dysbiosis may further amplify systemic inflammatory cytokines.',
    patient:
      'Your gut health is affecting how well your body absorbs the nutrients essential for healthy hair growth, creating a nutritional gap at the follicle level.',
    severity: 'moderate',
    category: 'gastrointestinal',
  },

  OXIDATIVE_STRESS: {
    clinical:
      'Elevated systemic ROS burden causing follicular DNA damage, lipid peroxidation of sebaceous lipids, and impaired superoxide dismutase/catalase activity in the follicular environment.',
    patient:
      'Free radical damage from lifestyle factors is weakening your hair follicles and accelerating their aging process, reducing their ability to produce healthy hair.',
    severity: 'moderate',
    category: 'oxidative',
  },

  MEDICATION: {
    clinical:
      'Drug-induced alopecia. Medication-triggered telogen or anagen effluvium depending on mechanism of action, with onset typically 2–4 months post-initiation for telogen-type drugs.',
    patient:
      'Certain medications you are taking may be affecting your hair growth cycle as a known side effect. This is often reversible once the medication is adjusted or completed.',
    severity: 'moderate',
    category: 'iatrogenic',
  },

  ILLNESS: {
    clinical:
      'Post-illness telogen synchronisation. Systemic physiological stress during acute illness — fever, metabolic disruption, inflammatory cascade — triggers diffuse follicular shift to telogen.',
    patient:
      'A recent illness has temporarily disrupted your hair growth cycle. Hair loss from illness typically appears 2–3 months after recovery and is reversible.',
    severity: 'moderate',
    category: 'systemic',
  },

  RAPID_WEIGHT_LOSS: {
    clinical:
      'Caloric restriction or GLP-1 agonist-driven rapid weight loss triggering nutritional TE. IGF-1 suppression, protein catabolism, and ferritin depletion collectively impair anagen maintenance.',
    patient:
      'Rapid weight loss has temporarily reduced the nutritional supply your hair follicles need, triggering a shedding response that can be protected against.',
    severity: 'high',
    category: 'nutritional',
  },

  AUTOIMMUNE: {
    clinical:
      'Autoimmune-mediated follicular immune privilege collapse. CD8+ T-lymphocyte infiltration around the follicular bulb disrupts the immune barrier, causing perifollicular inflammation and follicular regression.',
    patient:
      'Your immune system is temporarily misdirecting its activity against your own hair follicles, causing patchy or diffuse hair loss that responds well to immune-modulatory treatment.',
    severity: 'high',
    category: 'immune',
  },

  CIRCADIAN_DISRUPTION: {
    clinical:
      'Shift work or chronic jet lag-induced circadian desynchrony. Melatonin suppression, cortisol rhythm inversion, and disrupted nocturnal growth hormone pulsatility impair follicular anagen maintenance.',
    patient:
      'Disrupted sleep and body-clock patterns are affecting the hormonal signals your hair follicles depend on for healthy growth cycles.',
    severity: 'moderate',
    category: 'circadian',
  },

  TRICHOTILLOMANIA: {
    clinical:
      'Compulsive hair-pulling disorder causing repetitive mechanical follicular trauma. Chronic avulsion at the bulb level leads to progressive follicular scarring and OCD-driven irregular loss pattern.',
    patient:
      'The compulsive urge to pull hair is causing physical damage to your follicles. The right neurological and recovery support can address both the urge and the follicle repair.',
    severity: 'high',
    category: 'neurological',
  },

  HORMONAL_SHIFT: {
    clinical:
      'Transitional hormonal state — peri/post-menopausal decline or endocrine shift. Declining oestrogen reduces follicular anti-androgenic protection, unmasking latent androgenetic susceptibility.',
    patient:
      'Hormonal changes in your body are reducing the natural protection your hair has had, making follicles more responsive to thinning-related hormones.',
    severity: 'moderate',
    category: 'hormonal',
  },
};
