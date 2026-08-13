-- Visit intent + resolved relationship (D2).
--
-- The intake gate asks a returning patient why they are here today, and that
-- answer has to survive onto the Assessment or it is worth nothing: the whole
-- point is that reception and the doctor can tell a kit collection from a
-- genuine reassessment without reading the clinical content.
--
-- Kept as its own migration unit, separate from 20260812_patient_mobile_identity
-- (which owns Patient) and 20260812_clinic_locations (which owns premises).
-- Different tables, different review, independently revertible.
--
-- ── Why both columns exist ──────────────────────────────────────────────────
-- `patientRelationship` answers "did this clinic already have a record for this
-- person when the visit started?". `visitType` answers "why did they come?".
-- They are not the same question, and deriving one from the other is exactly
-- the mistake this migration is here to prevent — a returning patient is not
-- automatically a FOLLOW_UP, and a NEW_CONCERN visit is not automatically a
-- first visit.
--
-- ── Backfill: deliberately none ─────────────────────────────────────────────
-- Every assessment submitted before the intake gate shipped was captured
-- without either fact. Defaulting them to INITIAL/NEW would write a claim about
-- hundreds of past visits that nobody made and nobody can check. Both columns
-- are nullable and stay null for historical rows; readers treat null as "not
-- captured", which is the truth. New submissions always write both.

CREATE TYPE "VisitType" AS ENUM (
    'INITIAL',
    'FOLLOW_UP',
    'KIT_FULFILMENT',
    'REASSESSMENT',
    'NEW_CONCERN',
    'CONDITION_CHANGED'
);

-- AMBIGUOUS is a first-class member, not a variant of RETURNING. A quarantined
-- visit (two or more records carry the number, none was selected) must never be
-- counted as a confirmed returning patient — see
-- migrations/20260812_patient_mobile_identity and lib/patient/identity.
CREATE TYPE "PatientRelationshipState" AS ENUM ('NEW', 'RETURNING', 'AMBIGUOUS');

ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "visitType" "VisitType";
ALTER TABLE "Assessment"
    ADD COLUMN IF NOT EXISTS "patientRelationship" "PatientRelationshipState";

-- "Today's kit-fulfilment visits at this clinic", and the returning-patient
-- split, without scanning the clinic's whole assessment history.
CREATE INDEX IF NOT EXISTS "Assessment_clinicId_visitType_idx"
    ON "Assessment" ("clinicId", "visitType");
