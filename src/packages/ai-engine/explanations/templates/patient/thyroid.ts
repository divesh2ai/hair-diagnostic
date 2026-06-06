import type { ClinicalTemplate } from '../types';
import { v, cv } from '../_fragmentUtils';

export const THYROID_PATIENT_OPENING = [
  v(9,
    'Your assessment shows that your thyroid — the gland that controls your body\'s energy and metabolism — is affecting your hair growth by slowing down the processes that keep follicles healthy.',
    'The primary cause of your hair concerns is your thyroid function: when your thyroid is under-performing, your body\'s metabolism slows down and your hair follicles get less energy to grow.',
    'Your hair assessment identifies your thyroid as the main driver of your hair loss — your follicles need a well-functioning thyroid to maintain normal growth cycles, and supporting thyroid function is the priority.'
  ),
];

export const THYROID_PATIENT_MECHANISM = [
  v(9,
    'Your thyroid gland produces hormones that control your body\'s metabolic rate. When thyroid hormone levels are too low, everything slows down — including the energy available for hair follicles to complete their growth cycle.',
    'Think of the thyroid as the dial controlling your body\'s engine speed. When it\'s running too slowly, hair follicles don\'t get the metabolic fuel they need to stay in the active growing phase.',
    'Hair follicles are metabolically demanding — they need a well-functioning thyroid to maintain their growth cycles. When thyroid hormones are insufficient, follicles shorten their growth phase and more hair enters the shedding stage.'
  ),
];

export const THYROID_PATIENT_SEVERITY_MILD = [
  v(8,
    'Your thyroid impact on your hair is at an early level — the metabolic disruption has been relatively mild. Supporting thyroid function now will restore normal hair cycling within a few months.',
    'The good news is that thyroid-related hair concerns at this stage respond very well to the right nutritional co-factor support.'
  ),
];

export const THYROID_PATIENT_SEVERITY_MODERATE = [
  v(8,
    'Your thyroid has been affecting your hair for a while, which is why the thinning or shedding is at a moderate level. Restoring thyroid function is the single most important step — and the hair follows.',
    'Moderate thyroid-driven hair loss is very manageable with the right approach. Restoring your metabolism is the foundation, and hair improvement follows as a natural consequence.'
  ),
];

export const THYROID_PATIENT_SEVERITY_SEVERE = [
  v(8,
    'Your thyroid has been significantly affecting your hair over a longer period. The path forward is clear: restore thyroid function first, and with sustained support, your hair will gradually recover.',
    'Significant thyroid-related hair loss takes more time to address, but the treatment path is straightforward and the results, when the thyroid is properly supported, are very real.'
  ),
];

export const THYROID_PATIENT_TREATMENT = [
  v(9,
    'Your treatment starts by giving your thyroid the specific co-factors it needs to produce hormones effectively. Once your metabolism is restored, the other phases of your treatment — stopping shedding and rebuilding — will work much more effectively.',
    'The most important thing your treatment does is support your thyroid\'s ability to function properly. Everything else in your plan — the shedding support, the anti-inflammation — becomes more effective once this foundation is in place.',
    'Your plan starts with thyroid support, because until your body\'s metabolic engine is running properly, any other hair treatment will have limited effect. Once the thyroid is supported, the subsequent phases accelerate the recovery.'
  ),
];

export const THYROID_PATIENT_PROGNOSIS = [
  cv('severityMild', 8,
    'Thyroid-related hair loss responds well to treatment — most patients notice the shedding reducing within 8–12 weeks as the thyroid co-factors take effect.',
    'Early thyroid hair impact responds quickly to treatment; most patients see measurable improvement within 2–3 months of starting the protocol.'
  ),
  cv('severityModerate', 8,
    'Your hair will progressively improve as your thyroid function is restored — expect to see changes beginning around month 2–3 and continuing over 4–6 months.',
    'Moderate thyroid-driven hair loss typically resolves well within 4–6 months of consistent treatment — the key is maintaining the thyroid support long-term.'
  ),
  cv('severitySevere', 8,
    'Significant thyroid hair loss takes longer to recover — usually 6–12 months — but the results can be very meaningful when the thyroid function is adequately supported.',
    'Recovery from advanced thyroid-related hair loss requires patience, but the process is consistent and predictable: thyroid function improves first, hair follows over the following months.'
  ),
];

export const THYROID_PATIENT_CLOSING = [
  v(6,
    'Many patients find that addressing their thyroid health through this kind of targeted support also improves their energy, weight management, and general wellbeing — not just their hair.',
    'The good thing about treating thyroid-related hair loss is that restoring thyroid health has wide-ranging positive effects across your whole body, not just your hair.'
  ),
];

export const THYROID_PATIENT_TEMPLATE: ClinicalTemplate = {
  category: 'thyroid',
  audience: 'patient',
  sections: {
    opening:   THYROID_PATIENT_OPENING,
    mechanism: THYROID_PATIENT_MECHANISM,
    severity: {
      mild:     THYROID_PATIENT_SEVERITY_MILD,
      moderate: THYROID_PATIENT_SEVERITY_MODERATE,
      severe:   THYROID_PATIENT_SEVERITY_SEVERE,
    },
    treatment: THYROID_PATIENT_TREATMENT,
    prognosis: THYROID_PATIENT_PROGNOSIS,
    closing:   THYROID_PATIENT_CLOSING,
  },
};
