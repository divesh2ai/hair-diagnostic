// Visit intent — why the patient is here today.
//
// Separate from identity on purpose. `lib/patient/identity` answers "do we
// already have a record for this number?"; this module answers "what is this
// visit for?". The two are routinely conflated, and the result is a queue where
// every returning patient reads as FOLLOW_UP — so a person who came in to
// collect the rest of an approved kit is indistinguishable from one whose
// condition changed.
//
// ── Never inferred ───────────────────────────────────────────────────────────
// Visit intent is stated by the patient at intake. It is not derived from
// KitOrderIntent status, order history, elapsed time since the last visit, or
// anything in the answers. A READY_FOR_FULFILMENT intent means a plan was
// approved; it says nothing about whether the patient has already collected it,
// so it cannot stand in for the patient telling us why they walked in.
//
// ── Not clinical input ───────────────────────────────────────────────────────
// No scoring, visibility, skip, diagnosis, kit-mapping or narrative rule may
// read these values. They are operational routing for reception and the doctor
// queue.

import type { PatientRelationship } from "./identity";

/** Canonical visit intents. Mirrors the `VisitType` Prisma enum exactly. */
export const VISIT_TYPES = [
  "INITIAL",
  "FOLLOW_UP",
  "KIT_FULFILMENT",
  "REASSESSMENT",
  "NEW_CONCERN",
  "CONDITION_CHANGED",
] as const;

export type VisitType = (typeof VISIT_TYPES)[number];

/**
 * Intents a returning patient may choose, in the order they are offered.
 *
 * INITIAL is absent by construction: a patient the clinic already has a record
 * for is not having a first visit, and offering it would let the queue's
 * cleanest signal be set to something false with one tap.
 */
export const RETURNING_VISIT_TYPES = [
  "FOLLOW_UP",
  "KIT_FULFILMENT",
  "CONDITION_CHANGED",
  "NEW_CONCERN",
  "REASSESSMENT",
] as const satisfies readonly VisitType[];

export type ReturningVisitType = (typeof RETURNING_VISIT_TYPES)[number];

export function isVisitType(value: unknown): value is VisitType {
  return typeof value === "string" && (VISIT_TYPES as readonly string[]).includes(value);
}

export function isReturningVisitType(value: unknown): value is ReturningVisitType {
  return (
    typeof value === "string" &&
    (RETURNING_VISIT_TYPES as readonly string[]).includes(value)
  );
}

/**
 * The intent a NEW patient's visit carries. There is no question to ask: a
 * clinic that has never seen this number is, by definition, seeing them for the
 * first time.
 */
export const DEFAULT_NEW_PATIENT_VISIT: VisitType = "INITIAL";

/**
 * Resolve what to persist as `Assessment.visitType`.
 *
 * Returns null rather than guessing when a returning patient's submission
 * carries no intent — an older client, or a session that skipped the gate. Null
 * means "not captured", which is a fact; INITIAL would be a claim.
 *
 * A NEW patient is the one case where the answer is derivable, so it is
 * derived rather than asked.
 */
export function resolveVisitType(
  relationship: PatientRelationship | "AMBIGUOUS" | null,
  submitted: unknown,
): VisitType | null {
  if (relationship === "NEW") {
    // A client that reports NEW cannot also nominate FOLLOW_UP. Trusting the
    // submitted value here would let a mismatched pair through and put a
    // first-time patient in the follow-up queue.
    return DEFAULT_NEW_PATIENT_VISIT;
  }
  if (isReturningVisitType(submitted)) return submitted;
  // INITIAL arriving alongside a returning/ambiguous relationship is a client
  // bug, not an intent. Drop it rather than persist the contradiction.
  return null;
}

/**
 * Per-assessment relationship, including ambiguity.
 *
 * `PatientRelationship` (NEW | RETURNING) is what a public caller is told;
 * this is what is written to the row, and it keeps AMBIGUOUS distinct. A
 * quarantined visit must never be filed as a confirmed returning patient.
 */
export type PatientRelationshipState = "NEW" | "RETURNING" | "AMBIGUOUS";

export function toRelationshipState(
  identityState: "NEW" | "RETURNING_CANDIDATE" | "IDENTITY_AMBIGUOUS",
): PatientRelationshipState {
  switch (identityState) {
    case "NEW":
      return "NEW";
    case "RETURNING_CANDIDATE":
      return "RETURNING";
    case "IDENTITY_AMBIGUOUS":
      return "AMBIGUOUS";
  }
}
