import type { ClinicalTemplate } from '../types';
import { v, c, cv, vReq } from '../_fragmentUtils';

export const TE_PATIENT_OPENING = [
  v(9,
    'Your assessment shows a type of hair shedding called telogen effluvium, where more hair follicles than usual have entered the resting phase at the same time, causing increased daily shed.',
    'What you are experiencing is a well-understood form of hair shedding that happens when a trigger — such as stress, a nutritional gap, or a physical change — pushes more hair into the shedding cycle.',
    'The increased shedding you have noticed is called telogen effluvium — a temporary phase where your follicles shed more simultaneously because of an identifiable trigger.'
  ),
  c('hasGLP1Early', 'In your case, the primary trigger appears to be the nutritional impact of rapid weight loss, which is a very well-documented pattern in people using GLP-1 medication.', 8),
];

export const TE_PATIENT_MECHANISM = [
  v(9,
    'Normally, hair follicles shed and grow in a staggered rhythm. When a significant trigger occurs, many follicles can shift into the resting phase at once — and when they do shed, it feels like a sudden, significant increase.',
    'Think of it like a traffic jam: your hair follicles are usually spread across different stages of their cycle. A stressor can push many of them into the shedding phase simultaneously, causing a noticeable increase.',
    'The trigger behind your shedding caused a larger-than-normal number of follicles to pause their growth and enter the resting phase. The shed you are seeing now is those follicles releasing at the same time.'
  ),
];

export const TE_PATIENT_SEVERITY_MILD = [
  v(8,
    'Your shedding is at a mild level, which means the trigger was likely manageable and your body is probably already beginning to recover.',
    'Mild telogen effluvium like yours responds very quickly to the right nutritional and anti-inflammatory support — most patients see a clear reduction in shedding within 6–10 weeks.'
  ),
];

export const TE_PATIENT_SEVERITY_MODERATE = [
  v(8,
    'Your shedding is at a moderate level, which suggests the trigger has been present for a while or was quite significant. The right protocol can bring it under control within a few weeks.',
    'Moderate shedding can feel alarming, but it is very manageable. With the right targeted support, most patients see a clear turning point within 6–10 weeks.'
  ),
];

export const TE_PATIENT_SEVERITY_SEVERE = [
  v(8,
    'Your shedding is at a higher level, which means your body has been under significant stress — whether nutritional, physical, or hormonal. The good news is that this is very treatable.',
    'High-volume shedding can be distressing, but it is important to know that this type of hair loss is reversible. The right protocol will address the root cause and stop the shedding.'
  ),
];

export const TE_PATIENT_TREATMENT = [
  // Generic variants — no patient-symptom claims. Safe for any TE patient.
  v(9,
    'Your treatment plan directly addresses what triggered the shedding — giving your follicles the nutritional and anti-inflammatory support they need to stop shedding and re-enter the growth phase.',
    'The most important first step is stopping the shedding by correcting the imbalance that caused it. From there, your follicles will naturally start recovering.',
  ),
  // "Clears any scalp inflammation that built up" — only valid for patients
  // who actually reported scalp findings; otherwise it invents a symptom.
  vReq(['scalp.anyNonNormal'], 9,
    'Your plan starts with shedding arrest, then clears any scalp inflammation that built up during the shedding phase, and then supports your immune system to help follicles grow back.',
  ),
  c('hasGLP1Early', 'Because your shedding is related to rapid weight loss, your treatment starts with a specific protective formula designed for exactly this situation — so your follicles are shielded during the process.', 8),
  c('isPregnant', 'Your treatment during pregnancy is a single, carefully selected prenatal supplement that is completely safe for you and your baby, and supports your nutritional needs throughout.', 9),
];

export const TE_PATIENT_PROGNOSIS = [
  cv('severityMild', 8,
    'Most patients with mild shedding notice the difference within 4–6 weeks — less hair in the shower, on the pillow, and during brushing.',
    'Mild telogen effluvium typically responds quickly; you should start to see a clear improvement within 6–8 weeks of starting your protocol.'
  ),
  cv('severityModerate', 8,
    'With your protocol, expect to see the shedding reducing noticeably within 6–10 weeks. Full normalisation usually takes 3–4 months.',
    'Moderate shedding takes a little longer to settle but the results are very consistent — most patients see a turning point at 6–8 weeks.'
  ),
  cv('severitySevere', 8,
    'Higher-volume shedding takes 8–12 weeks to stabilise with a targeted protocol. Full recovery of normal hair cycling typically follows over 3–5 months.',
    'It will take a couple of months to see the shed clearly reducing, but the improvement is consistent once the root cause is being corrected. Most patients notice a real difference by month 2–3.'
  ),
];

export const TE_PATIENT_CLOSING = [
  v(6,
    'The key thing to remember is that this type of hair loss is temporary and reversible. With the right support, your follicles will grow back.',
    'Telogen effluvium is one of the most successfully treated types of hair loss — your body is well equipped to recover when given the right support.'
  ),
];

export const TE_PATIENT_TEMPLATE: ClinicalTemplate = {
  category: 'te',
  audience: 'patient',
  sections: {
    opening:   TE_PATIENT_OPENING,
    mechanism: TE_PATIENT_MECHANISM,
    severity: {
      mild:     TE_PATIENT_SEVERITY_MILD,
      moderate: TE_PATIENT_SEVERITY_MODERATE,
      severe:   TE_PATIENT_SEVERITY_SEVERE,
    },
    treatment: TE_PATIENT_TREATMENT,
    prognosis: TE_PATIENT_PROGNOSIS,
    closing:   TE_PATIENT_CLOSING,
  },
};
