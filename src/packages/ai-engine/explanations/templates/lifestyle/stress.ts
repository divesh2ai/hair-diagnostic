import type { LifestyleTemplate } from '../types';
import { v } from '../_fragmentUtils';

// ─── Stress lifestyle template ────────────────────────────────────────────────
// Covers psychosocial stress, cortisol elevation, and HPA-axis disruption.

export const STRESS_IMPACT = [
  v(9,
    'Chronic psychosocial stress sustains cortisol and substance P elevation, driving NF-kB-mediated perifollicular inflammation and premature telogen phase acceleration that directly extends the active shedding period.',
    'Elevated cortisol from chronic stress creates a hormonal environment that shortens anagen phase duration and pushes follicles towards premature telogen entry — the biological mechanism behind stress-driven hair loss.',
    'HPA-axis hyperactivation from sustained stress produces persistent cortisol elevation; at follicular level, this shortens growth phase duration and increases the daily shed fraction until the underlying stress is addressed.'
  ),
];

export const STRESS_RECOMMENDATION = [
  v(8,
    'Cortisol modulation strategies — including consistent sleep schedules, breathwork, and adaptogenic supplementation — directly complement the clinical protocol by reducing the biological stress load on follicles.',
    'Evidence-based stress management including daily mindfulness, regular physical movement, and breathwork practices measurably reduces cortisol, creating a more favourable hormonal environment for hair recovery.',
    'Reducing chronic stress load amplifies the efficacy of the clinical protocol; the biological mechanism is direct — lower cortisol reduces the premature telogen shift rate and extends each follicle\'s growth phase.'
  ),
];

export const STRESS_TIMEFRAME = [
  v(7,
    'Stress-related improvements in hair often track the cortisol reduction; measurable shed velocity improvement is typically seen 6–10 weeks after sustained stress-reduction practice is established.',
    'Hair response to stress reduction is not instantaneous — follicles that have been pushed into telogen by cortisol require one full cycle to re-enter anagen, which takes 8–12 weeks to manifest as reduced shed.',
    'Patients who successfully reduce chronic stress load alongside protocol use consistently report faster and more complete hair recovery compared to those who address only the nutritional and anti-inflammatory factors.'
  ),
];

export const STRESS_LIFESTYLE_TEMPLATE: LifestyleTemplate = {
  factorKey:      'stress',
  impact:         STRESS_IMPACT,
  recommendation: STRESS_RECOMMENDATION,
  timeframe:      STRESS_TIMEFRAME,
};
