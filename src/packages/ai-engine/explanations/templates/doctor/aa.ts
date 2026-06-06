import type { ClinicalTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const AA_DOCTOR_OPENING = [
  v(9,
    'Clinical findings are consistent with alopecia areata (ICD-10 L63) — non-scarring autoimmune alopecia characterised by collapse of follicular immune privilege and peribulbar CD8+ NKG2D+ T-cell attack on anagen-phase follicles.',
    'Presentation aligns with alopecia areata: non-scarring patchy alopecia with preserved follicular ostia; the lesion histology classically shows a peribulbar lymphocytic infiltrate ("swarm of bees").'
  ),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const AA_DOCTOR_MECHANISM = [
  v(9,
    'Pathogenesis centres on loss of anagen-bulb immune privilege: IFN-γ-driven upregulation of MHC class I and NKG2D ligands (MICA, ULBP3) on follicular epithelium, with CD8+ NKG2D+ effector recruitment via the IFN-γ → JAK1/2 → STAT1 → CXCL9/10/11 axis.',
    'IFN-γ-mediated collapse of anagen-bulb immune privilege drives MHC class I and NKG2D-ligand upregulation; CD8+ NKG2D+ T cells are recruited via STAT1-induced CXCL9/10/11 chemokines and execute peribulbar cytotoxic attack.'
  ),
  v(8,
    'An IL-15 amplification loop between bulb keratinocytes and infiltrating lymphocytes sustains the lesion. Regulatory T-cell function is reduced. Bulge hair-follicle stem cells are typically preserved in classical non-scarring disease — this is the biological basis of regrowth potential.',
    'IL-15 maintains a self-sustaining cytotoxic milieu; Treg insufficiency permits autoreactive CD8+ persistence; bulge HFSC are spared, preserving regenerative capacity.'
  ),
  v(7,
    'Melanocytes are early targets — pigment incontinence accounts for the white or unpigmented regrowth observed during initial recovery.',
    'Melanocyte cytotoxicity produces the white-regrowth phase commonly observed at recovery onset.'
  ),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const AA_DOCTOR_SEVERITY_MILD = [
  v(9,
    'Limited patchy disease (typically SALT ≤ 25) carries the most favourable spontaneous and treatment-responsive outlook. Supportive care plus topical or intralesional corticosteroids (per dermatology) remains the standard.',
    'SALT ≤ 25 patchy AA — best prognosis subset; manage with conventional topical/intralesional therapy plus the supportive plan.'
  ),
];

export const AA_DOCTOR_SEVERITY_MODERATE = [
  v(9,
    'Multifocal disease (SALT 25–50) requires more active management and closer follow-up. Consider early dermatology consultation to discuss escalation options including topical immunotherapy or systemic agents.',
    'Multifocal/moderate disease — escalate to dermatology for topical immunotherapy consideration; close interval follow-up indicated.'
  ),
];

export const AA_DOCTOR_SEVERITY_SEVERE = [
  v(9,
    'Extensive or rapidly progressive disease (SALT > 50, AT/AU, ophiasis, paediatric onset) carries lower spontaneous regrowth rates and warrants dermatology referral for systemic immunomodulator or JAK-inhibitor evaluation (baricitinib FDA-approved 2022; ritlecitinib approved 2023).',
    'SALT > 50, AT/AU pattern, ophiasis, or paediatric onset — refer for systemic immunomodulator / JAK-inhibitor evaluation.'
  ),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const AA_DOCTOR_TREATMENT = [
  v(9,
    'The supportive plan targets immune modulation (colostrum, lactoferrin, curcumin — NF-κB suppression), oxidative defense (selenium, vitamin E, moringa), HFSC and anagen support (vitamin D — VDR ligation; melatonin — anagen prolongation; kelp — IGF-1/VEGF stimulation), and stress regulation (L-theanine, chamomile, magnesium).',
    'Adjunctive components: immune modulation via colostrum/lactoferrin/curcumin; oxidative defense via selenium/vitamin E; HFSC/anagen support via vitamin D, melatonin, kelp; stress modulation via L-theanine, chamomile, magnesium.'
  ),
  v(8,
    'These adjuncts complement — not replace — dermatology-led management. Escalate per severity and trajectory.',
    'Adjunctive only; does not substitute for dermatology-led care.'
  ),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const AA_DOCTOR_PROGNOSIS = [
  v(9,
    'Course is relapsing-remitting; up to 50% of patchy cases show spontaneous remission within 12 months but recurrence is common. Negative prognostic factors: AT/AU, ophiasis, nail involvement, paediatric onset, comorbid atopy, family history, disease duration > 1 year.',
    'Relapsing-remitting course with significant spontaneous remission rate in patchy disease (~50% within 12 mo). Adverse factors: extensive disease, ophiasis, nail involvement, paediatric onset.'
  ),
];

// ─── Closing ──────────────────────────────────────────────────────────────────

export const AA_DOCTOR_CLOSING = [
  v(8,
    'Screen and document: TSH/TPO antibodies, ANA if clinically indicated, vitamin D, ferritin, PHQ-9. Psychological impact is significant — refer for psychosocial support where indicated.',
    'Baseline: TSH/TPO, vitamin D, ferritin, PHQ-9; ANA if indicated. Surface and address psychosocial impact actively.'
  ),
];

// ─── Assembled template ──────────────────────────────────────────────────────

export const AA_DOCTOR_TEMPLATE: ClinicalTemplate = {
  category: 'aa',
  audience: 'doctor',
  sections: {
    opening:   AA_DOCTOR_OPENING,
    mechanism: AA_DOCTOR_MECHANISM,
    severity: {
      mild:     AA_DOCTOR_SEVERITY_MILD,
      moderate: AA_DOCTOR_SEVERITY_MODERATE,
      severe:   AA_DOCTOR_SEVERITY_SEVERE,
    },
    treatment: AA_DOCTOR_TREATMENT,
    prognosis: AA_DOCTOR_PROGNOSIS,
    closing:   AA_DOCTOR_CLOSING,
  },
};
