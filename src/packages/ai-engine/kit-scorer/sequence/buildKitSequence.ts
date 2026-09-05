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
import { prioritizeKits, getPriorityDiagnostics, isPatternKit } from '../ranking/kitPrioritizer';
import { signals } from '../../clinical-engine/signals';
import { buildAdjunctProtocol } from '../adjunctProtocolEngine';
import { evaluateSafety } from '../../safety-evaluator';
import { hasHbrTreatmentDamageIndication } from '../../contracts/hbrIndication';
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
    // Bound to a const before use: `safety` is a `let`, and TypeScript drops
    // its narrowing inside the arrow function on the `after:` line below.
    const evaluated = evaluateSafety({
      answers: ans,
      patient: { age: patientAgeNum, sex: patientSexRaw },
      proposedKits: resolvedPhases,
      kitInteractionAudit: appliedRules,
    });
    safety = evaluated;
    if (evaluated.blockedKits.length > 0) {
      ruleTrace.push({
        rule: 'SAFETY_BLOCKED_KITS',
        before: resolvedPhases,
        after: resolvedPhases.filter((k) => !evaluated.blockedKits.includes(k)),
        reason: 'Canonical safety evaluator blocked kits — see safety.findings for rule ids.',
        signals: [...evaluated.blockedKits],
      });
    }
  }

  // ── GI GOLD THIN-STACK CARVE-OUT (locked clinical rule 2026-08-31) ────────
  // Narrow exception to the GI GOLD trigger lock (2026-06-14), which otherwise
  // reserves PRO FACT GI GOLD for GERD / IBS / Acid reflux / Crohn and never
  // lets Bloating / Constipation / Indigestion reach it.
  //
  // The exception fires ONLY when every one of these holds together:
  //   • a mild gut signal is declared (Constipation / Bloating / Indigestion),
  //   • Stress / Anxiety / Depression is declared,
  //   • the resolved protocol carries 2 kits or fewer,
  //   • the patient is under 30,
  //   • the goal includes reducing hair fall.
  //
  // Rationale: on a thin stack in a young patient the gut-axis contribution is
  // the largest untreated driver left in the picture, and mild dysbiosis still
  // gates iron / B12 / amino-acid uptake for every downstream kit. Outside this
  // exact combination the 2026-06-14 lock stands unchanged.
  //
  // SCOPE NOTE — this treats the GUT axis only. GI GOLD carries no melatonin
  // and no adaptogen (F-IMMUSurge, F-TRICHO CUMIN, F-LACTOCOL, F-TRICHORISE,
  // F-TRICHO STRONG, F-KINTOX-HYA, F-B SHINE, F-D-ENZYSTIVE, F-DAILY D), so the
  // declared Stress / Anxiety acts as a GATING CONDITION that narrows the
  // exception — not as something this kit treats. The psychogenic driver stays
  // clinically unaddressed by this rule.
  //
  // Placement: Phase 2, immediately after the Phase-1 terrain kit, rather than
  // the Phase-1 lead that GI_GOLD_HEAD gives it on its normal trigger path.
  //
  // PATTERN-KIT GUARD — GI GOLD must never land behind a pattern kit. On a
  // 1-kit protocol whose only kit is FPHL / MPHL, a literal index-1 insert
  // would read "Phase 1 FPHL → Phase 2 GI GOLD", inverting two locked
  // doctrines at once: PATTERN_KITS_LAST ("pattern correction always last")
  // and GI_GOLD_HEAD ("absorption gates every downstream nutrient kit"). So
  // the insert point is index 1 capped at the first pattern kit's index:
  //
  //   [PHENOTYPE, FPHL]  → [PHENOTYPE, GI GOLD, FPHL]   (Phase 2, as intended)
  //   [FPHL]             → [GI GOLD, FPHL]              (ahead of pattern)
  //   [PHENOTYPE]        → [PHENOTYPE, GI GOLD]         (Phase 2, as intended)
  //
  // Suppresses the PRO IMMUNE consolidation filler below — the carve-out is
  // itself the padding for this stack, and both must not fire together.
  // Both thin-stack exceptions below measure the protocol as the condition
  // engine resolved it — BEFORE either exception pads it. Captured once so the
  // second exception cannot be starved by the first one's insert.
  const resolvedProtocolSize = resolvedPhases.length;

  // ── CEO HOLD — clinic launch freeze, 2026-09-04 ──────────────────────────
  // This carve-out CHANGES the dispensed protocol: on a thin stack it inserts
  // PRO FACT GI GOLD that the frozen engine did not recommend (for example
  // female 24, bloating + stress: [FPHL] became [GI GOLD, META B, FPHL]). That
  // is a clinical output change, and it was not approved for launch.
  //
  // Held OFF rather than deleted. The rule, its rationale and its test suite
  // are intact and unmodified below; re-enabling is this one flag. The 2026-06-14
  // GI GOLD trigger lock (GERD / IBS / Acid reflux / Crohn only, at Phase 1)
  // therefore stands unqualified, exactly as it did before this rule was written.
  //
  // Do not flip this to `true` without CEO sign-off on the kit-output change.
  const GI_GOLD_THIN_STACK_CARVE_OUT_ENABLED = false;

  const giGoldKit: KitId = resolveKit('PRO FACT GI GOLD', isVeg, isMale);
  const alreadyHasGiGold = resolvedPhases.some((k) => k.includes('GI GOLD'));
  const hasMildGutSignal =
    s.gut('Constipation') || s.gut('Bloating') || s.gut('Indigestion');
  const hasPsychogenicDriver =
    s.cause('Stress') || s.cause('Anxiety') || s.cause('Depression') ||
    s.lifestyle('Stress') || s.lifestyle('Anxiety') || s.lifestyle('Depression');
  const giGoldCarveOutApplies =
    GI_GOLD_THIN_STACK_CARVE_OUT_ENABLED &&
    !alreadyHasGiGold &&
    hasMildGutSignal &&
    hasPsychogenicDriver &&
    resolvedProtocolSize <= 2 &&
    flags.age < 30 &&
    flags.hasHairGoal;

  if (giGoldCarveOutApplies) {
    const before = [...resolvedPhases];
    // Phase 2 — after the Phase-1 terrain kit, but never behind a pattern kit.
    const firstPatternIdx = resolvedPhases.findIndex((k) => isPatternKit(k));
    const insertAt = firstPatternIdx >= 0 ? Math.min(1, firstPatternIdx) : 1;
    resolvedPhases.splice(insertAt, 0, giGoldKit);
    appliedRules.push(
      'GI_GOLD_THIN_STACK_CARVE_OUT: PRO FACT GI GOLD added at Phase 2 — mild gut signal + declared Stress / Anxiety on a ≤ 2-kit protocol, patient under 30, goal includes reducing hair fall. Narrow exception to the GERD / IBS / Acid / Crohn trigger lock; treats the gut axis only.',
    );
    ruleTrace.push({
      rule: 'GI_GOLD_THIN_STACK_CARVE_OUT',
      before,
      after: [...resolvedPhases],
      reason:
        'Thin protocol in a patient under 30 with a mild gut signal, declared psychogenic driver and a hair-fall goal — gut-axis absorption is the largest untreated driver left, so GI GOLD takes Phase 2.',
      signals: [...(ans.gut ?? []), ...(ans.cause ?? []), ...(ans.lifestyle ?? [])],
    });
    if (!dedupRationales.has(giGoldKit)) {
      dedupRationales.set(giGoldKit, [
        'Digestive symptoms reported alongside a thin protocol — restores epithelial integrity and absorption so the iron, B12 and amino acids the other kits depend on actually reach the follicle.',
      ]);
    }
  }

  // ── META B THIN-STACK STRESS CARVE-OUT (locked clinical rule 2026-08-31) ──
  // Companion exception to the GI GOLD carve-out above. Fires when:
  //   • Stress / Anxiety / Depression is declared,
  //   • the resolved protocol carries 2 kits or fewer,
  //   • the patient is under 30.
  //
  // Independent of the gut leg — a young patient on a thin protocol who
  // declared a psychogenic driver gets META B whether or not they reported any
  // gut symptom. Measured against resolvedProtocolSize, so the GI GOLD insert
  // above does not consume the slot this rule is testing for.
  //
  // Why META B specifically: it is the only kit carrying the melatonin-family
  // active (F-EASME) that also sits on the androgen / metabolic axis, so it is
  // the one option that covers a psychogenic driver in a young pattern-loss
  // picture without reaching for TE GOLD — which is correctly out of scope once
  // shedding has passed the 1–3 month acute window (see detectConditions'
  // ACUTE_SHEDDING gate). Its own signal-gated route needs a thinning /
  // widening / parting hairtype or genetics-after-30, so a 22-year-old with
  // diffuse shedding never reaches it on the normal path.
  //
  // Placement: ahead of any pattern kit, behind GI GOLD when that fired —
  // matching META_B_GENERIC's position in kitPrioritizer (after GI_GOLD_HEAD,
  // before PRO IMMUNE, pattern kits last).
  //
  //   [FPHL]           → [META B, FPHL]
  //   [GI GOLD, FPHL]  → [GI GOLD, META B, FPHL]
  //   [PHENOTYPE]      → [PHENOTYPE, META B]
  //
  // Suppresses the PRO IMMUNE consolidation filler below for the same reason
  // the GI GOLD carve-out does — this rule is the padding for these stacks.
  // ── CEO HOLD — clinic launch freeze, 2026-09-04 ──────────────────────────
  // Not approved for launch, because it changes the dispensed protocol two
  // ways, and the second is the serious one:
  //
  //   · padding — 24F stress-only: [FPHL] became [META B, FPHL];
  //   · IDENTITY SUBSTITUTION — 28F acute TE + stress:
  //     [TE GOLD, FPHL, PRO IMMUNE GOLD] became [TE GOLD, META B, FPHL].
  //     The insert took the stack to 3, which suppressed the PRO IMMUNE
  //     consolidation filler, so a kit was not added but SWAPPED.
  //
  // Held OFF rather than deleted, exactly like the GI GOLD carve-out above.
  // META B keeps every approved route it already had — the hypothyroid variant,
  // the PCOS variants, the metabolic/obesity substitution, the over-30 signal
  // path — because none of them run through this flag. Only the new
  // under-30-thin-stack-stress exception is suppressed.
  //
  // Do not flip this to `true` without CEO sign-off on the kit-output change.
  const META_B_THIN_STACK_CARVE_OUT_ENABLED = false;

  const metaBKit: KitId = resolveKit('PRO FACT META B', isVeg, isMale);
  const alreadyHasMetaB = resolvedPhases.some((k) => k.includes('META B'));
  const metaBCarveOutApplies =
    META_B_THIN_STACK_CARVE_OUT_ENABLED &&
    !alreadyHasMetaB &&
    hasPsychogenicDriver &&
    resolvedProtocolSize <= 2 &&
    flags.age < 30;

  if (metaBCarveOutApplies) {
    const before = [...resolvedPhases];
    const firstPatternIdx = resolvedPhases.findIndex((k) => isPatternKit(k));
    const insertAt = firstPatternIdx >= 0 ? firstPatternIdx : resolvedPhases.length;
    resolvedPhases.splice(insertAt, 0, metaBKit);
    appliedRules.push(
      'META_B_THIN_STACK_STRESS_CARVE_OUT: PRO FACT META B added — declared Stress / Anxiety / Depression on a ≤ 2-kit protocol, patient under 30. META B carries the melatonin-family active on the androgen / metabolic axis; TE GOLD is out of scope outside the 1–3 month acute window.',
    );
    ruleTrace.push({
      rule: 'META_B_THIN_STACK_STRESS_CARVE_OUT',
      before,
      after: [...resolvedPhases],
      reason:
        'Thin protocol in a patient under 30 with a declared psychogenic driver — the stress axis would otherwise go uncovered, and META B is the melatonin-carrying kit that fits a young pattern-loss picture.',
      signals: [...(ans.cause ?? []), ...(ans.lifestyle ?? [])],
    });
    if (!dedupRationales.has(metaBKit)) {
      dedupRationales.set(metaBKit, [
        'Stress or anxiety reported alongside a thin protocol — supports the metabolic terrain and circadian signalling that sustained cortisol disrupts, so the follicle can hold its growth phase.',
      ]);
    }
  }

  // ── HBR TREATMENT FILLER (locked clinical rule 2026-08-27) ────────────────
  // Heat / chemical hair treatment declared AND the protocol carries 3 kits or
  // fewer → add HAIR BREAKAGE REPAIR (HBR) as the closing shaft-repair layer.
  //
  // Why this is needed: HBR's own condition (HAIR_BREAKAGE) is standalone-only
  // — detectConditions strips it the moment any systemic driver is present, and
  // resolveKitInteractions strips it again behind PHENOTYPE INFLAMATION. On a
  // thin protocol that leaves declared cuticle damage completely untreated.
  //
  // Runs BEFORE the PRO IMMUNE consolidation filler so a stack padded here is
  // not padded a second time; the hard ceiling stays 4 kits.
  // Pregnancy is exempt — PREGNANCY_LOCK is an exclusive safety protocol.
  // Phenotype inflammation is exempt — see the interaction contract below.
  //
  // INTERACTION CONTRACT — resolveKitInteractions stays authoritative.
  // The filler must never re-add what the resolver deliberately removed, or
  // the engine would carry two competing sources of truth for the same kit.
  // The guard below is the exact negation of PHENOTYPE_SUPERSEDES_HBR, tested
  // three ways so it holds however the phenotype kit entered the protocol:
  //
  //   (a) resolution.applied contains 'PHENOTYPE_SUPERSEDES_HBR'
  //       — the resolver literally fired and dropped HAIR_BREAKAGE.
  //   (b) resolution.conditions includes 'SCALP_INFLAMMATION'
  //       — the rule's precondition holds, so phenotype is authoritative for
  //         shaft-damage biology even if HAIR_BREAKAGE never entered the set
  //         (detectConditions' isOnlyShaftDamage already suppresses it).
  //   (c) resolvedPhases contains 'PHENOTYPE INFLAMATION'
  //       — the covering kit is in the protocol by ANY route. OXIDATIVE_STRESS
  //         maps to the same kit, so (b) alone would miss that path.
  //
  const hbrKit: KitId = 'HAIR FACT HAIR BREAKAGE REPAIR (HBR)';
  const alreadyHasHbr = resolvedPhases.some((k) => isHbrKit(k));
  const pregnancyLocked = resolution.conditions.includes('PREGNANCY');
  const phenotypeSupersedesHbr =
    resolution.applied.some((r) => r.startsWith('PHENOTYPE_SUPERSEDES_HBR')) ||
    resolution.conditions.includes('SCALP_INFLAMMATION') ||
    resolvedPhases.includes('PHENOTYPE INFLAMATION');
  // ── CEO ruling — clinic launch freeze, 2026-09-04 ────────────────────────
  // The rule is a KIT-COUNT rule with an ANY-signal trigger:
  //
  //   · count gate is `=== 1`, not `<= 3`. HBR is the closing shaft-repair
  //     layer for a protocol that has nothing else in it. At 2-3 kits the
  //     systemic drivers are already being treated and HBR was padding the
  //     stack — on a 2-kit protocol the append also pushed the count to 3 and
  //     re-triggered the PRO IMMUNE consolidation filler, adding a second
  //     unasked-for kit.
  //
  //   · signal gate is ANY ONE of chemical treatment, heat styling or hard
  //     water. Each is an independent shaft-damage declaration and any one of
  //     them qualifies on a single-kit protocol.
  //
  // The expected shape is [pattern kit, HBR, PRO IMMUNE] — the append takes
  // the stack to 2, which the PRO_IMMUNE_CONSOLIDATION_FILLER then closes.
  //
  // KNOWN DIVERGENCE, accepted at CEO level: safety rule SR_005 marks HBR
  // ineligible for heat/chemical WITHOUT hard-water corroboration, and the
  // questionnaire protocol says the same on both treatment options ("HBR
  // injection requires hard-water corroboration - heat/chemical alone
  // insufficient"). This trigger deliberately overrides both. The conflict is
  // pinned by a test in tests/ai-engine/hbrTreatmentFiller.test.ts so it stays
  // visible rather than silently diverging.
  // The clinical indication comes from the shared contract, so SR_005 and the
  // questionnaire cannot drift from what is dispensed. The `=== 1` gate below
  // is the SEQUENCING decision and stays local to this builder.
  const hbrShaftDamageSignal = hasHbrTreatmentDamageIndication(ans);
  if (
    !pregnancyLocked &&
    !phenotypeSupersedesHbr &&
    !alreadyHasHbr &&
    resolvedPhases.length === 1 &&
    hbrShaftDamageSignal
  ) {
    const substitutedHbr = applyClinicSubstitution(hbrKit, clinicConfig);
    resolvedPhases.push(substitutedHbr);
    appliedRules.push(
      'HBR_TREATMENT_FILLER: heat / chemical hair treatment declared and the protocol held ≤ 3 kits — HAIR BREAKAGE REPAIR (HBR) added as the shaft-repair layer.',
    );
    ruleTrace.push({
      rule: 'HBR_TREATMENT_FILLER',
      before: resolvedPhases.slice(0, -1),
      after: [...resolvedPhases],
      reason:
        'Declared heat / chemical treatment with a ≤ 3-kit protocol — HBR added so the shaft damage is treated alongside the systemic drivers.',
      signals: ans.treatment ?? [],
    });
    if (!dedupRationales.has(substitutedHbr)) {
      dedupRationales.set(substitutedHbr, [
        'Heat or chemical treatment declared — repairs the cuticle and rebuilds shaft strength so the fibre stops breaking while the systemic drivers are being corrected.',
      ]);
    }
  }

  // ── PRO IMMUNE consolidation filler (locked clinical rule 2026-07-13) ──────
  // When the final protocol contains only 2 kits and PRO IMMUNE is not already
  // present, inject it as a consolidation layer. This preserves the design
  // intent of PRO IMMUNE as the "immune-restoration finisher" for thin stacks
  // without forcing it onto every larger protocol.
  const proImmuneVariant: KitId = isVeg ? 'PRO IMMUNE VEG' : 'PRO IMMUNE GOLD';
  const hasProImmune = resolvedPhases.some((k) => k.includes('PRO IMMUNE'));
  // The thin-stack carve-outs above are themselves the padding for the stacks
  // they fire on — they must not pad the same protocol twice.
  if (
    resolvedPhases.length === 2 &&
    !hasProImmune &&
    !giGoldCarveOutApplies &&
    !metaBCarveOutApplies
  ) {
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
  // `safety` is assigned by the block above under this same `options.trace`
  // flag, so it is always present here. Testing it states that dependency
  // instead of asserting it away.
  if (options?.trace && safety) {
    const safetyResult = safety;
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
      ...safetyResult.blockedKits,
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

      {
        for (const f of safetyResult.findings) {
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
      safetyEvaluation: safetyResult,
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

// The chemical / heat / hard-water signal helpers that used to live here now
// live in ai-engine/contracts/hbrIndication, so the sequence builder, safety
// rule SR_005 and the questionnaire protocol all read one definition.

function isHbrKit(kitId: KitId): boolean {
  return /BREAKAGE REPAIR|\bHBR\b/i.test(kitId);
}

// Same clinic-availability swap the main sequence applies, reused for kits that
// are injected after the sequence has already been mapped.
function applyClinicSubstitution(kit: KitId, clinicConfig: ClinicConfig): KitId {
  if (
    clinicConfig.availableKits.length > 0 &&
    !clinicConfig.availableKits.includes(kit)
  ) {
    return clinicConfig.substitutions?.[kit] ?? kit;
  }
  return kit;
}

type ClinicalFlagsLite = { isMale: boolean; isGrade45: boolean };
