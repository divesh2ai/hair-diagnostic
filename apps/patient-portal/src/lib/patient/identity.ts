// Patient identity resolution.
//
// Before this module existed, every assessment submission called
// `patient.create` — so a patient who walked back into the same clinic three
// months later became a brand-new record with no history. Everything the
// doctor dashboard wants to show about a returning patient (previous problem,
// previous approved plan, what was dispensed) depends on the visit landing on
// the *same* Patient row.
//
// The match key is deliberately narrow:
//
//     clinic (tenant)  +  normalised mobile
//
// Name is never used for matching. Two "Priya Sharma"s in Mumbai are two
// people; fuzzy name matching would silently merge their clinical histories,
// which is a patient-safety failure, not a UX inconvenience.
//
// ── Determinism ──────────────────────────────────────────────────────────────
// Match count alone decides the state. There is no "most recent row wins"
// tie-break: picking one of several candidates is an unrecorded clinical
// decision made by a sort order, and it can attach this visit to the wrong
// person's history. Ambiguity is surfaced, never resolved.
//
//     0 matches   -> NEW
//     1 match     -> RETURNING_CANDIDATE
//     2+ matches  -> IDENTITY_AMBIGUOUS
//
// ── Verification ─────────────────────────────────────────────────────────────
// A phone match establishes *identity*, not *entitlement*. It tells the clinic
// this is probably a returning record; it does not authorise showing prior
// medical history to whoever is holding the phone. Every state is provisional
// until verified — see `requiresVerification`.

// Deliberately imports no client. Every function here takes its `db` handle as
// an argument, which keeps identity resolution inside the caller's transaction
// and keeps this module — the one that decides who a visit belongs to —
// unit-testable without a database or an environment.
import { Prisma } from "@prisma/client";
import { toE164 } from "./phone";

/**
 * Deterministic identity state for a (clinic, mobile) pair.
 *
 * RETURNING_CANDIDATE is a candidate, not a conclusion: exactly one record
 * carries this number, but the person holding the phone has not been verified
 * as that record's owner.
 */
export type IdentityState = "NEW" | "RETURNING_CANDIDATE" | "IDENTITY_AMBIGUOUS";

/**
 * Coarse routing signal for patient-facing surfaces. Both RETURNING_CANDIDATE
 * and IDENTITY_AMBIGUOUS collapse to RETURNING here — a public caller must not
 * learn that a number appears on more than one record, which is itself
 * information about clinic attendance.
 */
export type PatientRelationship = "NEW" | "RETURNING";

export function toRelationship(state: IdentityState): PatientRelationship {
  return state === "NEW" ? "NEW" : "RETURNING";
}

/** Result of a read-only identity lookup. Carries no clinical content. */
export type IdentityLookup =
  | { state: "NEW"; phoneNormalized: string; requiresVerification: true }
  | {
      state: "RETURNING_CANDIDATE";
      phoneNormalized: string;
      patientId: string;
      requiresVerification: true;
    }
  | {
      state: "IDENTITY_AMBIGUOUS";
      phoneNormalized: string;
      /** How many records carry this number. Never exposed publicly. */
      candidateCount: number;
      candidateIds: string[];
      requiresVerification: true;
    };

/** Fields captured at intake that may refresh an existing record. */
export interface IntakeDetails {
  name: string;
  age: number | null;
  gender: string | null;
  email: string | null;
}

// PrismaClient is structurally assignable to TransactionClient, so the same
// helpers work inside and outside a transaction.
type Db = Prisma.TransactionClient;

// More than this many rows sharing one number is a data-quality incident, not
// a lookup. We stop counting — the state is already IDENTITY_AMBIGUOUS.
const CANDIDATE_SCAN_LIMIT = 10;

/**
 * Resolve (clinic, mobile) to an identity state. Read-only; writes nothing.
 *
 * Returns null only when the number cannot be normalised — an unusable input,
 * not an identity answer.
 */
export async function lookupIdentity(
  db: Db,
  clinicId: string,
  rawPhone: unknown,
): Promise<IdentityLookup | null> {
  const phoneNormalized = toE164(rawPhone);
  if (!phoneNormalized) return null;

  const candidates = await db.patient.findMany({
    where: { clinicId, phoneNormalized, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: CANDIDATE_SCAN_LIMIT,
    select: { id: true },
  });

  if (candidates.length === 0) {
    return { state: "NEW", phoneNormalized, requiresVerification: true };
  }

  if (candidates.length === 1) {
    return {
      state: "RETURNING_CANDIDATE",
      phoneNormalized,
      patientId: candidates[0].id,
      requiresVerification: true,
    };
  }

  return {
    state: "IDENTITY_AMBIGUOUS",
    phoneNormalized,
    candidateCount: candidates.length,
    candidateIds: candidates.map((c) => c.id),
    requiresVerification: true,
  };
}

/**
 * Continuity detail for a single, unambiguous candidate. Separate call because
 * it must never run for IDENTITY_AMBIGUOUS, and never for an unverified
 * patient-facing surface.
 */
export async function getVisitSummary(
  db: Db,
  clinicId: string,
  patientId: string,
): Promise<{ priorAssessmentCount: number; lastVisitAt: Date | null }> {
  const [priorAssessmentCount, lastAssessment] = await Promise.all([
    db.assessment.count({ where: { patientId, clinicId, deletedAt: null } }),
    db.assessment.findFirst({
      where: { patientId, clinicId, deletedAt: null },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    }),
  ]);
  return {
    priorAssessmentCount,
    lastVisitAt: lastAssessment?.submittedAt ?? null,
  };
}

export interface ResolvedPatient {
  patientId: string;
  identityState: IdentityState;
  /** How the row was obtained. Recorded for audit and for reception. */
  matchedOn: "mobile" | "linked_assessment" | "created" | "quarantined";
  phoneNormalized: string | null;
  /**
   * True when this visit could not be attached to a definite record and a
   * human must reconcile it. Consumers should surface it, not swallow it.
   */
  requiresReconciliation: boolean;
}

/**
 * Get the Patient row this submission belongs to.
 *
 * Must be called inside the same transaction as the Assessment write so a
 * double-submit cannot interleave into two patient records.
 *
 * On IDENTITY_AMBIGUOUS the visit is *quarantined*: a record is created so the
 * patient never loses a completed assessment, but it is created loudly —
 *
 *   * `identityResolutionStatus = AMBIGUOUS` marks the row as needing a human,
 *     and is indexed per clinic so it can be listed;
 *   * the ambiguity and every candidate id go to the audit log;
 *   * the new row deliberately stores no `phoneNormalized`, so it cannot itself
 *     become a further match and deepen the ambiguity.
 *
 * Existing duplicates are never touched, merged, or reordered.
 */
export async function resolvePatientForIntake(
  tx: Prisma.TransactionClient,
  args: {
    clinicId: string;
    doctorId: string | null;
    rawPhone: unknown;
    details: IntakeDetails;
    /**
     * Pre-resolved patient id from an earlier step of the same visit (the skin
     * intake hand-off). Takes precedence: it is a stronger signal than a phone
     * number because it came from this session.
     */
    linkedPatientId?: string | null;
  },
): Promise<ResolvedPatient> {
  const { clinicId, doctorId, rawPhone, details, linkedPatientId } = args;
  const phoneNormalized = toE164(rawPhone);
  // A number we can't parse is still worth keeping verbatim — it may be a
  // landline or a mistyped digit a receptionist can correct later. It just
  // can't participate in identity matching.
  const rawPhoneText =
    typeof rawPhone === "string" && rawPhone.trim() !== "" ? rawPhone.trim() : null;

  if (linkedPatientId) {
    // Backfill the number onto the linked record so the *next* visit can match
    // on mobile. Never overwrite a number already stored.
    if (phoneNormalized) {
      await tx.patient.updateMany({
        where: { id: linkedPatientId, phoneNormalized: null },
        data: { phoneNormalized, phone: phoneNormalized },
      });
    }
    return {
      patientId: linkedPatientId,
      identityState: "RETURNING_CANDIDATE",
      matchedOn: "linked_assessment",
      phoneNormalized,
      requiresReconciliation: false,
    };
  }

  const lookup = phoneNormalized
    ? await lookupIdentity(tx, clinicId, phoneNormalized)
    : null;

  if (lookup?.state === "RETURNING_CANDIDATE") {
    const existing = await tx.patient.findUnique({
      where: { id: lookup.patientId },
      select: { id: true, name: true, age: true, gender: true, email: true },
    });

    if (existing) {
      // Refresh what legitimately changes between visits (age, and details the
      // record was missing). The stored name is only replaced when it is a
      // placeholder — a clinic that corrected a spelling should not have it
      // reverted by a patient typing quickly on a tablet.
      const refresh: Prisma.PatientUpdateInput = {};
      if (details.age !== null && details.age !== existing.age) refresh.age = details.age;
      if (details.gender && !existing.gender) refresh.gender = details.gender;
      if (details.email && !existing.email) refresh.email = details.email;
      if (details.name && details.name !== "Anonymous" && existing.name === "Anonymous") {
        refresh.name = details.name;
      }
      if (Object.keys(refresh).length > 0) {
        await tx.patient.update({ where: { id: existing.id }, data: refresh });
      }

      return {
        patientId: existing.id,
        identityState: "RETURNING_CANDIDATE",
        matchedOn: "mobile",
        phoneNormalized,
        requiresReconciliation: false,
      };
    }
  }

  const ambiguous = lookup?.state === "IDENTITY_AMBIGUOUS";

  const created = await tx.patient.create({
    data: {
      clinicId,
      doctorId,
      name: details.name,
      // Canonical form wins for the legacy `phone` column so it stops
      // accumulating unparseable variants; an unparseable entry is preserved
      // as typed rather than dropped.
      phone: phoneNormalized ?? rawPhoneText,
      // Quarantined records carry no match key. Storing one here would make
      // this row a third candidate and push the next visit further from a
      // clean resolution. Reception sets it during reconciliation.
      phoneNormalized: ambiguous ? null : phoneNormalized,
      email: details.email,
      age: details.age,
      gender: details.gender,
      // The queryable half of the quarantine. AuditLog records *what happened*;
      // this column is what makes "show every unresolved identity in clinic X"
      // an indexed query instead of a log scrape, and it is what a future
      // reception screen filters on.
      identityResolutionStatus: ambiguous ? "AMBIGUOUS" : "RESOLVED",
      identityFlaggedAt: ambiguous ? new Date() : null,
    },
    select: { id: true },
  });

  if (ambiguous && lookup?.state === "IDENTITY_AMBIGUOUS") {
    // Created loudly. This row is how reception finds the visit to reconcile.
    await tx.auditLog.create({
      data: {
        actorType: "patient",
        entityType: "Patient",
        entityId: created.id,
        action: "patient.identity_ambiguous",
        metadata: {
          clinicId,
          phoneNormalized: lookup.phoneNormalized,
          candidateCount: lookup.candidateCount,
          candidateIds: lookup.candidateIds,
          resolution: "quarantined_pending_reconciliation",
        },
      },
    });
  }

  return {
    patientId: created.id,
    identityState: ambiguous ? "IDENTITY_AMBIGUOUS" : "NEW",
    matchedOn: ambiguous ? "quarantined" : "created",
    phoneNormalized: ambiguous ? null : phoneNormalized,
    requiresReconciliation: ambiguous,
  };
}
