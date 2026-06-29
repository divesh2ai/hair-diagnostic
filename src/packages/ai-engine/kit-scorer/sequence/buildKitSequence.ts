import type { PatientAnswers, KitId, TherapyNeed } from '../../../types';
import type { ClinicalProfile } from '../../clinical-engine/types';
import type { TherapyNeeds } from '../../therapy-engine/types';
import type {
  KitRecommendation,
  ScoredKit,
  ClinicConfig,
  BudgetProfile,
  RuleTrace,
} from '../types';

import { detectConditions } from '../registry/detectConditions';
import {
  CONDITION_KIT_REGISTRY,
  type ConditionId,
} from '../registry/conditionKitRegistry';
import { resolveKitInteractions } from '../resolution/resolveKitInteractions';
import { resolveKit } from '../resolveKit';
import { prioritizeKits } from '../ranking/kitPrioritizer';
import { buildAdjunctProtocol } from '../adjunctProtocolEngine';

// ─────────────────────────────────────────────────────────────────────────────
// BUILD KIT SEQUENCE — three-layer architecture
//
//   Layer ① Condition Engine    detectConditions(ans, flags)
//   Layer ② Kit Resolution      resolveKitInteractions(conditions, flags)
//                               CONDITION_KIT_REGISTRY → kits
//   Layer ③ Sequence Engine     resolveKit() variants → prioritizeKits()
//
// Replaces the PROTOCOL_SEQUENCER template lookup. Each kit appears in the
// protocol ONLY because a condition the patient actually has put it there.
// No diagnosis-template assumptions, no hardcoded phases.
// ─────────────────────────────────────────────────────────────────────────────

export function buildKitSequence(
  profile: ClinicalProfile,
  therapyNeeds: TherapyNeeds,
  ans: PatientAnswers,
  clinicConfig: ClinicConfig,
  budgetProfile?: BudgetProfile,
): KitRecommendation {
  const { flags } = profile;
  const { isVeg, isMale, isGrade45 } = flags;

  const ruleTrace: RuleTrace[] = [];
  const appliedRules: string[] = [];

  // ── Layer ① — detect every condition the patient actually has ──────────────
  const detected = detectConditions(ans, flags);
  ruleTrace.push({
    rule: 'CONDITION_DETECTION',
    before: [],
    after: [],
    reason: `Detected ${detected.size} condition(s) from patient answers.`,
    signals: [...detected],
  });

  // ── Layer ② — resolve interactions (supersession / unification / mutex) ────
  const resolution = resolveKitInteractions(detected, flags);
  appliedRules.push(...resolution.applied);
  if (resolution.applied.length > 0) {
    ruleTrace.push({
      rule: 'KIT_INTERACTION_RESOLUTION',
      before: [...detected],
      after: resolution.conditions,
      reason: 'Locked clinical interaction rules applied (supersession / unification / mutex).',
      signals: resolution.applied,
    });
  }

  // ── Layer ② cont. — map surviving conditions to their canonical kits ───────
  const conditionKits: { condition: ConditionId; kit: KitId; rationale: string }[] = [];
  for (const condition of resolution.conditions) {
    const entry = CONDITION_KIT_REGISTRY[condition];
    if (!entry) continue;
    const baseKit = resolution.kitOverride[condition] ?? entry.kit;
    const resolved = resolveGradeAware(baseKit, condition, isMale, isGrade45);
    const variantResolved = resolveKit(resolved, isVeg, isMale);
    conditionKits.push({
      condition,
      kit: variantResolved,
      rationale: entry.rationale,
    });
  }

  // ── Dedup (same kit reachable from multiple conditions) ────────────────────
  const dedupKits: KitId[] = [];
  const dedupRationales = new Map<KitId, string[]>();
  const dedupConditions = new Map<KitId, ConditionId[]>();
  for (const { condition, kit, rationale } of conditionKits) {
    if (!dedupKits.includes(kit)) dedupKits.push(kit);
    const r = dedupRationales.get(kit) ?? [];
    r.push(rationale);
    dedupRationales.set(kit, r);
    const cs = dedupConditions.get(kit) ?? [];
    cs.push(condition);
    dedupConditions.set(kit, cs);
  }

  // ── Layer ③ — sequence by locked clinical doctrine ─────────────────────────
  const teGoldKit: KitId = isVeg ? 'HAIR FACT TE GOLD VEG' : 'HAIR FACT TE GOLD';
  const hasHeavyBleeding = (ans.hormonal ?? []).some(
    (v) => typeof v === 'string' && v.toLowerCase().includes('heavy bleeding'),
  );
  const sequenced = prioritizeKits(dedupKits, teGoldKit, ans.duration, hasHeavyBleeding);

  // ── Clinic substitutions (only when clinic restricts available kits) ──────
  const resolvedPhases = sequenced.map((k) => {
    if (
      clinicConfig.availableKits.length > 0 &&
      !clinicConfig.availableKits.includes(k)
    ) {
      return clinicConfig.substitutions?.[k] ?? k;
    }
    return k;
  });

  // ── Budget cap (optional) ──────────────────────────────────────────────────
  const maxKits = budgetProfile?.maxKits ?? resolvedPhases.length;
  const capped = resolvedPhases.slice(0, maxKits);

  // ── Build scored kits with PATIENT-SPECIFIC reasons (no generic blurbs) ────
  const rankedKits: ScoredKit[] = capped.map((kitId, i) => {
    const reasons = dedupRationales.get(kitId) ?? [
      `Selected as part of the recovery protocol.`,
    ];
    const matchedConditions = dedupConditions.get(kitId) ?? [];
    const therapyNeedSet = new Set<TherapyNeed>();
    for (const cond of matchedConditions) {
      const entry = CONDITION_KIT_REGISTRY[cond];
      if (entry) {
        for (const n of entry.therapyNeeds) therapyNeedSet.add(n);
      }
    }
    const matchedNeeds = [...therapyNeedSet].filter((n) =>
      therapyNeeds.needs.includes(n),
    );

    return {
      kitId,
      score: Math.max(100 - i * 8, 40),
      matchedNeeds,
      reasons,
      phase: i + 1,
    };
  });

  // ── Build the human-readable label + rationale ─────────────────────────────
  const protocolLabel = buildProtocolLabel(resolution.conditions, flags);
  const protocolRationale = buildProtocolRationale(resolution.conditions);
  const selectionJustification = buildSelectionJustification(
    resolution.conditions,
    capped,
    appliedRules,
  );

  // ── Adjunct protocol (unchanged — still uses scalp states + raw answers) ───
  const adjunctProtocol = buildAdjunctProtocol(profile.scalpStates, ans);

  return {
    rankedKits,
    protocolLabel,
    protocolRationale,
    selectionJustification,
    appliedRules,
    ruleTrace,
    adjunctProtocol,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade-aware variant resolution (FPHL/MPHL → PLUS for Grade 4/5).
// Veg/gender swaps still flow through resolveKit() afterwards.
// ─────────────────────────────────────────────────────────────────────────────
function resolveGradeAware(
  kit: KitId,
  condition: ConditionId,
  isMale: boolean,
  isGrade45: boolean,
): KitId {
  if (!isGrade45) return kit;
  if (condition === 'AGA_PATTERN_MALE') return 'MPHL PLUS';
  if (condition === 'AGA_PATTERN_FEMALE') return 'FPHL PLUS';
  return kit;
}

// ─────────────────────────────────────────────────────────────────────────────
// Label / rationale builders — patient-specific copy
// ─────────────────────────────────────────────────────────────────────────────
function buildProtocolLabel(conditions: ConditionId[], flags: ClinicalFlagsLite): string {
  if (conditions.length === 0) return 'No clinical conditions detected.';
  const labels = conditions.map((c) => CONDITION_KIT_REGISTRY[c]?.label).filter(Boolean);
  if (labels.length === 1) return `Recovery protocol for ${labels[0]}.`;
  return `Recovery protocol for ${labels.length} condition(s): ${labels.join(' · ')}.`;
}

function buildProtocolRationale(conditions: ConditionId[]): string {
  if (conditions.length === 0) {
    return 'No clinical conditions were detected from your answers — no kits prescribed.';
  }
  const rationales = conditions
    .map((c) => CONDITION_KIT_REGISTRY[c])
    .filter(Boolean)
    .map((entry) => entry.rationale);
  return rationales.join(' ');
}

function buildSelectionJustification(
  conditions: ConditionId[],
  phases: KitId[],
  appliedRules: string[],
): string {
  const lines: string[] = [
    `Detected conditions: ${conditions.length === 0 ? '(none)' : conditions.join(', ')}`,
    '',
    'Phase sequence:',
    ...phases.map((k, i) => `Phase ${i + 1}: ${k}`),
  ];
  if (appliedRules.length > 0) {
    lines.push('', 'Applied interaction rules:');
    for (const r of appliedRules) lines.push(`• ${r}`);
  }
  return lines.join('\n');
}

type ClinicalFlagsLite = { isMale: boolean; isGrade45: boolean };
