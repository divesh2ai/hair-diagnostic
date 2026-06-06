import type { ClinicalTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const AA_PATIENT_OPENING = [
  v(9,
    'Your assessment is consistent with alopecia areata — a condition where your immune system temporarily targets some of your hair follicles, producing the patches of loss you are seeing.',
    'What we are seeing is consistent with alopecia areata, a form of hair loss that happens when the immune system mistakenly attacks the follicles.',
    'Your pattern of patchy hair loss matches alopecia areata, an autoimmune-style reaction around the hair follicles.'
  ),
  v(7,
    'The most important thing to know up front is that the follicles in the affected patches are still alive — they have simply been temporarily switched off. Regrowth is biologically possible.',
    'The follicles in the bald patches are still intact and capable of growing hair again once the immune signal calms down.'
  ),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const AA_PATIENT_MECHANISM = [
  v(9,
    'Hair follicles normally have a protective shield that hides them from the immune system. In alopecia areata, that shield temporarily breaks down and immune cells gather around the follicle, causing it to pause growth.',
    'Your immune system has temporarily lost the protective barrier around some follicles. White blood cells gather around them and pause their growth cycle.',
    'The follicles in affected areas have temporarily lost their immune-protected status. Specialised immune cells then gather around them and stop the hair-growth cycle in that patch.'
  ),
  v(7,
    'You may first see regrowth as fine, white or colourless hair. That is normal — colour usually returns over the following weeks to months as the follicle fully recovers.',
    'When hair starts coming back, the first new hairs are often pale or white. Colour returns as the follicle fully recovers.'
  ),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const AA_PATIENT_SEVERITY_MILD = [
  v(9,
    'Your condition is in an early, limited form — typically one or a few discrete patches. At this stage, many patients respond well and many cases stabilise or improve within months.',
    'You currently have a limited, patchy form of alopecia areata. This is the most responsive stage, and many people see improvement within months.'
  ),
];

export const AA_PATIENT_SEVERITY_MODERATE = [
  v(9,
    'Your condition involves more extensive patches. With consistent support and follow-up, stabilisation and regrowth remain achievable, though the process can take longer.',
    'Multiple patches are present, which is a moderate form. Recovery is realistic but the timeline is usually longer and may need more support.'
  ),
];

export const AA_PATIENT_SEVERITY_SEVERE = [
  v(9,
    'Your condition is in an extensive or rapidly progressing form. This requires close coordination with a dermatologist — your protocol here is supportive and complements that medical care.',
    'You have an extensive form that needs specialist input. The supportive plan here works alongside dermatology care, not in place of it.'
  ),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const AA_PATIENT_TREATMENT = [
  v(9,
    'Your plan focuses on calming immune over-activity, protecting follicle cells from oxidative damage, supporting stress and sleep, and giving the follicles the nutritional environment they need to re-enter the growth phase.',
    'The protocol is designed to balance immune activity, reduce oxidative damage, and create the right internal conditions for the follicles to start producing hair again.'
  ),
  v(8,
    'This is a supportive plan that works alongside medical care from a dermatologist — it is not a replacement for medical treatment for moderate-to-severe disease.',
    'These supports complement medical treatment your dermatologist may recommend, especially if the condition is extensive or progressing.'
  ),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const AA_PATIENT_PROGNOSIS = [
  v(9,
    'Alopecia areata can wax and wane — patches may stabilise, regrow, and occasionally recur. Regular follow-up helps catch changes early.',
    'The condition has a relapsing-remitting pattern: it can improve, stabilise, and sometimes return. Regular check-ins are important.'
  ),
  v(7,
    'For most patients with limited disease, the outlook for stabilisation and regrowth is good. More extensive or rapidly extending disease benefits from specialist input.',
    'Most people with a small number of patches see meaningful improvement. Extensive disease has more variable outcomes and needs dermatology involvement.'
  ),
];

// ─── Closing ──────────────────────────────────────────────────────────────────

export const AA_PATIENT_CLOSING = [
  v(8,
    'Alopecia areata is visible and can feel distressing. Many patients benefit from talking to someone they trust or a mental-health professional during active disease — this is a normal part of care.',
    'The visible nature of this condition can be emotionally challenging. Support — including mental-health support — is a valid and helpful part of treatment.'
  ),
];

// ─── Assembled template ──────────────────────────────────────────────────────

export const AA_PATIENT_TEMPLATE: ClinicalTemplate = {
  category: 'aa',
  audience: 'patient',
  sections: {
    opening:   AA_PATIENT_OPENING,
    mechanism: AA_PATIENT_MECHANISM,
    severity: {
      mild:     AA_PATIENT_SEVERITY_MILD,
      moderate: AA_PATIENT_SEVERITY_MODERATE,
      severe:   AA_PATIENT_SEVERITY_SEVERE,
    },
    treatment: AA_PATIENT_TREATMENT,
    prognosis: AA_PATIENT_PROGNOSIS,
    closing:   AA_PATIENT_CLOSING,
  },
};
