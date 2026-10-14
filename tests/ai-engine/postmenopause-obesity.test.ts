import { describe, it, expect } from 'vitest';
import { scoreKits } from '../../src/packages/ai-engine/kit-scorer/scoreKits';
import { evaluateClinicalProfile } from '../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds } from '../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import { resolveKitInteractions } from '../../src/packages/ai-engine/kit-scorer/resolution/resolveKitInteractions';
import {
  CONDITION_KIT_REGISTRY,
  type ConditionId,
} from '../../src/packages/ai-engine/kit-scorer/registry/conditionKitRegistry';
import type { PatientAnswers } from '../../src/packages/types';
import type { ClinicConfig, BudgetProfile } from '../../src/packages/ai-engine/kit-scorer/types';
import type { ClinicalFlags } from '../../src/packages/ai-engine/clinical-engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// Post-menopause + Obesity → the EXISTING Postmenopause kit.
//
// Clarified clinical mapping (2026-10-14): a female patient who declares
// Post-menopause + Obesity must receive PRO FACT META B POSTMENOPAUSE
// (canonical POST_MENOPAUSE) — NOT HAIR FACT PERI MENOPAUSE, and NOT the
// generic PRO FACT META B. Age must never silently replace an explicitly
// selected Post-menopause condition with Peri-menopause.
//
// These lock the ACTIVE pipeline (scoreKits → buildKitSequence →
// resolveKitInteractions). The legacy menopauseContinuumInjectionRule has no
// live caller and is deliberately NOT exercised here.
// ─────────────────────────────────────────────────────────────────────────────

const POST_KIT = 'PRO FACT META B POSTMENOPAUSE';
const PERI_KIT = 'HAIR FACT PERI MENOPAUSE';
const GENERIC_META_B = 'PRO FACT META B';

const OPEN_CLINIC: ClinicConfig = {
  clinicId: 'test-clinic',
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

function run(ans: PatientAnswers) {
  const profile = evaluateClinicalProfile(ans);
  return scoreKits(profile, mapTherapyNeeds(profile), ans, OPEN_CLINIC, COMPREHENSIVE);
}

// resolveKitInteractions reads only flags.age.
const flagsAtAge = (age: number) => ({ age } as unknown as ClinicalFlags);

describe('Post-menopause + Obesity — end-to-end active pipeline', () => {
  for (const age of ['52', '58', '62', '45']) {
    it(`age ${age}: selects the Postmenopause kit, never Peri or generic Meta B`, () => {
      const kitIds = run(answers(age)).rankedKits.map((k) => k.kitId);
      expect(kitIds).toContain(POST_KIT);
      expect(kitIds).not.toContain(PERI_KIT);
      expect(kitIds).not.toContain(GENERIC_META_B);
    });
  }

  it('registry maps POST_MENOPAUSE to the existing postmenopause kit (no new SKU)', () => {
    expect(CONDITION_KIT_REGISTRY.POST_MENOPAUSE.kit).toBe(POST_KIT);
  });
});

describe('resolveKitInteractions — age never swaps Post-menopause to Peri', () => {
  for (const age of [45, 52, 58, 62]) {
    it(`age ${age}: METABOLIC folds into POST_MENOPAUSE; PERI never introduced; POST never dropped`, () => {
      const res = resolveKitInteractions(
        new Set<ConditionId>(['POST_MENOPAUSE', 'METABOLIC', 'AGA_PATTERN_FEMALE']),
        flagsAtAge(age),
      );
      expect(res.conditions).toContain('POST_MENOPAUSE');
      expect(res.conditions).not.toContain('PERI_MENOPAUSE');
      // METABOLIC folds into the postmenopause META B kit (POSTMENO_METABOLIC).
      expect(res.conditions).not.toContain('METABOLIC');
      // The postmenopause condition is NOT overridden to a different kit.
      expect(res.kitOverride.POST_MENOPAUSE).toBeUndefined();
    });
  }

  it('both Peri + Post declared: Post supersedes Peri (latest stage governs)', () => {
    const res = resolveKitInteractions(
      new Set<ConditionId>(['PERI_MENOPAUSE', 'POST_MENOPAUSE', 'METABOLIC']),
      flagsAtAge(52),
    );
    expect(res.conditions).toContain('POST_MENOPAUSE');
    expect(res.conditions).not.toContain('PERI_MENOPAUSE');
  });
});
