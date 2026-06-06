import type { TherapyTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Peptide / growth factor therapy template ─────────────────────────────────
// Covers colostrum, lactoferrin, EGF precursors, Redensyl, and related
// growth-stimulating compounds used in the immune-nutritional regrowth phase.

export const PEPTIDES_MECHANISM = [
  v(9,
    'Bioactive peptides — including colostrum-derived EGF precursors, lactoferrin, and Redensyl — stimulate follicular stem cell activation and promote anagen phase re-entry through Wnt/β-catenin pathway upregulation.',
    'Peptide-based regrowth factors including colostrum and lactoferrin engage EGF and IGF-1 signalling pathways to promote follicular papilla cell proliferation and trigger anagen phase initiation in telogen-dwell follicles.',
    'Growth factor supplementation via colostrum and bioactive peptide fractions stimulates follicular stem cell recruitment, Wnt pathway activation, and dermal papilla cell proliferation to drive new anagen entry.'
  ),
  c('hasNoVisibleFall', 'In the regrowth-only clinical context, peptide-based anagen stimulation is the primary therapeutic goal — no TE arrest is required, making EGF/colostrum the lead Phase 1 intervention.', 8),
];

export const PEPTIDES_EXPECTED_OUTCOMES = [
  v(8,
    'New fine hair emergence in dormant zones typically visible within 8–16 weeks; progressive thickening of these new fibres continues over 6–12 months as follicles re-establish full anagen competence.',
    'Anagen re-entry stimulated by peptide therapy produces short, fine new hair in affected areas within 2–4 months; these hairs progressively thicken with continued use over 6–12 months.',
    'Follicular stem cell activation produces measurable density improvements in previously thin or dormant areas over 3–6 months; concurrent improvement in existing hair calibre is also commonly observed.'
  ),
];

export const PEPTIDES_USAGE = [
  v(7,
    'Oral growth factor supplementation is taken consistently as prescribed; bioactive peptide absorption is maximised when taken away from high-tannin beverages.',
    'Consistent daily use ensures sustained EGF and IGF-1 signalling support; sporadic use does not maintain the growth-factor gradient required for progressive follicular stem cell recruitment.'
  ),
];

export const PEPTIDES_CAUTION = [
  v(6,
    'Peptide-based regrowth therapy requires 3–6 months of consistent use before meaningful density change is visible — early discontinuation is the most common cause of incomplete response.',
    'Response to growth factor therapy is gradual by biological necessity — follicular stem cell activation and new anagen cycles have inherent time requirements that cannot be compressed.'
  ),
  c('isPregnant', 'Colostrum and lactoferrin compounds are not prescribed during active pregnancy — protocol is limited to HEALTHY-9 during pregnancy.', 9),
];

export const PEPTIDES_THERAPY_TEMPLATE: TherapyTemplate = {
  therapyKey:       'peptides',
  mechanism:        PEPTIDES_MECHANISM,
  expectedOutcomes: PEPTIDES_EXPECTED_OUTCOMES,
  usage:            PEPTIDES_USAGE,
  caution:          PEPTIDES_CAUTION,
};
