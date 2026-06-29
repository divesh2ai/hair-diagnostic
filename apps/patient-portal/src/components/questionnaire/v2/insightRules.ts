import { Question } from '@/types/questionnaire';

/* ─────────────────────────────────────────────────────────────────────────────
 *  1) showIf — lightweight conditional visibility
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Pure visibility check. Used by the page wrapper to skip hidden questions
 * during navigation and by the progress calculator to exclude them from
 * the visible count. Does not mutate state.
 */
export function isQuestionVisible(
  question: Question,
  answers: Record<string, any>,
): boolean {
  const rule = question.showIf;
  if (!rule) return true;

  const observed = answers[rule.questionId];
  if (observed === undefined || observed === null || observed === '') return false;

  const targets = Array.isArray(rule.value) ? rule.value : [rule.value];

  if (Array.isArray(observed)) {
    return targets.some(t => observed.includes(t));
  }
  return targets.includes(observed);
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  2) "Your Hair Story" — rule-based factor detection
 *
 *  Pure mapping from answers → high-level clinical factors. Static rules
 *  only: no API calls, no AI, no backend. Each factor is "detected" when
 *  any of its triggers matches. Order is the display order in the panel.
 * ────────────────────────────────────────────────────────────────────────── */

export type FactorConfidence = 'strong' | 'possible' | 'evaluating';

export interface HairStoryFactor {
  id: string;
  label: string;
  /** Convenience: confidence !== 'evaluating'. Retained for callers that
   *  only care about a binary signal. */
  detected: boolean;
  /** How many independent triggers fired (used to derive confidence). */
  hitCount: number;
  /** Bucket: ≥2 hits = strong, 1 = possible, 0 = still evaluating. */
  confidence: FactorConfidence;
}

interface FactorRule {
  id: string;
  label: string;
  /** Any matching trigger flips the factor to detected. */
  triggers: Array<
    | { questionId: string; equals: string | number }
    | { questionId: string; includesAny: string[] }
    | { questionId: string; greaterThan: number }
  >;
}

/**
 * Tune these question IDs / option IDs against the live protocol. The intent
 * is to surface a *narrative* — not a diagnosis — so triggers should be
 * permissive (any plausible signal switches the factor on).
 */
const FACTOR_RULES: FactorRule[] = [
  {
    id: 'pattern_hair_loss',
    label: 'Pattern Hair Loss',
    triggers: [
      { questionId: 'hairline_pattern', includesAny: ['receded', 'm_shape', 'temporal_recession'] },
      { questionId: 'crown_thinning', equals: 'yes' },
      { questionId: 'family_history_balding', includesAny: ['father', 'mother', 'both'] },
    ],
  },
  {
    id: 'nutritional_factors',
    label: 'Nutritional Factors',
    triggers: [
      { questionId: 'diet_quality', includesAny: ['poor', 'irregular'] },
      { questionId: 'recent_weight_loss', equals: 'yes' },
      { questionId: 'protein_intake', includesAny: ['low'] },
      { questionId: 'iron_deficiency_history', equals: 'yes' },
    ],
  },
  {
    id: 'hormonal_factors',
    label: 'Hormonal Factors',
    triggers: [
      { questionId: 'pcos_diagnosis', equals: 'yes' },
      { questionId: 'thyroid_diagnosis', includesAny: ['hypothyroid', 'hyperthyroid'] },
      { questionId: 'menstrual_irregularity', equals: 'yes' },
      { questionId: 'postpartum_shedding', equals: 'yes' },
    ],
  },
  {
    id: 'gut_health',
    label: 'Gut Health',
    triggers: [
      { questionId: 'digestive_issues', includesAny: ['bloating', 'ibs', 'reflux', 'constipation'] },
      { questionId: 'recent_antibiotics', equals: 'yes' },
    ],
  },
  {
    id: 'scalp_inflammation',
    label: 'Scalp Inflammation',
    triggers: [
      { questionId: 'scalp_redness', includesAny: ['moderate', 'severe'] },
      { questionId: 'scalp_itch', includesAny: ['frequent', 'constant'] },
      { questionId: 'dandruff_severity', includesAny: ['moderate', 'severe'] },
    ],
  },
];

function evalTrigger(t: FactorRule['triggers'][number], answers: Record<string, any>): boolean {
  const v = answers[t.questionId];
  if (v === undefined || v === null || v === '') return false;
  if ('equals' in t) return v === t.equals;
  if ('greaterThan' in t) return typeof v === 'number' && v > t.greaterThan;
  if ('includesAny' in t) {
    if (Array.isArray(v)) return t.includesAny.some(x => v.includes(x));
    return t.includesAny.includes(v);
  }
  return false;
}

export function deriveHairStory(answers: Record<string, any>): HairStoryFactor[] {
  return FACTOR_RULES.map(rule => {
    const hitCount = rule.triggers.reduce(
      (n, t) => n + (evalTrigger(t, answers) ? 1 : 0),
      0,
    );
    const confidence: FactorConfidence =
      hitCount >= 2 ? 'strong' :
      hitCount === 1 ? 'possible' :
      'evaluating';
    return {
      id: rule.id,
      label: rule.label,
      detected: hitCount > 0,
      hitCount,
      confidence,
    };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  4) Time-remaining estimator
 *
 *  Heuristic: ~12 seconds per remaining visible question. Rounded up to a
 *  whole minute (with a 1-minute floor) so the UI never says "0 minutes left"
 *  while there are still answers to give.
 * ────────────────────────────────────────────────────────────────────────── */

export function estimateMinutesRemaining(
  answeredCount: number,
  totalVisible: number,
  secondsPerQuestion: number = 12,
): number {
  const remaining = Math.max(0, totalVisible - answeredCount);
  if (remaining === 0) return 0;
  return Math.max(1, Math.ceil((remaining * secondsPerQuestion) / 60));
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  5) Section intros — soft transition card between major sections
 * ────────────────────────────────────────────────────────────────────────── */

export interface SectionIntroContent {
  id: string;
  title: string;
  body: string;
  estimateLabel?: string;
}

const SECTION_INTROS: Record<string, SectionIntroContent> = {
  about_you: {
    id: 'about_you',
    title: 'About you',
    body: 'A few quick details about you so we can personalise the rest of the assessment.',
    estimateLabel: 'Less than 1 minute',
  },
  hair_health: {
    id: 'hair_health',
    title: 'Hair health',
    body: 'These questions help us recognise the pattern, pace and texture of what you are experiencing.',
    estimateLabel: 'About 2 minutes',
  },
  scalp_assessment: {
    id: 'scalp_assessment',
    title: 'Scalp health',
    body: 'The scalp environment is often the silent factor behind shedding. A few short questions ahead.',
    estimateLabel: 'About 1 minute',
  },
  internal_health: {
    id: 'internal_health',
    title: 'Internal health',
    body: 'Hair growth reflects what is happening inside the body. These signals help us connect the dots.',
    estimateLabel: 'About 2 minutes',
  },
  nutrition: {
    id: 'nutrition',
    title: 'Nutrition',
    body: 'Subtle nutritional gaps can mimic genetic loss. We are looking for the difference.',
    estimateLabel: 'About 1 minute',
  },
  lifestyle: {
    id: 'lifestyle',
    title: 'Lifestyle',
    body: 'Sleep, stress and routines shape the growth cycle more than most people realise.',
    estimateLabel: 'Less than 1 minute',
  },
  hormonal: {
    id: 'hormonal',
    title: 'Hormonal factors',
    body: 'Hormonal shifts have a direct effect on the follicle. A few short questions.',
    estimateLabel: 'About 1 minute',
  },
  medical: {
    id: 'medical',
    title: 'Medical history',
    body: 'Certain medical conditions, medications and life events can contribute to hair thinning.',
    estimateLabel: 'Less than 1 minute',
  },
};

/**
 * Returns a section intro when the current question is the first one in
 * its section (i.e. the previous question belonged to a different
 * category, or there is no previous question). Returns null otherwise.
 */
export function pickSectionIntro(
  currentCategory: string | undefined,
  previousCategory: string | undefined,
): SectionIntroContent | null {
  if (!currentCategory) return null;
  if (previousCategory === currentCategory) return null;
  return SECTION_INTROS[currentCategory] ?? null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  3) Insight Moments — static educational interludes every 8–10 questions
 * ────────────────────────────────────────────────────────────────────────── */

export interface InsightMomentContent {
  id: string;
  eyebrow: string;
  body: string;
}

const MOMENTS: InsightMomentContent[] = [
  {
    id: 'm1',
    eyebrow: 'You are doing great',
    body: 'Many people with similar responses report increased shedding during periods of nutritional stress. Your answers help us tell the difference.',
  },
  {
    id: 'm2',
    eyebrow: 'Why this matters',
    body: 'These next questions help us distinguish between genetic and nutritional drivers — two very different recovery paths.',
  },
  {
    id: 'm3',
    eyebrow: 'Building your story',
    body: 'Scalp health is often the silent factor behind shedding. A few short questions ahead.',
  },
  {
    id: 'm4',
    eyebrow: 'Almost there',
    body: 'You have completed most of the assessment. The final answers shape how your clinician personalises your plan.',
  },
];

/**
 * Returns a moment to show *before* the question at `visiblePosition`,
 * or null. Fires every `every` questions (default 9). Same position →
 * same moment, so navigation back/forward is stable.
 */
export function pickInsightMoment(
  visiblePosition: number,
  every: number = 9,
): InsightMomentContent | null {
  if (visiblePosition <= 1) return null;
  if ((visiblePosition - 1) % every !== 0) return null;
  const idx = Math.floor((visiblePosition - 1) / every) - 1;
  return MOMENTS[idx] ?? null;
}
