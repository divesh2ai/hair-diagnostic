/**
 * Lifestyle Knowledge Base — Registry Index
 */

import type { LifestyleGuidanceKnowledge, LifestyleKnowledgeRegistry } from '../../types';

const NUTRITION_GUIDANCE: LifestyleGuidanceKnowledge = {
  guidanceId: 'nutrition_hair_foundation',
  category: 'NUTRITION',
  displayName: 'Nutritional Foundation for Hair Health',
  description:
    'Dietary and supplementation guidance to provide the macro- and micronutrient substrate ' +
    'required for optimal follicular function and hair shaft production.',
  relevantConditions: [
    'TE_NUTRITION',
    'IRON_DEFICIENCY',
    'AGA_FEMALE_123',
    'AGA_FEMALE_45',
    'TE_STRESS',
  ],
  relevantRootCauses: ['IRON_DEFICIENCY', 'POOR_NUTRITION', 'GUT_MALABSORPTION'],
  recommendations: [
    {
      action: 'Achieve adequate dietary protein intake (1.2–1.6 g/kg body weight/day)',
      rationale: 'Hair shaft is ~95% keratin; insufficient protein impairs shaft formation and follicle cycling.',
      frequency: 'Every meal',
      priority: 'HIGH',
    },
    {
      action: 'Include iron-rich foods daily (lean meat, legumes, dark leafy greens)',
      rationale: 'Ferritin is the primary nutritional correlate of hair loss risk; dietary iron supports repletion.',
      frequency: 'Daily',
      priority: 'HIGH',
    },
    {
      action: 'Consume vitamin C with non-haem iron sources',
      rationale: 'Ascorbic acid converts Fe3+ to absorbable Fe2+; improves non-haem iron absorption by 3–6×.',
      frequency: 'With each iron-rich meal',
      priority: 'HIGH',
    },
    {
      action: 'Ensure adequate zinc from food (oysters, pumpkin seeds, beef, legumes)',
      rationale: 'Zinc deficiency impairs keratin synthesis and DHT regulation.',
      frequency: 'Daily',
      priority: 'MEDIUM',
    },
    {
      action: 'Include omega-3 fatty acids (oily fish 2–3×/week or algae-based supplement)',
      rationale: 'Omega-3 reduces scalp inflammation and supports sebum quality.',
      frequency: '2–3 times per week',
      priority: 'MEDIUM',
    },
    {
      action: 'Maintain adequate caloric intake (avoid crash diets)',
      rationale: 'Severe caloric restriction triggers telogen effluvium within 2–3 months.',
      frequency: 'Daily',
      priority: 'HIGH',
    },
  ],
  avoidances: [
    'Very low calorie diets (<1,200 kcal/day)',
    'Protein restriction or prolonged fasting',
    'High-glycaemic diet (exacerbates insulin resistance and PCOS-related AGA)',
    'Alcohol excess (depletes zinc, B vitamins, disrupts sleep)',
    'Excessive selenium supplementation (>400 μg/day associated with hair loss)',
  ],
  evidenceLevel: 'STRONG',
  patientNote:
    'What you eat directly feeds your hair follicles. Prioritise protein at every meal, include ' +
    'iron-rich foods daily, and avoid extreme diets — they are one of the most common triggers of ' +
    'sudden hair shedding.',
  clinicalNote:
    'Baseline ferritin, zinc, vitamin D, and B12 should be measured before dietary intervention. ' +
    'In vegetarian/vegan patients, iron bisglycinate supplementation is strongly recommended given ' +
    'lower bioavailability of non-haem iron.',
  lastReviewed: '2025-01-01',
};

const SLEEP_GUIDANCE: LifestyleGuidanceKnowledge = {
  guidanceId: 'sleep_circadian_hair',
  category: 'SLEEP',
  displayName: 'Sleep Quality & Circadian Rhythm Optimisation',
  description:
    'Evidence-based sleep hygiene guidance to reduce HPA axis hyperactivation, ' +
    'support melatonin-mediated follicular protection, and restore circadian-regulated ' +
    'hair growth cycling.',
  relevantConditions: ['TE_STRESS', 'NIGHT_SHIFT', 'FREQUENT_FLYING', 'OXIDATIVE'],
  relevantRootCauses: ['STRESS', 'CIRCADIAN_DISRUPTION', 'OXIDATIVE_STRESS'],
  recommendations: [
    {
      action: 'Achieve 7–9 hours of sleep per night in a dark, cool environment',
      rationale:
        'Adequate sleep reduces cortisol and pro-inflammatory cytokines that drive telogen entry. ' +
        'Growth hormone (GH) surges during slow-wave sleep support tissue repair including hair matrix.',
      frequency: 'Nightly',
      priority: 'HIGH',
    },
    {
      action: 'Maintain consistent sleep and wake times (including weekends)',
      rationale:
        'Circadian consistency stabilises cortisol rhythms and melatonin production. ' +
        'Social jet lag (variable sleep timing) disrupts hair follicle cycling.',
      frequency: 'Daily',
      priority: 'HIGH',
    },
    {
      action: 'Avoid screens and blue light for 60 minutes before sleep',
      rationale: 'Blue light suppresses melatonin, which has direct antioxidant effects on hair follicles.',
      frequency: 'Nightly',
      priority: 'MEDIUM',
    },
    {
      action: 'Develop a pre-sleep relaxation routine (reading, meditation, light stretching)',
      rationale: 'Parasympathetic activation reduces evening cortisol and sympathetic tone.',
      frequency: 'Nightly',
      priority: 'MEDIUM',
    },
  ],
  avoidances: [
    'Caffeine after 2 pm',
    'Alcohol as a sleep aid (disrupts REM and slow-wave sleep)',
    'Late-night high-glycaemic meals (disrupts overnight glucose regulation)',
    'Irregular shift work schedules without circadian adaptation protocol',
  ],
  evidenceLevel: 'MODERATE',
  patientNote:
    'Poor sleep is one of the most overlooked drivers of hair loss. When you sleep poorly, ' +
    'your body produces more cortisol — the stress hormone that pushes hair follicles out of ' +
    'the growth phase early. Aim for 7–9 hours every night, at consistent times.',
  clinicalNote:
    'In shift workers and frequent flyers, evaluate for circadian disruption as a ' +
    'primary driver of TE. Melatonin 0.5–1 mg 30 minutes before target sleep time may ' +
    'assist circadian resetting. Screen for obstructive sleep apnoea in patients with ' +
    'metabolic features.',
  lastReviewed: '2025-01-01',
};

const STRESS_GUIDANCE: LifestyleGuidanceKnowledge = {
  guidanceId: 'stress_management_hair',
  category: 'STRESS',
  displayName: 'Stress Management for Hair Recovery',
  description:
    'Structured stress reduction guidance to normalise HPA axis activation, reduce ' +
    'cortisol-mediated catagen induction, and support anagen re-entry.',
  relevantConditions: ['TE_STRESS', 'AGA_FEMALE_123', 'AGA_MALE_123', 'SCALP_INFLAM'],
  relevantRootCauses: ['STRESS', 'OXIDATIVE_STRESS'],
  recommendations: [
    {
      action: 'Practice mindfulness meditation or deep breathing for 10–20 minutes daily',
      rationale:
        'Mindfulness-based stress reduction (MBSR) reduces morning cortisol by 15–25% in clinical trials. ' +
        'Cortisol normalisation reduces substance P perifollicular signalling.',
      frequency: 'Daily',
      priority: 'HIGH',
    },
    {
      action: 'Engage in moderate aerobic exercise 3–5× per week (30 minutes)',
      rationale:
        'Regular moderate exercise reduces baseline cortisol, improves HPA axis resilience, ' +
        'and improves scalp perfusion. Avoid over-exercise (may elevate cortisol).',
      frequency: '3–5 times per week',
      priority: 'HIGH',
    },
    {
      action: 'Seek professional psychological support if stress is chronic or clinical',
      rationale: 'CBT is effective for chronic stress and is a recognised driver of TE resolution.',
      frequency: 'As recommended by mental health practitioner',
      priority: 'HIGH',
    },
  ],
  avoidances: [
    'Overtraining / excessive exercise (raises cortisol)',
    'Stimulant excess (high caffeine, energy drinks)',
    'Social media or news overconsumption before sleep',
    'Ignoring symptoms of burnout or anxiety disorder',
  ],
  evidenceLevel: 'MODERATE',
  patientNote:
    'Stress is a direct physical cause of hair shedding — not just emotionally. When stress is ' +
    'high, your body literally switches hair follicles off. Managing stress is not optional; ' +
    'it is a core part of your treatment.',
  clinicalNote:
    'For patients with clinical anxiety or depression, consider referral to psychology concurrently. ' +
    'Adaptogens such as ashwagandha (600 mg KSM-66) have RCT evidence for cortisol reduction and ' +
    'may be considered as adjunct supplementation.',
  lastReviewed: '2025-01-01',
};

const SCALP_CARE_GUIDANCE: LifestyleGuidanceKnowledge = {
  guidanceId: 'scalp_care_routine',
  category: 'SCALP_CARE',
  displayName: 'Scalp Health Maintenance Routine',
  description:
    'Practical scalp care guidance to maintain a healthy scalp microbiome, reduce inflammation, ' +
    'and optimise topical treatment penetration.',
  relevantConditions: ['SCALP_INFLAM', 'AGA_MALE_123', 'AGA_FEMALE_123', 'TE_STRESS'],
  relevantRootCauses: ['STRESS', 'DHT', 'AUTOIMMUNE'],
  recommendations: [
    {
      action: 'Wash hair every 1–2 days with a gentle, pH-balanced shampoo',
      rationale:
        'Regular washing removes sebum, Malassezia substrate, and dead skin cells that contribute ' +
        'to scalp inflammation. Over-infrequent washing increases seborrhoeic dermatitis risk.',
      frequency: 'Every 1–2 days',
      priority: 'MEDIUM',
    },
    {
      action: 'Use fingertips (not nails) to massage shampoo into scalp for 60 seconds',
      rationale: 'Scalp massage increases perifollicular blood flow and may promote hair thickness.',
      frequency: 'Each wash',
      priority: 'MEDIUM',
    },
    {
      action: 'Apply topical treatments to clean, dry scalp before styling',
      rationale: 'Clean, dry scalp maximises penetration of active topical ingredients.',
      frequency: 'Per treatment protocol',
      priority: 'HIGH',
    },
    {
      action: 'Protect scalp from UV exposure with hat or SPF scalp spray',
      rationale: 'UV radiation increases scalp oxidative stress and may accelerate AGA progression.',
      frequency: 'When outdoors >30 minutes',
      priority: 'LOW',
    },
  ],
  avoidances: [
    'Tight hairstyles causing traction (traction alopecia risk)',
    'Heat styling above 180°C without heat protectant',
    'Bleaching or chemical relaxers during active shedding',
    'Scratching or picking at scalp',
    'Going >4 days without washing in seborrhoeic-prone scalps',
  ],
  evidenceLevel: 'EXPERT',
  patientNote:
    'A healthy scalp is the foundation of healthy hair. Keep it clean, avoid harsh chemicals ' +
    'during active shedding, and always apply your treatments to a clean, dry scalp for best results.',
  clinicalNote:
    'Traction alopecia from tight styles is non-androgenic and may require specific counselling. ' +
    'In patients with active seborrhoeic dermatitis, medicated shampoo rotation ' +
    '(ketoconazole + zinc pyrithione) provides superior control.',
  lastReviewed: '2025-01-01',
};

export const LIFESTYLE_KB: LifestyleKnowledgeRegistry = {
  nutrition_hair_foundation: NUTRITION_GUIDANCE,
  sleep_circadian_hair: SLEEP_GUIDANCE,
  stress_management_hair: STRESS_GUIDANCE,
  scalp_care_routine: SCALP_CARE_GUIDANCE,
  // TODO: exercise_hair_guidance — moderate exercise recommendations
  // TODO: chemical_exposure_guidance — chemical and thermal damage advice
  // TODO: heat_styling_guidance — safe heat styling protocols
  // TODO: hydration_guidance — hydration and hair moisture
} as const;
