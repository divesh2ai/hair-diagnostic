import type { KitId } from '../../../types';
import type { ConditionId } from '../registry/conditionKitRegistry';
import type { HormonalAxisOverlap } from './assessHormonalAxisOverlap';

// ─────────────────────────────────────────────────────────────────────────────
// HOLD OVERLAPPING HORMONAL KITS FOR DOCTOR DECISION  (clinical policy 2026-10)
//
// ⚠️ CLINICAL CHANGE — REQUIRES CLINICAL SIGN-OFF BEFORE DEPLOY.
//
// When PCOS and a menopause-continuum condition co-occur, the engine must NOT
// auto-choose one hormonal kit over the other on age. Both conditions stay
// recognised, and the KIT DECISION for the overlapping pair is held for the
// treating doctor: BOTH hormonal-axis kits are withheld from auto-dispense.
// The overlap still carries an ADVISORY suggested starting point
// (overlap.primaryCondition), but nothing hormonal is dispensed without a
// human decision — and a dual-kit combination is never auto-released.
//
// Every OTHER safely-supported kit (FPHL/MPHL pattern, scalp, iron, TE, etc.)
// is preserved. A hormonal kit is only held when no independent, non-overlap
// condition also requires that same kit — so a kit that is clinically needed
// on its own is never withheld.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConditionKit {
  readonly condition: ConditionId;
  readonly kit: KitId;
}

export interface HoldDecision<T extends ConditionKit> {
  /** Kits withheld from auto-dispense, awaiting the doctor's hormonal decision. */
  readonly heldKits: KitId[];
  /** Entries that proceed to the auto sequence (full original shape preserved). */
  readonly retained: T[];
  /** Human-readable audit lines for appliedRules / the decision trace. */
  readonly audit: string[];
}

// Generic over the caller's entry shape so extra fields (e.g. `rationale`) that
// buildKitSequence carries on each condition→kit pair survive the filter.
export function holdOverlappingKits<T extends ConditionKit>(
  conditionKits: readonly T[],
  overlaps: readonly HormonalAxisOverlap[],
): HoldDecision<T> {
  const reviewOverlaps = overlaps.filter((o) => o.verdict === 'REQUIRES_DOCTOR_REVIEW');
  if (reviewOverlaps.length === 0) {
    return { heldKits: [], retained: [...conditionKits], audit: [] };
  }

  // Every condition that participates in a doctor-review overlap.
  const overlapConditions = new Set<ConditionId>();
  for (const o of reviewOverlaps) for (const c of o.conditions) overlapConditions.add(c);

  // Kits also required by a condition that is NOT in any overlap — these are
  // clinically needed on their own and must never be withheld.
  const independentlyRequiredKits = new Set<KitId>(
    conditionKits.filter((ck) => !overlapConditions.has(ck.condition)).map((ck) => ck.kit),
  );

  const heldKits: KitId[] = [];
  const audit: string[] = [];
  const retained = conditionKits.filter((ck) => {
    const inOverlap = overlapConditions.has(ck.condition);
    if (inOverlap && !independentlyRequiredKits.has(ck.kit)) {
      if (!heldKits.includes(ck.kit)) {
        heldKits.push(ck.kit);
        audit.push(
          `HORMONAL_AXIS_HOLD: ${ck.kit} (${ck.condition}) withheld from auto-dispense — overlapping PCOS/menopause hormonal protocol. Kit choice (one, both, or alternative) is the treating doctor's decision; not auto-released.`,
        );
      }
      return false;
    }
    return true;
  });

  return { heldKits, retained, audit };
}
