import type { KitId } from '../../../types';
import type { ClinicalFlags } from '../../clinical-engine/types';
import type { ConditionId } from '../registry/conditionKitRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// HORMONAL-AXIS OVERLAP ASSESSMENT  (clinical policy 2026-10)
//
// ⚠️ CLINICAL CHANGE — REQUIRES CLINICAL SIGN-OFF BEFORE DEPLOY.
//
// Supersedes the age-only MENO_PCOS_MUTEX, which discarded PCOS *or* a
// menopause-continuum condition purely on the patient's age (e.g. a 39-year-old
// reporting both PCOS and peri-menopause had peri-menopause silently dropped,
// producing a PCOS-only kit, diagnosis and PDF that contradicted the
// recognised conditions — the Rohini case, staging assessment
// cmv6h7jlg000kfqcu2wuorm24).
//
// The approved policy:
//   • Never discard PCOS or a menopause-continuum state on age alone.
//   • Recognise every reported condition; evaluate each protocol independently.
//   • The two hormonal-axis kits may be co-prescribed only when medically
//     appropriate — NEVER auto-dispensed together without first checking
//     ingredient / dose overlap and contraindications.
//   • Any uncertain or overlapping pair is routed to the treating doctor for
//     approval; the engine proposes a default primary but does not decide.
//
// This module is a PURE, traceable eligibility assessment. It does not mutate
// the condition set or the kit sequence — it reports a verdict and a default
// suggestion that resolveKitInteractions / buildKitSequence act on, and that
// the doctor-review and PDF layers surface verbatim.
// ─────────────────────────────────────────────────────────────────────────────

export type OverlapVerdict =
  // The two kits share a therapeutic axis / ingredients heavily enough that
  // co-dispensing is a clinical decision, not an automatic one. Hold the
  // non-primary kit for doctor approval.
  | 'REQUIRES_DOCTOR_REVIEW'
  // No material overlap — both may be auto-dispensed. (Reserved for future
  // non-overlapping pairs; the current hormonal-axis pairs never auto-codispense.)
  | 'CO_ELIGIBLE';

export interface HormonalAxisOverlap {
  /** The two recognised, co-present conditions (both retained — neither dropped). */
  readonly conditions: readonly [ConditionId, ConditionId];
  /** Their canonical kits, in the same order as `conditions`. */
  readonly kits: readonly [KitId, KitId];
  readonly verdict: OverlapVerdict;
  /**
   * The engine's NON-BINDING default: which condition's kit is auto-dispensed
   * when the verdict holds the other for review. A clinical convenience so the
   * queue is not empty-handed — the doctor may override to the other kit, both,
   * or neither. Derived from stage/age heuristics, never used to DISCARD.
   */
  readonly primaryCondition: ConditionId;
  /** The condition whose kit is held pending doctor approval (null when CO_ELIGIBLE). */
  readonly heldCondition: ConditionId | null;
  /** Ingredients / therapeutic axes the two kits share. */
  readonly sharedAxes: readonly string[];
  readonly reasons: readonly string[];
  /** One-line audit string pushed into appliedRules + the decision trace. */
  readonly auditLine: string;
}

// Canonical kit per hormonal-axis condition (mirrors CONDITION_KIT_REGISTRY;
// kept local so this pure module has no circular import on the registry object).
const KIT_FOR: Partial<Record<ConditionId, KitId>> = {
  PCOS: 'PRO FACT META B PCOS',
  PERI_MENOPAUSE: 'HAIR FACT PERI MENOPAUSE',
  POST_MENOPAUSE: 'PRO FACT META B POSTMENOPAUSE',
};

// Therapeutic axes each kit acts on — the substrate of the overlap check.
// PRO FACT META B* variants share the AMPK / insulin-sensitisation metabolic
// core (Berberine / NMN / Inositol family); HAIR FACT PERI MENOPAUSE is an
// estrogen/androgen-balance kit that still acts on the androgen axis PCOS
// targets. Any shared axis makes co-administration a doctor decision.
const KIT_AXES: Record<string, readonly string[]> = {
  'PRO FACT META B PCOS': ['AMPK/insulin-metabolic', 'androgen'],
  'PRO FACT META B POSTMENOPAUSE': ['AMPK/insulin-metabolic', 'estrogen/menopausal'],
  'HAIR FACT PERI MENOPAUSE': ['estrogen/menopausal', 'androgen'],
};

/**
 * Assess the overlap between PCOS and a menopause-continuum condition.
 *
 * `age` informs ONLY the non-binding default primary suggestion, never a
 * discard. The verdict for every hormonal-axis pair is REQUIRES_DOCTOR_REVIEW:
 * both kits act on a shared androgen / metabolic / estrogen axis, so automatic
 * co-dispensing is never clinically safe without a human check.
 */
export function assessHormonalAxisOverlap(
  pcos: ConditionId,
  meno: ConditionId,
  flags: ClinicalFlags,
): HormonalAxisOverlap {
  const pcosKit = KIT_FOR[pcos] ?? ('PRO FACT META B PCOS' as KitId);
  const menoKit = KIT_FOR[meno] ?? ('HAIR FACT PERI MENOPAUSE' as KitId);

  const sharedAxes = (KIT_AXES[pcosKit] ?? []).filter((a) =>
    (KIT_AXES[menoKit] ?? []).includes(a),
  );

  const age = flags.age ?? 0;
  // Default primary (NON-BINDING): the clinically foregrounded condition for
  // this age band — the same stage intuition the old mutex used, but now only
  // to choose which kit the doctor sees pre-selected, not to erase the other.
  //   ≥ 50 + post-menopause → post-menopause kit foregrounded
  //   40–49                 → menopause-continuum foregrounded
  //   < 40                  → PCOS foregrounded
  // In every band BOTH conditions remain recognised and reviewable.
  let primaryCondition: ConditionId;
  if (meno === 'POST_MENOPAUSE' && age >= 50) primaryCondition = meno;
  else if (age >= 40) primaryCondition = meno;
  else primaryCondition = pcos;

  const heldCondition = primaryCondition === pcos ? meno : pcos;

  const reasons = [
    `Both ${pcos} and ${meno} were reported and are retained — neither is discarded on age (patient age ${age}).`,
    sharedAxes.length > 0
      ? `${pcosKit} and ${menoKit} share the ${sharedAxes.join(' + ')} axis — overlapping ingredients/dose make co-administration a clinical decision.`
      : `${pcosKit} and ${menoKit} are distinct axes, but two concurrent hormonal protocols still require review.`,
    `Default auto-dispense: ${primaryCondition} kit. ${heldCondition} kit held for doctor approval; the doctor may approve both, swap, or choose one.`,
  ];

  return {
    conditions: [pcos, meno],
    kits: [pcosKit, menoKit],
    verdict: 'REQUIRES_DOCTOR_REVIEW',
    primaryCondition,
    heldCondition,
    sharedAxes,
    reasons,
    auditLine: `HORMONAL_AXIS_OVERLAP: ${pcos}+${meno} both recognised (age ${age}, no age-discard). Shared axis [${sharedAxes.join(', ') || 'none'}]. Co-prescription REQUIRES_DOCTOR_REVIEW — auto-dispense ${primaryCondition} kit, hold ${heldCondition} kit for approval.`,
  };
}
