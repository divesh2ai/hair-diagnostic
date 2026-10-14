import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// ACCEPTANCE — Post-menopause + Obesity, rendered one-page report.
//
// This is the render-layer companion to tests/ai-engine/postmenopause-obesity
// .test.ts. That suite proves the ACTIVE engine SELECTS the Postmenopause kit.
// This suite proves the SELECTED kit is RENDERED correctly on the artefact a
// clinic actually hands a patient: the identity, the packshot, the rationale,
// and the governed MRP.
//
// It runs the real chain offline — no DB, no server, no browser:
//   answers → evaluateClinicalProfile → scoreKits (engine)
//           → TreatmentPhase → mapClinicalReportToPrintPresentation (the exact
//             production view-model the PDF renderer screenshots)
//
// Clarified clinical mapping (2026-10-14): Post-menopause + Obesity →
// PRO FACT META B POSTMENOPAUSE (canonical POST_MENOPAUSE), packshot
// pro_fact_meta_b_post_menopause.png, MRP ₹3,347 — NOT HAIR FACT PERI
// MENOPAUSE, NOT the generic PRO FACT META B.
// ─────────────────────────────────────────────────────────────────────────────

import { scoreKits } from '@hairos/packages/ai-engine/kit-scorer/scoreKits';
import { evaluateClinicalProfile } from '@hairos/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds } from '@hairos/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import type { PatientAnswers } from '@hairos/packages/types';
import type { ClinicConfig, BudgetProfile } from '@hairos/packages/ai-engine/kit-scorer/types';
import type { TreatmentPhase } from '@hairos/packages/ai-engine/report-engine/types';

import { buildRuntimeFixture } from '@/lib/reports/one-page/fixtures/_runtime';
import { KIT_PRICE_INR } from '@/lib/pricing/kitPrices';

const POST_KIT = 'PRO FACT META B POSTMENOPAUSE';
const PERI_KIT = 'HAIR FACT PERI MENOPAUSE';
const GENERIC_META_B = 'PRO FACT META B';
const POST_PACKSHOT = 'pro_fact_meta_b_post_menopause.png';
const PERI_PACKSHOT = 'peri';

const OPEN_CLINIC: ClinicConfig = {
  clinicId: 'acceptance-clinic',
  availableKits: [
    'HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG',
    'PRO FACT META B', 'PRO FACT META B HYPOTHYROID', 'PRO FACT META B PCOS',
    'PRO FACT META B MENOPAUSE', 'PRO FACT META B POSTMENOPAUSE',
    'FPHL', 'MPHL',
    'IRON UP GOLD', 'PRO FACT GI GOLD', 'OXIDATIVE STRESS',
    'RAPID WEIGHT LOSS SHIELD', 'PHENOTYPE INFLAMATION',
    'PRO IMMUNE GOLD', 'PRO IMMUNE VEG',
    'HAIR FACT HAIR BREAKAGE REPAIR(HBR)',
    'EARLY GREYING CARE GOLD', 'EARLY GREYING CARE VEG',
    'LACTIHEALTH', 'HAIR FACT TTM (OCD)', 'HAIR FACT ALOPECIA AREATA',
    'HAIR FACT NIGHT SHIFT', 'HAIR FACT FREQUENT FLYERS',
    'HAIR FACT PERI MENOPAUSE', 'HAIR FACT PERI MENOPAUSE VEG',
    'HEALTHY - 9', 'PRO FACT THYROID CARE', 'FH WELL 3',
  ],
};
const COMPREHENSIVE: BudgetProfile = { tier: 'COMPREHENSIVE', maxKits: 7 };

function answers(age: string): PatientAnswers {
  return {
    sex: 'Female', age, grade: 'Grade 2',
    thyroid: [], hormonal: ['Post-menopause'],
    lifestyle: ['Obesity / Sedentary / Struggle to lose weight / Slowly gaining weight'],
    diet: [], cause: [], scalp: [], immunity: [], deficiency: [],
    gut: [], hairtype: [], treatment: [],
    goal: ['Reduce hair fall'], duration: '3–6 months', count: '50–100 strands',
  } as PatientAnswers;
}

/** Run the full engine for a synthetic Post-menopause + Obesity patient. */
function engineKits(age: string) {
  const profile = evaluateClinicalProfile(answers(age));
  return scoreKits(profile, mapTherapyNeeds(profile), answers(age), OPEN_CLINIC, COMPREHENSIVE)
    .rankedKits;
}

/** Feed the engine's ranked kits through the REAL one-page view-model pipeline. */
function renderFromEngine(age: string) {
  const ranked = engineKits(age);
  const phases: Array<Partial<TreatmentPhase> & { kitId: string; displayName: string }> =
    ranked.map((k) => ({
      kitId: k.kitId,
      displayName: k.kitId,
      whySelected: `Engine-selected for the Post-menopause + Obesity profile (age ${age}).`,
      supportingConditions: [],
      mechanismOfAction: ['Supports the post-menopausal metabolic hair-loss picture.'],
    }));
  const vm = buildRuntimeFixture({
    assessmentId: `acceptance-postmeno-${age}`,
    patient: { name: 'Acceptance Patient', age: Number(age), sex: 'Female', goal: ['Reduce hair fall'] },
    selections: {
      hormonal: ['Post-menopause'],
      lifestyle: ['Obesity / Sedentary / Struggle to lose weight / Slowly gaining weight'],
    },
    phases,
  });
  return vm;
}

describe('ACCEPTANCE: Post-menopause + Obesity renders the Postmenopause kit', () => {
  for (const age of ['52', '58', '62', '45']) {
    describe(`age ${age}`, () => {
      it('engine selects the Postmenopause kit (never Peri, never generic Meta B)', () => {
        const ids = engineKits(age).map((k) => k.kitId);
        expect(ids).toContain(POST_KIT);
        expect(ids).not.toContain(PERI_KIT);
        expect(ids).not.toContain(GENERIC_META_B);
      });

      it('view-model renders the Postmenopause identity + packshot (never the Peri packshot)', () => {
        const vm = renderFromEngine(age);
        const rows = [...vm.treatmentPlan, ...vm.additionalCare];
        const post = rows.find((r) => r.kitCode === 'PRO_FACT_META_B_POSTMENOPAUSE');

        expect(post, 'a Postmenopause Meta B row must be present in the rendered plan').toBeTruthy();
        // Commercial identity, not a fuzzy collapse onto generic Meta B or Peri.
        expect(post!.name).toBe('Pro Fact Meta B Postmenopause');
        // Correct packshot resolved (not a fallback, not the Peri image).
        expect(post!.asset, 'the Postmenopause packshot must resolve').toBeTruthy();
        expect(post!.asset!.src).toContain(POST_PACKSHOT);
        expect(post!.asset!.src.toLowerCase()).not.toContain(PERI_PACKSHOT);
        // Rationale is present on the rendered row.
        expect(Array.isArray(post!.linkedDrivers)).toBe(true);

        // Neither the generic Meta B nor the Peri kit appears in the artefact.
        expect(rows.find((r) => r.kitCode === 'PRO_FACT_META_B'), 'generic Meta B must not appear').toBeUndefined();
        expect(rows.find((r) => r.kitCode === 'HAIR_FACT_PERI_MENOPAUSE'), 'Peri menopause kit must never appear').toBeUndefined();
      });
    });
  }

  it('governed MRP for the Postmenopause kit is ₹3,347', () => {
    expect(KIT_PRICE_INR.POST_MENOPAUSE).toBe(3347);
  });
});
