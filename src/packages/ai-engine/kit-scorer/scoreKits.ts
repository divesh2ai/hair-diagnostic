import type { PatientAnswers, KitId, TherapyNeed } from '../../types';
import type { ClinicalProfile } from '../clinical-engine/types';
import type { TherapyNeeds } from '../therapy-engine/types';

import type {
  KitRecommendation,
  KitScorerContext,
  ScoredKit,
  ClinicConfig,
  BudgetProfile,
} from './types';

import { PROTOCOL_SEQUENCER } from './protocolSequencer';
import { resolveKit } from './resolveKit';

import { applyRegrowGoalRule } from './rules/regrowGoalRule';
import { applyMetabolicModifierRule } from './rules/metabolicModifierRule';
import { applyPcosStackRule } from './rules/pcosStackRule';
import { applyGLP1PrecedenceRule } from './rules/glp1PrecedenceRule';
import { applyActiveSheddingRule, applyFinalNoVisibleFallRule } from './rules/activeSheddingRule';
import { applySignalGatedInjectionRule } from './rules/signalGatedInjectionRule';
import { applyProImmuneLastRule } from './rules/proImmuneLastRule';
import { applyGreyGoalRule } from './rules/greyGoalRule';

import { prioritizeKits } from './ranking/kitPrioritizer';
import { buildAdjunctProtocol } from './adjunctProtocolEngine';

// ─────────────────────────────────────────────────────────────────────────────
// RULE TRACE TYPES
// ─────────────────────────────────────────────────────────────────────────────

type RuleTrace = {
  rule: string;
  before: KitId[];
  after: KitId[];
  reason: string;
  signals?: string[];
};

function traceRule(
  ctx: KitScorerContext,
  trace: RuleTrace
): KitScorerContext {
  return {
    ...ctx,
    ruleTrace: [...(ctx.ruleTrace || []), trace],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KIT SCORER — CLINICAL-FIRST ENGINE
// NO BUDGET CAPS
// NO KIT LIMITS
// PATIENT CONDITION DRIVES PROTOCOL
// ─────────────────────────────────────────────────────────────────────────────

export function scoreKits(
  profile: ClinicalProfile,
  therapyNeeds: TherapyNeeds,
  ans: PatientAnswers,
  clinicConfig: ClinicConfig,
  _budgetProfile?: BudgetProfile,
): KitRecommendation {

  const { primaryDiagnosis, flags } = profile;
  const { isVeg, isMale } = flags;

  // ── BASE PROTOCOL
  const proto =
    PROTOCOL_SEQUENCER[primaryDiagnosis] ??
    PROTOCOL_SEQUENCER['TE_STRESS'];

  const basePhases: KitId[] = [...proto.phases];

  // ── INITIAL CONTEXT
  let ctx: KitScorerContext = {
    phases: basePhases,
    flags,
    therapyNeeds,
    appliedRules: [],
    ruleTrace: [],
  };

  // ───────────────────────────────────────────────────────────────────────
  // RULE 1 — REGROW GOAL
  // ───────────────────────────────────────────────────────────────────────

  const beforeRegrow = [...ctx.phases];

  ctx = applyRegrowGoalRule(ctx, primaryDiagnosis);

  if (JSON.stringify(beforeRegrow) !== JSON.stringify(ctx.phases)) {
    ctx = traceRule(ctx, {
      rule: 'REGROW_GOAL',
      before: beforeRegrow,
      after: ctx.phases,
      reason:
        'Regrowth-focused pathway selected. Protocol adjusted to prioritize follicular recovery.',
      signals: ['REGROWTH']
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // RULE 2 — METABOLIC MODIFIER
  // ───────────────────────────────────────────────────────────────────────

  const beforeMeta = [...ctx.phases];

  ctx = applyMetabolicModifierRule(ctx, ans, primaryDiagnosis);

  if (JSON.stringify(beforeMeta) !== JSON.stringify(ctx.phases)) {
    ctx = traceRule(ctx, {
      rule: 'METABOLIC_MODIFIER',
      before: beforeMeta,
      after: ctx.phases,
      reason:
        'Metabolic dysfunction detected. PRO FACT META B added for insulin resistance / metabolic restoration support.',
      signals: ['METABOLIC_SIGNAL']
    });
  }

  const metaBAlreadyCovered = ctx.phases.some((k) =>
    k.includes('PRO FACT META B')
  );

  // ───────────────────────────────────────────────────────────────────────
  // RULE 3 — PCOS STACK
  // ───────────────────────────────────────────────────────────────────────

  const beforePCOS = [...ctx.phases];

  ctx = applyPcosStackRule(ctx, ans, primaryDiagnosis);

  if (JSON.stringify(beforePCOS) !== JSON.stringify(ctx.phases)) {
    ctx = traceRule(ctx, {
      rule: 'PCOS_STACK',
      before: beforePCOS,
      after: ctx.phases,
      reason:
        'PCOS hormonal imbalance detected. Androgen correction + metabolic stabilization protocol applied.',
      signals: ['PCOS']
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // KIT RESOLUTION
  // ───────────────────────────────────────────────────────────────────────

  ctx = {
    ...ctx,
    phases: ctx.phases.map((k) => resolveKit(k, isVeg, isMale)),
  };

  // ───────────────────────────────────────────────────────────────────────
  // DEDUP
  // ───────────────────────────────────────────────────────────────────────

  ctx = {
    ...ctx,
    phases: [...new Set(ctx.phases.filter(Boolean))],
  };

  // ───────────────────────────────────────────────────────────────────────
  // AGA FEMALE UNDER 30
  // ───────────────────────────────────────────────────────────────────────

  if (
    primaryDiagnosis === 'AGA_FEMALE_123' &&
    !isMale &&
    ctx.flags.age < 30 &&
    (profile.rootCauses.includes('GENETICS') || profile.rootCauses.includes('DHT'))
  ) {
    const teGold: KitId = isVeg ? 'HAIR FACT TE GOLD VEG' : 'HAIR FACT TE GOLD';
    const proImmune: KitId = isVeg ? 'PRO IMMUNE VEG' : 'PRO IMMUNE GOLD';
    ctx = {
      ...ctx,
      phases: [teGold, proImmune],
      appliedRules: [
        ...ctx.appliedRules,
        'AGA_FEMALE_UNDER30: Female under 30 with genetics. Follicle not yet miniaturised — TE GOLD + PRO IMMUNE instead of FPHL.',
      ],
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // SIGNAL GATED INJECTION
  // ───────────────────────────────────────────────────────────────────────

  ctx = applySignalGatedInjectionRule(
    ctx,
    ans,
    primaryDiagnosis,
    metaBAlreadyCovered
  );

  // ───────────────────────────────────────────────────────────────────────
  // GREYING GOAL
  // ───────────────────────────────────────────────────────────────────────

  ctx = applyGreyGoalRule(ctx, flags);

  // ───────────────────────────────────────────────────────────────────────
  // GLP-1 PRECEDENCE
  // ───────────────────────────────────────────────────────────────────────

  const beforeGLP1 = [...ctx.phases];

  ctx = applyGLP1PrecedenceRule(ctx);

  if (JSON.stringify(beforeGLP1) !== JSON.stringify(ctx.phases)) {
    ctx = traceRule(ctx, {
      rule: 'GLP1_PRECEDENCE',
      before: beforeGLP1,
      after: ctx.phases,
      reason:
        'GLP-1 exposure within 6 months with rapid weight loss detected. RAPID WEIGHT LOSS SHIELD prioritized first to stabilize acute shedding before endocrine correction.',
      signals: ['GLP1', 'RAPID_WEIGHT_LOSS']
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // ACTIVE SHEDDING
  // ───────────────────────────────────────────────────────────────────────

  const beforeShedding = [...ctx.phases];

  ctx = applyActiveSheddingRule(ctx, primaryDiagnosis);

  if (JSON.stringify(beforeShedding) !== JSON.stringify(ctx.phases)) {
    ctx = traceRule(ctx, {
      rule: 'ACTIVE_SHEDDING',
      before: beforeShedding,
      after: ctx.phases,
      reason:
        'Active shedding detected. TE GOLD elevated as immediate follicular stabilization priority.',
      signals: ['ACTIVE_SHEDDING']
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // PRIORITIZATION
  // ───────────────────────────────────────────────────────────────────────

  const teGoldKit: KitId =
    isVeg
      ? 'HAIR FACT TE GOLD VEG'
      : 'HAIR FACT TE GOLD';

  ctx = {
    ...ctx,
    phases: prioritizeKits(ctx.phases, teGoldKit),
  };

  // ───────────────────────────────────────────────────────────────────────
  // GLP-1 PRECEDENCE — second pass (survives priority lifting)
  // ───────────────────────────────────────────────────────────────────────

  ctx = applyGLP1PrecedenceRule(ctx);

  // ───────────────────────────────────────────────────────────────────────
  // FINAL NO VISIBLE FALL — safety strip after prioritization
  // ───────────────────────────────────────────────────────────────────────

  ctx = applyFinalNoVisibleFallRule(ctx);

  // ───────────────────────────────────────────────────────────────────────
  // PRO IMMUNE ALWAYS LAST
  // ───────────────────────────────────────────────────────────────────────

  ctx = applyProImmuneLastRule(ctx);

  // ───────────────────────────────────────────────────────────────────────
  // PREGNANCY SAFETY OVERRIDE
  // ───────────────────────────────────────────────────────────────────────

  if (primaryDiagnosis === 'PREGNANCY') {
    ctx = {
      ...ctx,
      phases: ['HEALTHY - 9'],
      appliedRules: [
        ...ctx.appliedRules,
        'PREGNANCY_LOCK: single-kit protocol enforced. All other kits suppressed — safety constraint.',
      ],
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // SAFETY FALLBACK
  // ───────────────────────────────────────────────────────────────────────

  const finalPhases: KitId[] =
    ctx.phases.length > 0
      ? ctx.phases
      : PROTOCOL_SEQUENCER['TE_STRESS'].phases;

  // ───────────────────────────────────────────────────────────────────────
  // CLINIC SUBSTITUTIONS
  // ───────────────────────────────────────────────────────────────────────

  const resolvedPhases = finalPhases.map((k) => {

    if (
      clinicConfig.availableKits.length > 0 &&
      !clinicConfig.availableKits.includes(k)
    ) {
      return clinicConfig.substitutions?.[k] ?? k;
    }

    return k;
  });

  // ───────────────────────────────────────────────────────────────────────
  // SCORED OUTPUT
  // ───────────────────────────────────────────────────────────────────────

const rankedKits: ScoredKit[] = resolvedPhases.map((kitId, i) => ({
  kitId,
  score: Math.max(100 - i * 8, 40),
  matchedNeeds: matchKitToNeeds(kitId, therapyNeeds.needs),
  reasons: buildKitReasons(kitId, profile),
  phase: i + 1,
}));

const maxKits =
  _budgetProfile?.maxKits ??
  rankedKits.length;

const cappedKits = rankedKits.slice(0, maxKits);

  // ── ADJUNCT PROTOCOL ENRICHMENT ─────────────────────────────────────────
  // Run AFTER core kits are finalized. Uses scalp states (already computed
  // by evaluateClinicalProfile) and treatment history from raw answers.
  const adjunctProtocol = buildAdjunctProtocol(profile.scalpStates, ans);

return {
  rankedKits: cappedKits,
  protocolLabel: proto.label,
  protocolRationale: proto.rationale,
  selectionJustification: buildSelectionJustification(profile, ctx, proto),
  appliedRules: ctx.appliedRules,
  ruleTrace: ctx.ruleTrace ?? [],
  adjunctProtocol,
};
}

// ─────────────────────────────────────────────────────────────────────────────
// KIT → THERAPY NEED MAP
// ─────────────────────────────────────────────────────────────────────────────

const KIT_NEED_MAP: Record<string, TherapyNeed[]> = {
  // Shedding arrest
  'HAIR FACT TE GOLD': ['SHEDDING_ARREST'],
  'HAIR FACT TE GOLD VEG': ['SHEDDING_ARREST'],
  // Inflammation
  'PHENOTYPE INFLAMATION': ['INFLAMMATION_CONTROL'],
  // Immune / follicle stimulation
  'PRO IMMUNE GOLD': ['IMMUNE_MODULATION', 'FOLLICLE_STIMULATION'],
  'PRO IMMUNE VEG': ['IMMUNE_MODULATION', 'FOLLICLE_STIMULATION'],
  // DHT suppression
  'FPHL': ['DHT_SUPPRESSION'],
  'FPHL PLUS': ['DHT_SUPPRESSION'],
  'MPHL': ['DHT_SUPPRESSION'],
  'MPHL PLUS': ['DHT_SUPPRESSION'],
  // Metabolic support
  'PRO FACT META B': ['METABOLIC_SUPPORT'],
  'PRO FACT META B PCOS': ['METABOLIC_SUPPORT', 'ANDROGENIC_CORRECTION'],
  'PRO FACT META B HYPOTHYROID': ['THYROID_SUPPORT'],
  'PRO FACT META B POSTMENOPAUSE': ['HORMONAL_REBALANCING'],
  // Iron
  'IRON UP GOLD': ['IRON_REPLETION'],
  // Weight loss
  'RAPID WEIGHT LOSS SHIELD': ['WEIGHT_LOSS_RECOVERY', 'SHEDDING_ARREST'],
  // PCOS androgenic correction
  'F-PCOS -1': ['ANDROGENIC_CORRECTION'],
  'F-PCOS VEG -1': ['ANDROGENIC_CORRECTION'],
  // Hormonal rebalancing
  'HAIR FACT PERI MENOPAUSE': ['HORMONAL_REBALANCING'],
  'HAIR FACT PERI MENOPAUSE VEG': ['HORMONAL_REBALANCING'],
  // Lactation / pregnancy
  'LACTIHEALTH': ['LACTATION_SUPPORT'],
  'HEALTHY - 9': ['PREGNANCY_SUPPORT'],
  // Greying
  'EARLY GREYING CARE GOLD': ['MELANOCYTE_PROTECTION'],
  'EARLY GREYING CARE VEG': ['MELANOCYTE_PROTECTION'],
  // Oxidative stress
  'OXIDATIVE STRESS': ['ANTIOXIDANT_SUPPORT'],
  // Gut
  'PRO FACT GI GOLD': ['GUT_RESTORATION'],
  // Shaft / breakage
  'HAIR FACT HAIR BREAKAGE REPAIR(HBR)': ['SHAFT_REPAIR'],
  // Circadian
  'HAIR FACT NIGHT SHIFT': ['CIRCADIAN_RESET'],
  'HAIR FACT FREQUENT FLYERS': ['CIRCADIAN_RESET'],
  // Alopecia areata
  'HAIR FACT ALOPECIA AREATA': ['IMMUNE_MODULATION', 'FOLLICLE_STIMULATION'],
  // Neurological
  'HAIR FACT TTM (OCD)': ['NEUROLOGICAL_OCD_SUPPORT'],
};

function matchKitToNeeds(
  kitId: KitId,
  patientNeeds: readonly TherapyNeed[]
): TherapyNeed[] {

  const kitNeeds: TherapyNeed[] =
    KIT_NEED_MAP[kitId] ?? [];

  return kitNeeds.filter((n) =>
    patientNeeds.includes(n)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REASON BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildKitReasons(
  kitId: KitId,
  profile: ClinicalProfile
): string[] {

  const reasons: string[] = [];

  if (kitId.includes('TE GOLD')) {
    reasons.push(
      'Active shedding detected. Follicular stabilization required immediately.'
    );
  }

  if (kitId.includes('META B')) {
    reasons.push(
      'Metabolic dysfunction detected requiring systemic correction support.'
    );
  }

  if (kitId.includes('FPHL')) {
    reasons.push(
      'Female pattern hair loss detected requiring androgen modulation.'
    );
  }

  if (kitId.includes('MPHL')) {
    reasons.push(
      'Male pattern hair loss detected requiring DHT suppression.'
    );
  }

  if (kitId === 'RAPID WEIGHT LOSS SHIELD') {
    reasons.push(
      'Rapid weight loss / GLP-1 induced nutritional stress detected.'
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      `Protocol support added for ${profile.primaryDiagnosis}.`
    );
  }

  return reasons;
}

// ─────────────────────────────────────────────────────────────────────────────
// JUSTIFICATION BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildSelectionJustification(
  profile: ClinicalProfile,
  ctx: KitScorerContext,
  proto: { label: string; rationale: string }
): string {

  const lines: string[] = [
    `Clinical protocol matched: ${proto.label}`,
    `Rationale: ${proto.rationale}`,
    '',
    'Phase sequence:',
    ...ctx.phases.map(
      (k, i) =>
        `Phase ${i + 1}: ${k}`
    ),
    '',
    `Primary diagnosis: ${profile.primaryDiagnosis}`,
    '',
    'Applied rules:',
    ...ctx.appliedRules.map((r) => `• ${r}`),
  ];

  return lines.join('\n');
}