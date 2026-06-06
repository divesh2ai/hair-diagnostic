import type { ClinicalTemplate } from '../types';
import { v, c, cv } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const TE_DOCTOR_OPENING = [
  v(9,
    'Telogen effluvium confirmed: diffuse non-scarring alopecia with elevated telogen-phase shedding rate consistent with an acute or chronic systemic trigger.',
    'Active telogen effluvium identified; diffuse follicular telogen shift with characteristic increased daily shed count.',
    'Telogen effluvium pattern: premature anagen-to-telogen phase transition driven by a identifiable systemic or nutritional stressor.'
  ),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const TE_DOCTOR_MECHANISM = [
  v(9,
    'Elevated cortisol, nutritional deficiency, or acute physiological stressor drives premature anagen-to-telogen conversion; synchronised shedding presents 6–12 weeks post-trigger.',
    'Triggering event synchronises follicular shift from anagen to telogen phase; diffuse shed pattern typically manifests 2–3 months after the inciting stressor.',
    'Systemic or nutritional disruption activates stress-responsive follicular signalling pathways, shortening anagen phase duration and increasing the resting-phase follicular ratio.'
  ),
  c('hasGLP1Early', 'GLP-1 agonist-driven nutritional TE: appetite suppression creates protein-calorie deficit and ferritin depletion — IGF-1 suppression is the primary anagen-impairment mechanism.', 8),
  c('hasActiveShedding', 'Active telogen phase confirmed; immediate shedding arrest via targeted micronutrient and anti-inflammatory intervention is the non-negotiable Phase 1 clinical objective.', 8),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const TE_DOCTOR_SEVERITY_MILD = [
  v(8,
    'Mild TE with modest daily shed increase; stressor likely acute and resolving. Prognosis for spontaneous recovery is favourable with targeted micronutrient support.',
    'Early or resolving TE — moderate shed elevation. Intervention optimises recovery speed without complex multi-phase protocol.'
  ),
];

export const TE_DOCTOR_SEVERITY_MODERATE = [
  v(8,
    'Moderate TE with sustained elevated daily shed count; trigger is likely ongoing or inadequately resolved. Structured shedding-arrest protocol is indicated.',
    'Persistent moderate TE suggests ongoing systemic or nutritional trigger; root-cause identification and targeted correction are clinical priorities.'
  ),
];

export const TE_DOCTOR_SEVERITY_SEVERE = [
  v(8,
    'Severe diffuse TE with markedly elevated shed count; sustained systemic stressor indicated. Multi-phase arrest and immune-rebuild protocol is required.',
    'High-volume TE shed pattern suggests prolonged or high-magnitude stressor exposure; immune competence is likely co-depleted alongside the direct TE trigger.'
  ),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const TE_DOCTOR_TREATMENT = [
  v(9,
    'TE protocol sequence: shedding arrest via micronutrient and adaptogen support → perifollicular inflammatory clearance → immune restoration for anagen re-entry competence.',
    'Treatment prioritises the root-cause stressor correction before anti-inflammatory clearance; anagen phase re-entry requires both micronutrient sufficiency and a non-inflammatory follicular microenvironment.',
    'Primary objective: stabilise the telogen-to-anagen ratio by correcting the causative deficit, then restore follicular microenvironment to support re-entry.'
  ),
  cv('hasGLP1Early', 8,
    'GLP-1 TE protocol overrides standard sequence: Rapid Weight Loss Shield at Phase 1 to arrest GLP-1-driven nutritional TE before standard TE management resumes.',
    'Active GLP-1 use mandates weight-loss-specific shield protocol as Phase 1 — standard TE approach without this produces inadequate response.'
  ),
  c('isPregnant', 'Pregnancy protocol lock applied: HEALTHY-9 is the only prescribed supplement — all TE management compounds are contraindicated during pregnancy.', 10),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const TE_DOCTOR_PROGNOSIS = [
  cv('severityMild', 8,
    'TE prognosis is favourable when the causative stressor is identified and corrected; full shed normalisation expected within 3–6 months.',
    'Mild TE with known trigger — spontaneous recovery with nutritional support. Shed rate should normalise within 8–16 weeks of adequate intervention.'
  ),
  cv('severityModerate', 8,
    'Moderate TE prognosis depends on trigger resolution; incomplete resolution prolongs the active shed phase. Structured protocol produces stabilisation within 6–10 weeks.',
    'Persistent moderate TE can be resolved with targeted intervention; patient should expect progressive shed reduction over 6–10 weeks.'
  ),
  cv('severitySevere', 8,
    'Severe TE requires sustained multi-month protocol; immune depletion co-management is essential for full recovery. Normalisation expected within 3–5 months.',
    'High-severity TE with potential immune depletion component; recovery timeline is 12–20 weeks with full protocol adherence.'
  ),
];

// ─── Closing ─────────────────────────────────────────────────────────────────

export const TE_DOCTOR_CLOSING = [
  v(6,
    'Three-month review recommended to assess shed velocity reduction and micronutrient repletion adequacy.',
    'Ferritin, zinc, and B12 levels should be reviewed at 8–10 weeks to confirm repletion trajectory aligns with expected clinical response.'
  ),
];

// ─── Bundled template ─────────────────────────────────────────────────────────

export const TE_DOCTOR_TEMPLATE: ClinicalTemplate = {
  category: 'te',
  audience: 'doctor',
  sections: {
    opening:   TE_DOCTOR_OPENING,
    mechanism: TE_DOCTOR_MECHANISM,
    severity: {
      mild:     TE_DOCTOR_SEVERITY_MILD,
      moderate: TE_DOCTOR_SEVERITY_MODERATE,
      severe:   TE_DOCTOR_SEVERITY_SEVERE,
    },
    treatment: TE_DOCTOR_TREATMENT,
    prognosis: TE_DOCTOR_PROGNOSIS,
    closing:   TE_DOCTOR_CLOSING,
  },
};
