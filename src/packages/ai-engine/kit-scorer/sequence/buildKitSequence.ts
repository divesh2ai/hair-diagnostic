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
import { prioritizeKits, getPriorityDiagnostics } from '../ranking/kitPrioritizer';
import { signals } from '../../clinical-engine/signals';
import { buildAdjunctProtocol } from '../adjunctProtocolEngine';
import { evaluateSafety } from '../../safety-evaluator';
import { getKitInfo } from '../../../registries/kits/info';
import type {
  KitScoringDiagnostics,
  KitOrderingSource,
} from '../../recommendation-decision';

// ─────────────────────────────────────────────────────────────────────────────
// Opt-in diagnostics option. When { trace: true } is passed, buildKitSequence
// attaches a `diagnostics` field carrying the exact intermediate values used
// to produce the recommendation. No clinical rule is affected by this flag.
// ─────────────────────────────────────────────────────────────────────────────
export interface BuildKitSequenceOptions {
  readonly trace?: boolean;
  readonly therapyNeeds?: import('../../therapy-engine/types').TherapyNeeds;
}

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
  options?: BuildKitSequenceOptions,
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
  // Declared Iron / Anaemia deficiency lifts IRON UP GOLD to Phase 1 with the
  // same priority as heavy bleeding (locked 2026-07-13).
  const s = signals(ans);
  const hasDeclaredIronDeficiency =
    s.deficiency('Iron') || s.deficiency('Anaemia');
  const liftIronUpToHead = hasHeavyBleeding || hasDeclaredIronDeficiency;
  // TE GOLD stress/anxiety lift — locked clinical rule 2026-07-08.
  // ≤3-month acute window + declared psychogenic driver (Stress OR Anxiety) →
  // TE GOLD jumps between LACTIHEALTH and RAPID WEIGHT LOSS SHIELD, ahead of
  // every nutrient rescue. Duration >3 months is already blocked in
  // detectConditions (no ACUTE_SHEDDING → no TE GOLD in phases at all).
  const durationIsAcute =
    !!ans.duration && /1[–-]3|0[–-]3|under 3|less than 3/i.test(ans.duration);
  const hasStressOrAnxiety = (ans.cause ?? []).some((v) => {
    if (typeof v !== 'string') return false;
    const lower = v.toLowerCase();
    return lower.includes('stress') || lower.includes('anxiety');
  });
  const liftTeGoldForStress = durationIsAcute && hasStressOrAnxiety;

  // Oxidative-only inflammation flag — locked clinical rule. When the ONLY
  // driver behind PHENOTYPE INFLAMATION is oxidative lifestyle (smoking /
  // vaping / alcohol) with no visible scalp condition and no active shedding,
  // META B leads the sequence ahead of PHENOTYPE. See kitPrioritizer for the
  // resulting order.
  // Asthma excluded (locked 2026-07-18): immune condition, not a scalp
  // condition — must not suppress the oxidative-only sequencing branch.
  const hasVisibleScalpCondition =
    s.scalp('Redness') || s.scalp('irritation') || s.scalp('Boils') ||
    s.scalp('pimples') || s.scalp('Burning') || s.scalp('Flaking') ||
    s.scalp('Dandruff') || s.scalp('Oily') ||
    s.immunity('Allergies') || s.immunity('Skin rash') ||
    s.immunity('Alopecia Areata');
  const hasOxidativeLifestyle =
    s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol');
  const oxidativeOnlyInflammation =
    hasOxidativeLifestyle &&
    !hasVisibleScalpCondition &&
    !flags.hasActiveShedding;

  const sequenced = prioritizeKits(
    dedupKits,
    teGoldKit,
    ans.duration,
    liftIronUpToHead,
    liftTeGoldForStress,
    oxidativeOnlyInflammation,
  );

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

  // ── Canonical safety / eligibility evaluator ───────────────────────────────
  let safety: import('../../safety-evaluator').SafetyEvaluationResult | undefined;
  if (options?.trace) {
    const patientAgeNum = Number.parseInt(String(ans.age ?? profile.flags.age ?? 0), 10) || 0;
    const patientSexRaw = String(ans.sex ?? ans.gender ?? '');
    safety = evaluateSafety({
      answers: ans,
      patient: { age: patientAgeNum, sex: patientSexRaw },
      proposedKits: resolvedPhases,
      kitInteractionAudit: appliedRules,
    });
    if (safety.blockedKits.length > 0) {
      ruleTrace.push({
        rule: 'SAFETY_BLOCKED_KITS',
        before: resolvedPhases,
        after: resolvedPhases.filter((k) => !safety.blockedKits.includes(k)),
        reason: 'Canonical safety evaluator blocked kits — see safety.findings for rule ids.',
        signals: [...safety.blockedKits],
      });
    }
  }

  // ── PRO IMMUNE consolidation filler (locked clinical rule 2026-07-13) ──────
  // When the final protocol contains only 2 kits and PRO IMMUNE is not already
  // present, inject it as a consolidation layer. This preserves the design
  // intent of PRO IMMUNE as the "immune-restoration finisher" for thin stacks
  // without forcing it onto every larger protocol.
  const proImmuneVariant: KitId = isVeg ? 'PRO IMMUNE VEG' : 'PRO IMMUNE GOLD';
  const hasProImmune = resolvedPhases.some((k) => k.includes('PRO IMMUNE'));
  if (resolvedPhases.length === 2 && !hasProImmune) {
    resolvedPhases.push(proImmuneVariant);
    appliedRules.push(
      'PRO_IMMUNE_CONSOLIDATION_FILLER: stack had only 2 kits — PRO IMMUNE added as consolidation layer.',
    );
    if (!dedupRationales.has(proImmuneVariant)) {
      dedupRationales.set(proImmuneVariant, [
        'Consolidation layer — added because the protocol otherwise contains only two active drivers; PRO IMMUNE stabilises follicular immune signalling as the closing phase.',
      ]);
    }
  }

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

  // ── Optional diagnostics payload (opt-in via options.trace === true) ──────
  // Threads the ALREADY-COMPUTED intermediate values forward. This is not a
  // reconstruction — every value below was produced by the exact execution
  // that assembled `rankedKits`. The adapter (buildDecisions / buildTrace)
  // is forbidden from re-invoking detectConditions / resolveKitInteractions
  // and consumes only what is placed here.
  let diagnostics: KitScoringDiagnostics | undefined;
  if (options?.trace) {
    const finalOrder = rankedKits.map((s) => s.kitId);
    const conditionKitMap: Record<string, { conditions: ConditionId[]; rationales: string[] }> = {};
    for (const { kit } of conditionKits) {
      // Copy dedup output verbatim.
      const conds = dedupConditions.get(kit) ?? [];
      const rats = dedupRationales.get(kit) ?? [];
      conditionKitMap[kit] = { conditions: [...conds], rationales: [...rats] };
    }
    const orderingSources: Record<string, KitOrderingSource> = {};
    const compositionSafety: Record<string, import('../../recommendation-decision').KitSafetyProvenance> = {};
    const insertionIndex = new Map<string, number>();
    dedupKits.forEach((k, i) => insertionIndex.set(k, i));

    const relevantAudit = appliedRules;
    // Universe = candidates ∪ sequence-before-safety ∪ final ∪ blocked
    const universe = new Set<string>([
      ...dedupKits,
      ...resolvedPhases,
      ...finalOrder,
      ...safety.blockedKits,
    ]);
    for (const k of universe) {
      const cls = getPriorityDiagnostics(k);
      const cs = dedupConditions.get(k) ?? [];
      const auditLabels = relevantAudit.filter((line) =>
        cs.some((c) => line.includes(c)),
      );
      orderingSources[k] = {
        priorityOrderIndex: cls.priorityOrderIndex,
        inheritedInsertionIndex: insertionIndex.has(k) ? insertionIndex.get(k) : undefined,
        ruleLabels: auditLabels.length > 0 ? auditLabels : undefined,
        bucket: cls.bucket,
      };

      const info = getKitInfo(k);
      const therapies = info ? info.formulationRationale.flatMap((g) => g.ingredients) : [];
      const safetyRulesSet = new Set<string>();
      const blockedTherapiesSet = new Set<string>();

      if (safety) {
        for (const f of safety.findings) {
          let isApplicable = false;
          if (f.blockedKits?.includes(k)) {
            isApplicable = true;
          }
          if (f.blockedTopicals && f.blockedTopicals.length > 0) {
            const blockedInFinding = f.blockedTopicals.filter((bt) =>
              therapies.some((t) => t.toLowerCase() === bt.toLowerCase())
            );
            if (blockedInFinding.length > 0) {
              isApplicable = true;
              for (const bt of blockedInFinding) {
                blockedTherapiesSet.add(bt);
              }
            }
          }
          if (isApplicable) {
            safetyRulesSet.add(f.ruleId);
          }
        }
      }

      compositionSafety[k] = {
        kitId: k,
        therapies,
        safetyRules: [...safetyRulesSet],
        blockedTherapies: [...blockedTherapiesSet],
        compositionVerifiable: !!info,
      };
    }
    diagnostics = {
      detectedConditions: [...detected],
      therapyNeeds: [...therapyNeeds.needs],
      interactionResolution: resolution,
      candidateKits: [...dedupKits],
      legacySequenceBeforeSafety: [...resolvedPhases],
      finalSequenceAfterSafety: finalOrder,
      safetyEvaluation: safety,
      orderingSources,
      conditionKitMap,
      compositionSafety,
    };
  }

  return {
    rankedKits,
    protocolLabel,
    protocolRationale,
    selectionJustification,
    appliedRules,
    ruleTrace,
    adjunctProtocol,
    ...(safety ? { safety } : {}),
    ...(diagnostics ? { diagnostics } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern kits now use one Pro formulation for every grade.
// Veg/gender swaps still flow through resolveKit() afterwards.
// ─────────────────────────────────────────────────────────────────────────────
function resolveGradeAware(
  kit: KitId,
  condition: ConditionId,
  _isMale: boolean,
  _isGrade45: boolean,
): KitId {
  if (condition === 'AGA_PATTERN_MALE' || kit === 'MPHL PLUS') return 'MPHL';
  if (condition === 'AGA_PATTERN_FEMALE' || kit === 'FPHL PLUS') return 'FPHL';
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
