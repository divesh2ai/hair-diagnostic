import type { ClinicalTemplate } from '../types';
import { v, cv, vReq } from '../_fragmentUtils';

export const INFLAMMATION_PATIENT_OPENING = [
  // "Your scalp is inflamed" — requires the patient to have reported it.
  vReq(['scalp.anyNonNormal'], 9,
    'Your assessment shows that inflammation on and around your scalp is creating a difficult environment for hair follicles, making it harder for them to grow healthy hair.',
    'The primary issue identified is scalp inflammation — your hair follicles are surrounded by an inflammatory environment that is interfering with their normal growth cycle.',
    'Scalp inflammation is the key driver identified in your assessment. When the scalp environment is inflamed, follicles struggle to maintain their normal growth cycle, even when all other conditions are right.',
  ),
  // Fallback when inflammation is suspected but no visible scalp finding —
  // describe the model without asserting a reported symptom.
  v(7,
    'Your assessment points to a follicle-environment factor in your hair cycle: subtle inflammatory signalling around the follicle can interfere with healthy growth even when the scalp looks normal.',
  ),
];

export const INFLAMMATION_PATIENT_MECHANISM = [
  v(9,
    'Think of scalp inflammation like a noisy, hostile environment that your hair follicles are trying to work in. No matter how much nutrition or support you give them, if the environment is hostile, they struggle to perform normally.',
    'Your hair follicles need a calm, balanced scalp environment to grow well. When inflammation is present, the chemical signals it creates interfere with the signals that tell follicles to stay in the growing phase.',
    'Inflammation around the hair follicles is like a constant disruption to the signals that control hair growth. Clearing this inflammation is the essential first step before any other treatment can work at full effectiveness.'
  ),
];

export const INFLAMMATION_PATIENT_SEVERITY_MILD = [
  v(8,
    'Your scalp inflammation is at a mild level — which is good news. Clearing it with targeted anti-inflammatory support typically restores a healthy follicle environment within a few weeks.',
    'Mild scalp inflammation responds quickly to the right treatment. Most patients notice the scalp feeling calmer and less reactive within 3–4 weeks.'
  ),
];

export const INFLAMMATION_PATIENT_SEVERITY_MODERATE = [
  v(8,
    'Your scalp inflammation is at a moderate level, which means it has been building up for a while. Addressing this first — before moving to growth-focused treatment — will make everything else much more effective.',
    'Moderate scalp inflammation needs to be properly cleared before hair-specific treatment can work well. Your plan addresses this as the priority so the subsequent phases have the best possible environment to work in.'
  ),
];

export const INFLAMMATION_PATIENT_SEVERITY_SEVERE = [
  v(8,
    'Your scalp inflammation is quite significant, which means your follicles have been in a difficult environment for some time. Clearing this is the most important first step — and it makes a real difference once the inflammation is resolved.',
    'Significant scalp inflammation means your treatment starts with a thorough clearance phase. This takes a bit longer, but once the inflammation is cleared, the subsequent phases can work at full potential.'
  ),
];

export const INFLAMMATION_PATIENT_TREATMENT = [
  v(9,
    'Your treatment plan starts with clearing the scalp inflammation — creating the right environment is the foundation that makes everything else work. Once the environment is calm, your follicles can respond much better to growth support.',
    'The most important first step in your plan is clearing the scalp inflammation. Think of it as preparing the soil before planting — the better the environment, the better the results.',
    'Your treatment works in clear stages: clear the inflammation first, then apply the specific hair support your profile needs. This sequence is what makes the plan effective rather than just adding supplements without preparation.'
  ),
];

export const INFLAMMATION_PATIENT_PROGNOSIS = [
  cv('severityMild', 8,
    'With mild inflammation, most patients feel a noticeable difference in scalp comfort within 3–4 weeks, and the hair response follows progressively from there.',
    'Mild scalp inflammation clears relatively quickly — you should feel and see the difference within a few weeks of starting your anti-inflammatory protocol.'
  ),
  cv('severityModerate', 8,
    'Moderate inflammation typically takes 6–8 weeks to fully clear. Once it does, the hair-specific phases of your treatment become significantly more effective.',
    'With moderate scalp inflammation, expect 6–8 weeks for the clearance phase, then progressive hair improvement from week 10 onwards.'
  ),
  cv('severitySevere', 8,
    'Significant inflammation takes more time to fully clear — usually 10–14 weeks. Patients in this situation often notice meaningful scalp health improvements first, followed by hair improvements from month 3 onwards.',
    'Clearing significant scalp inflammation is a process rather than an instant result. Expect progressive improvement over 2–3 months, with hair health improvements building from there.'
  ),
];

export const INFLAMMATION_PATIENT_CLOSING = [
  v(6,
    'One of the most rewarding things about addressing scalp inflammation is that many patients notice their scalp feeling completely different very early on — less itchy, less oily, calmer.',
    'Clearing scalp inflammation is a foundational step that benefits not just your hair, but your scalp comfort and overall scalp health long-term.'
  ),
];

export const INFLAMMATION_PATIENT_TEMPLATE: ClinicalTemplate = {
  category: 'inflammation',
  audience: 'patient',
  sections: {
    opening:   INFLAMMATION_PATIENT_OPENING,
    mechanism: INFLAMMATION_PATIENT_MECHANISM,
    severity: {
      mild:     INFLAMMATION_PATIENT_SEVERITY_MILD,
      moderate: INFLAMMATION_PATIENT_SEVERITY_MODERATE,
      severe:   INFLAMMATION_PATIENT_SEVERITY_SEVERE,
    },
    treatment: INFLAMMATION_PATIENT_TREATMENT,
    prognosis: INFLAMMATION_PATIENT_PROGNOSIS,
    closing:   INFLAMMATION_PATIENT_CLOSING,
  },
};
