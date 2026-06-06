import type { LifestyleDictionary } from '../types';

// Explanations for lifestyle factors derived from PatientAnswers.lifestyle[].
// Keys match the string values expected from the questionnaire engine.
export const LIFESTYLE_EXPLANATIONS: LifestyleDictionary = {

  smoking: {
    clinical:
      'Chronic tobacco exposure elevates systemic ROS, reduces follicular microcirculation via vasoconstriction, and accelerates follicular senescence through nicotine-mediated angiogenesis impairment.',
    patient:
      'Smoking reduces blood flow to your scalp and creates free radical damage that ages your hair follicles prematurely.',
    severity: 'high',
    category: 'oxidative',
  },

  alcohol: {
    clinical:
      'Chronic alcohol consumption depletes zinc, B-group vitamins, folic acid, and protein reserves; elevates pro-inflammatory cytokines; and impairs hepatic metabolism of hair-supporting micronutrients.',
    patient:
      'Regular alcohol intake is depleting key nutrients your hair needs and creating systemic inflammation that affects follicle health.',
    severity: 'moderate',
    category: 'nutritional',
  },

  vaping: {
    clinical:
      'E-cigarette aerosol delivers reactive carbonyl species and heavy metal nanoparticles that generate localised oxidative follicular stress and compromise scalp microvasculature.',
    patient:
      'Vaping introduces oxidative compounds that damage hair follicles and impair scalp circulation.',
    severity: 'moderate',
    category: 'oxidative',
  },

  night_shift: {
    clinical:
      'Shift-work sleep disorder drives cortisol rhythm inversion, melatonin suppression, and growth hormone pulsatility disruption — all of which impair anagen phase maintenance.',
    patient:
      'Working night shifts inverts the hormonal rhythms your hair follicles rely on for their normal growth cycle.',
    severity: 'moderate',
    category: 'circadian',
  },

  frequent_flying: {
    clinical:
      'Transmeridian travel induces circadian desynchrony, transient immune suppression, and low-level cosmic radiation-driven oxidative stress — compounding follicular vulnerability.',
    patient:
      'Frequent flying disrupts your body clock and temporarily suppresses your immune system, both of which affect hair health.',
    severity: 'low',
    category: 'circadian',
  },

  sedentary: {
    clinical:
      'Physical inactivity reduces IGF-1 production, promotes insulin resistance, impairs scalp microcirculation, and lowers SHBG — collectively suppressive to anagen maintenance.',
    patient:
      'A sedentary lifestyle reduces the metabolic signals and blood flow to the scalp that support healthy hair growth.',
    severity: 'moderate',
    category: 'metabolic',
  },

  bodybuilding: {
    clinical:
      'High-intensity resistance training combined with anabolic supplementation (creatine, exogenous testosterone, DHEA) elevates free testosterone and DHEAS, driving 5α-reductase-mediated miniaturisation.',
    patient:
      'Intense bodybuilding or anabolic supplementation may be raising hormone levels that can contribute to follicular thinning in susceptible individuals.',
    severity: 'moderate',
    category: 'hormonal',
  },

  high_stress: {
    clinical:
      'Chronic psychosocial stress sustains cortisol and substance P elevation, driving NF-kB-mediated perifollicular inflammation and premature telogen phase acceleration.',
    patient:
      'Ongoing high stress continually triggers the hormonal response that pushes more hair follicles into the shedding phase.',
    severity: 'high',
    category: 'psychosocial',
  },

  poor_sleep: {
    clinical:
      'Chronic sleep deprivation suppresses nocturnal GH pulsatility, elevates IL-6 and CRP, and reduces melatonin-mediated antioxidant protection at the follicular bulge.',
    patient:
      'Poor sleep is reducing the growth hormones and repair signals your hair follicles depend on during the night recovery window.',
    severity: 'moderate',
    category: 'circadian',
  },

  vegetarian: {
    clinical:
      'Lacto-ovo vegetarian diet increases risk of non-haem iron bioavailability insufficiency, zinc depletion, and incomplete amino acid profiles unless actively managed.',
    patient:
      'A vegetarian diet may require careful attention to key nutrients — particularly iron, zinc, and protein — that are directly linked to hair growth.',
    severity: 'low',
    category: 'nutritional',
  },

  vegan: {
    clinical:
      'Strict vegan diet creates elevated risk of B12, D3, omega-3 (EPA/DHA), haem-iron equivalent, zinc, and complete amino acid deficiency — all critical for follicular anagen maintenance.',
    patient:
      'A vegan diet requires careful supplementation planning to ensure your hair follicles receive every nutrient they need, especially B12, iron, and protein.',
    severity: 'moderate',
    category: 'nutritional',
  },

  crash_diet: {
    clinical:
      'Severe caloric restriction triggers nutritional TE within 3–6 months via IGF-1 suppression, protein catabolism for gluconeogenesis, and rapid depletion of ferritin and zinc stores.',
    patient:
      'Crash dieting triggers a shedding response as your body redirects its limited resources away from hair growth toward vital functions.',
    severity: 'high',
    category: 'nutritional',
  },

  glp1_medication: {
    clinical:
      'GLP-1 receptor agonist use drives nutritional TE through appetite suppression-mediated protein and micronutrient intake reduction; risk correlates with rate of weight loss.',
    patient:
      'GLP-1 weight-loss medication suppresses appetite in a way that can limit the essential nutrients your hair follicles need to stay healthy.',
    severity: 'high',
    category: 'iatrogenic',
  },

  hard_water: {
    clinical:
      'Chronic hard water exposure deposits calcium and magnesium carbonate on the hair shaft, increasing surface roughness, reducing tensile strength, and contributing to mid-shaft fracture.',
    patient:
      'Hard water is depositing minerals on your hair that weaken the shaft over time, leading to breakage and a rough texture.',
    severity: 'low',
    category: 'structural',
  },

  heat_styling: {
    clinical:
      'Repeated thermal stress (>150°C) denatures cortical keratin proteins, disrupts disulphide bond integrity, and damages the cuticle layer, predisposing to mid-shaft fracture.',
    patient:
      'Frequent heat styling at high temperatures is damaging the protein structure of your hair, making it brittle and prone to breaking.',
    severity: 'low',
    category: 'structural',
  },

  chemical_processing: {
    clinical:
      'Alkaline bleaching and chemical relaxer treatments disrupt disulphide bonds and strip intercellular lipids, severely compromising cortical fibre integrity and increasing fracture risk.',
    patient:
      'Chemical treatments such as bleaching or relaxers are weakening your hair\'s structural proteins, making breakage much more likely.',
    severity: 'moderate',
    category: 'structural',
  },
};
