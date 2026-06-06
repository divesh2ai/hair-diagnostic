/**
 * Prognosis Knowledge Base — Registry Index
 *
 * Indexed by DiagnosisKey → Severity → PrognosisKnowledge.
 * Provides evidence-based outcome expectations for report generation.
 */

import type { PrognosisKnowledge, PrognosisKnowledgeRegistry } from '../../types';

const AGA_FEMALE_123_MILD: PrognosisKnowledge = {
  diagnosisKey: 'AGA_FEMALE_123',
  severity: 'MILD',
  displayName: 'Female Pattern Hair Loss — Mild',
  baselineOutcome:
    'Without treatment, mild FPHL progresses to moderate thinning within 2–3 years in most patients.',
  withOptimalTreatment:
    'Shedding arrest in 70–80% within 3 months; partial density recovery expected by 9–12 months ' +
    'with continuous topical minoxidil and nutritional optimisation.',
  withoutTreatment:
    'Gradual progression to Ludwig grade II–III; estimated 5% per year density reduction ' +
    'in genetically susceptible individuals.',
  outcomes: [
    {
      timeframe: 'SHORT_TERM',
      label: 'Shedding Reduction',
      description: 'Active shedding decreases; transient minoxidil shed resolves by week 6–8.',
      successRate: '75–80%',
      clinicalNote: 'First visible sign of treatment response; precedes regrowth.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      label: 'Vellus-to-Terminal Conversion',
      description: 'Miniaturised vellus hairs begin converting to visible terminal hairs at crown.',
      successRate: '40–60%',
      clinicalNote: 'Phototrichogram confirms density increase. Patient may still report subjective unchanged appearance.',
    },
    {
      timeframe: 'LONG_TERM',
      label: 'Sustained Density Maintenance',
      description: 'With continuous treatment, density stabilises or improves vs untreated trajectory.',
      successRate: '80% maintain or improve',
      clinicalNote: 'Cessation of treatment leads to relapse within 6–12 months. Lifelong management required.',
    },
  ],
  modifiers: [
    {
      factor: 'Concurrent iron deficiency (ferritin <30 ng/mL)',
      direction: 'WORSENS',
      magnitude: 'MODERATE',
      rationale: 'Iron is required for follicular cell division; deficiency impairs minoxidil responsiveness.',
    },
    {
      factor: 'Optimised ferritin >70 ng/mL',
      direction: 'IMPROVES',
      magnitude: 'MODERATE',
      rationale: 'Adequate iron stores maximise follicular mitotic capacity and treatment responsiveness.',
    },
    {
      factor: 'Concurrent stress / raised cortisol',
      direction: 'WORSENS',
      magnitude: 'LOW',
      rationale: 'Unresolved stress maintains HPA-mediated catagen-promoting signalling.',
    },
    {
      factor: 'Early treatment initiation (grade 1)',
      direction: 'IMPROVES',
      magnitude: 'HIGH',
      rationale: 'Treatment efficacy is significantly higher before irreversible follicular fibrosis occurs.',
    },
  ],
  keySuccessFactors: [
    'Consistent twice-daily minoxidil application (adherence >80%)',
    'Ferritin target >70 ng/mL maintained',
    'Combined anti-androgen therapy if androgen excess confirmed',
    'Stress management and sleep optimisation',
    '12-month minimum treatment trial before efficacy assessment',
  ],
  warningSignals: [
    'Continued acceleration of shedding after 3 months of treatment',
    'New patterned recession (may indicate AGA grade progression)',
    'New scalp symptoms: pain, burning, crusting (investigate for scarring alopecia)',
    'Systemic symptoms: fatigue, weight change, menstrual irregularity (re-evaluate for thyroid/hormonal cause)',
  ],
  referralCriteria: [
    'Suspected scarring alopecia (pain, scarring, rapid progression)',
    'No response after 12 months of optimal treatment',
    'Grade 3 Ludwig or above at presentation',
    'Suspected autoimmune aetiology (patchy loss, exclamation mark hairs)',
  ],
  evidenceLevel: 'STRONG',
  lastReviewed: '2025-01-01',
};

const AGA_MALE_123_MODERATE: PrognosisKnowledge = {
  diagnosisKey: 'AGA_MALE_123',
  severity: 'MODERATE',
  displayName: 'Male Pattern Baldness — Moderate',
  baselineOutcome:
    'Without treatment, moderate MAGA progresses by approximately one Norwood grade every 1–2 years.',
  withOptimalTreatment:
    'Finasteride 1 mg/day stabilises or improves hair count in 83% of patients at 2 years. ' +
    'Combination with minoxidil 5% provides additive benefit. Vertex regrowth expected in 65% by 12 months.',
  withoutTreatment:
    'Progressive temporal and vertex loss; bridge between recession and vertex narrows within 2–4 years.',
  outcomes: [
    {
      timeframe: 'SHORT_TERM',
      label: 'Shedding Stabilisation',
      description: 'Active shedding reduces within 3–4 months of finasteride initiation.',
      successRate: '80–85%',
      clinicalNote: 'DHT reduction measurable within days; hair cycle lag delays clinical response.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      label: 'Vertex Regrowth',
      description: 'Vertex hair count increases measurably on phototrichogram.',
      successRate: '65% show increase at 12 months',
      clinicalNote: 'Temporal hairline recession responds less predictably than vertex.',
    },
    {
      timeframe: 'LONG_TERM',
      label: 'Sustained Maintenance',
      description: 'Continuous finasteride maintains benefit; density stable vs untreated trajectory.',
      successRate: '90% maintain or improve hair count at 5 years vs declining placebo',
      clinicalNote: 'Treatment must be lifelong; cessation results in relapse to pre-treatment trajectory.',
    },
  ],
  modifiers: [
    {
      factor: 'Age <30 at presentation',
      direction: 'WORSENS',
      magnitude: 'MODERATE',
      rationale: 'Early onset correlates with stronger genetic drive and faster natural progression.',
    },
    {
      factor: 'Combination therapy (finasteride + minoxidil)',
      direction: 'IMPROVES',
      magnitude: 'HIGH',
      rationale: 'Combination addresses both DHT axis and vascular/growth factor axis synergistically.',
    },
    {
      factor: 'Obesity / metabolic syndrome',
      direction: 'WORSENS',
      magnitude: 'LOW',
      rationale: 'Higher aromatase activity alters androgen-oestrogen ratio; insulin resistance may affect follicle.',
    },
  ],
  keySuccessFactors: [
    'Finasteride 1 mg daily with high adherence',
    'Minoxidil 5% twice daily as adjunct',
    'Ketoconazole shampoo 2–3× weekly to reduce scalp inflammation',
    'Early initiation before significant fibrosis',
    '18-month minimum treatment commitment',
  ],
  warningSignals: [
    'Accelerating recession despite treatment',
    'Scalp pain, erythema, or scaling (rule out scarring alopecia)',
    'Sexual side effects (discuss finasteride risk profile)',
    'Rapid progression suggesting alternative diagnosis',
  ],
  referralCriteria: [
    'Non-response to combination therapy at 18 months',
    'Norwood V–VII at presentation (transplant evaluation)',
    'Suspected inflammatory or scarring alopecia',
    'Patient requesting surgical evaluation',
  ],
  evidenceLevel: 'STRONG',
  lastReviewed: '2025-01-01',
};

const TE_STRESS_MILD: PrognosisKnowledge = {
  diagnosisKey: 'TE_STRESS',
  severity: 'MILD',
  displayName: 'Stress-Induced Telogen Effluvium — Mild',
  baselineOutcome:
    'Acute TE is self-limiting; natural resolution expected in 6–9 months if the stressor is removed.',
  withOptimalTreatment:
    'Shedding arrest typically within 4–8 weeks. Full density recovery by 6–9 months ' +
    'with stress management, nutritional optimisation, and shedding-arrest support.',
  withoutTreatment:
    'Spontaneous resolution in most cases within 9 months; risk of chronic TE if stressor persists.',
  outcomes: [
    {
      timeframe: 'SHORT_TERM',
      label: 'Peak Shedding Subsides',
      description: 'Shedding begins to reduce as anagen cycling normalises.',
      successRate: '80%',
      clinicalNote: 'Peak shedding typically at 1–3 months post-trigger; gradual decline thereafter.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      label: 'Regrowth Visible',
      description: 'Short regrowing hairs visible at scalp; density improving.',
      successRate: '90%',
      clinicalNote: 'Regrowth confirms anagen re-entry. Hair texture may differ temporarily.',
    },
    {
      timeframe: 'LONG_TERM',
      label: 'Full Recovery',
      description: 'Density returns to pre-TE baseline.',
      successRate: '90–95% with identified and resolved trigger',
      clinicalNote: 'Unresolved stressors or chronic TE require re-evaluation and ongoing management.',
    },
  ],
  modifiers: [
    {
      factor: 'Identified and resolved trigger',
      direction: 'IMPROVES',
      magnitude: 'HIGH',
      rationale: 'Stressor removal is the primary determinant of TE resolution.',
    },
    {
      factor: 'Concurrent iron deficiency',
      direction: 'WORSENS',
      magnitude: 'MODERATE',
      rationale: 'Iron deficiency prolongs TE and impairs anagen re-entry.',
    },
    {
      factor: 'Underlying undiagnosed AGA',
      direction: 'WORSENS',
      magnitude: 'MODERATE',
      rationale: 'TE may unmask pre-existing AGA; persistent thinning after TE resolves warrants re-evaluation.',
    },
  ],
  keySuccessFactors: [
    'Identification and resolution of the precipitating stressor',
    'Ferritin optimisation >70 ng/mL',
    'Sleep quality improvement (7–9 hours per night)',
    'Psychological support and stress management',
    'Avoiding additional stressors during recovery phase',
  ],
  warningSignals: [
    'Shedding continuing beyond 6 months despite stressor resolution',
    'New patterned thinning emerging (AGA unmasking)',
    'Recurrence of TE with each subsequent stressor',
    'Patchy loss (rule out alopecia areata)',
  ],
  referralCriteria: [
    'Chronic TE (>12 months duration)',
    'Patchy or unusual distribution',
    'Suspected scalp biopsy requirement',
    'Laboratory abnormalities (thyroid, ferritin, hormones) requiring medical management',
  ],
  evidenceLevel: 'STRONG',
  lastReviewed: '2025-01-01',
};

export const PROGNOSIS_KB: PrognosisKnowledgeRegistry = {
  AGA_FEMALE_123: {
    MILD: AGA_FEMALE_123_MILD,
    // TODO: MODERATE prognosis entry for AGA_FEMALE_123
    // TODO: SEVERE prognosis entry for AGA_FEMALE_123
  },
  AGA_MALE_123: {
    MODERATE: AGA_MALE_123_MODERATE,
    // TODO: MILD and SEVERE prognosis entries for AGA_MALE_123
  },
  TE_STRESS: {
    MILD: TE_STRESS_MILD,
    // TODO: MODERATE and SEVERE prognosis entries for TE_STRESS
  },
  // TODO: Add prognosis entries for all remaining DiagnosisKey × Severity combinations
} as const;
