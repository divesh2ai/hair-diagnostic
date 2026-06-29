import type { PatientAnswers } from '../../types';
import type { ClinicalProfile } from '../clinical-engine/types';
import type { TherapyNeeds } from '../therapy-engine/types';

import type {
  KitRecommendation,
  ClinicConfig,
  BudgetProfile,
} from './types';

import { buildKitSequence } from './sequence/buildKitSequence';

// ─────────────────────────────────────────────────────────────────────────────
// KIT SCORER — CONDITION-FIRST ENGINE (2026-06-29 refactor)
//
// Public entry point. Delegates to the three-layer condition→registry→sequence
// engine in `./sequence/buildKitSequence`. Kept as a thin shim so the dozens
// of callers across runAssessmentPipeline / buildConsultation / report-engine
// continue to import { scoreKits } without changes.
//
// The previous template-driven flow (PROTOCOL_SEQUENCER + 18 patch rules) has
// been DELETED in favour of:
//   ①  detectConditions(ans, flags)        — every condition actually present
//   ②  resolveKitInteractions(detected)    — locked clinical interaction rules
//      + CONDITION_KIT_REGISTRY            — condition → canonical kit
//   ③  prioritizeKits(...)                 — locked sequencing doctrine
// ─────────────────────────────────────────────────────────────────────────────

export function scoreKits(
  profile: ClinicalProfile,
  therapyNeeds: TherapyNeeds,
  ans: PatientAnswers,
  clinicConfig: ClinicConfig,
  budgetProfile?: BudgetProfile,
): KitRecommendation {
  return buildKitSequence(profile, therapyNeeds, ans, clinicConfig, budgetProfile);
}
