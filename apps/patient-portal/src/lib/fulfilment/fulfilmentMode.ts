export type FulfilmentMode = "PATIENT" | "CLINIC";

/**
 * Where an order's kits go when the order does not say.
 *
 * ── Why there is a default at all ───────────────────────────────────────────
 * `KitOrderIntent.fulfilmentMode` is nullable and is NOT backfilled: every
 * intent created before the column existed genuinely has no recorded
 * destination, and stamping CLINIC across them would invent a fact about
 * orders nobody made that decision for. So the column is honest, and the
 * resolution of NULL happens here, at read time, in one place.
 *
 * ── Why the default is CLINIC ───────────────────────────────────────────────
 * This is a Wave-0 operating fact, not an assumption about the product. The
 * launch clinics stock kits and hand them to the patient at the counter; there
 * is no direct-to-patient dispatch lane, no courier integration and no patient
 * address captured anywhere in the schema. Defaulting to PATIENT would create
 * fulfilment requests nobody can act on.
 *
 * The moment a deployment does support patient dispatch, this is the one
 * function to change — and the enum, the column and the state machine already
 * carry PATIENT, so nothing else has to.
 *
 * ── What the default must never become ──────────────────────────────────────
 * A silent one. `resolveFulfilmentMode` reports whether the answer was
 * recorded or defaulted, so the doctor's journey view and the ops queue can
 * say "clinic supply (default)" rather than claiming a decision was made.
 */
export const WAVE_0_DEFAULT_MODE: FulfilmentMode = "CLINIC";

export interface ResolvedFulfilmentMode {
  mode: FulfilmentMode;
  /** True when the order carries an explicit choice. */
  explicit: boolean;
}

export function resolveFulfilmentMode(
  stored: string | null | undefined,
): ResolvedFulfilmentMode {
  if (stored === "PATIENT" || stored === "CLINIC") {
    return { mode: stored, explicit: true };
  }
  return { mode: WAVE_0_DEFAULT_MODE, explicit: false };
}

/**
 * Does a paid order in this mode produce a clinic fulfilment request?
 *
 * Stated as its own predicate rather than inlined as `mode === "CLINIC"` at
 * the two call sites that need it, because it is the rule the acceptance
 * criteria are written against: "a patient-delivery order creates no clinic
 * fulfilment request". One function, one test, both callers.
 */
export function requiresClinicFulfilment(mode: FulfilmentMode): boolean {
  return mode === "CLINIC";
}
