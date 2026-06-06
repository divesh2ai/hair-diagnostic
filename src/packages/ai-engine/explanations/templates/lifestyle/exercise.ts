import type { LifestyleTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Exercise lifestyle template ──────────────────────────────────────────────
// Covers physical activity, sedentary behaviour, and exercise-scalp circulation.

export const EXERCISE_IMPACT = [
  v(9,
    'Regular aerobic exercise improves scalp microcirculation, reduces systemic inflammation markers (CRP, IL-6), and promotes growth hormone pulsatility — each mechanism independently supporting anagen phase maintenance.',
    'Sedentary behaviour and low cardiorespiratory fitness correlate with elevated baseline cortisol, impaired insulin sensitivity, and reduced scalp blood flow — a triple impairment to follicular health.',
    'Exercise is an underutilised follicular support tool: aerobic activity improves the hormonal milieu (lower cortisol, higher GH), reduces perifollicular cytokine load, and enhances nutrient delivery to the dermal papilla simultaneously.'
  ),
  c('isMale', 'In male pattern presentations, regular resistance exercise increases SHBG expression and improves insulin sensitivity — partially offsetting the androgenic environment that drives miniaturisation.', 7),
];

export const EXERCISE_RECOMMENDATION = [
  v(8,
    'A minimum of 150 minutes of moderate aerobic activity per week — brisk walking, cycling, or swimming — produces measurable improvements in scalp perfusion and systemic inflammatory markers within 6–8 weeks.',
    'Combining aerobic activity (for cortisol and inflammation reduction) with resistance training (for insulin sensitivity and growth hormone) provides the broadest follicular benefit; 3–4 sessions per week is the clinical target.',
    'Consistent, moderate exercise outperforms intense sporadic exercise for hair health: chronic high-intensity exercise without adequate recovery elevates cortisol and can paradoxically worsen inflammatory hair loss.'
  ),
  c('hasActiveShedding', 'During active shedding phases, moderate low-impact aerobic exercise is preferred over high-intensity training; the latter acutely elevates cortisol and can temporarily amplify the telogen shift.', 6),
];

export const EXERCISE_TIMEFRAME = [
  v(7,
    'Improvements in systemic inflammatory markers and scalp microcirculation are measurable within 4–6 weeks of consistent aerobic activity; hair density improvements follow 8–12 weeks behind.',
    'Exercise benefits compound over time — the first 8 weeks improve the vascular and hormonal environment; from week 12 onwards, patients typically notice improved hair texture and reduced shed velocity.',
    'Exercise is a sustained-benefit intervention: the follicular improvements are maintained only while regular activity continues; cessation reverses the circulatory and hormonal gains within 4–6 weeks.'
  ),
];

export const EXERCISE_LIFESTYLE_TEMPLATE: LifestyleTemplate = {
  factorKey:      'exercise',
  impact:         EXERCISE_IMPACT,
  recommendation: EXERCISE_RECOMMENDATION,
  timeframe:      EXERCISE_TIMEFRAME,
};
