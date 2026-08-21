-- Scheduled future visits.
--
-- NOT APPLIED YET. Written under the 2026-08-20 baseline freeze so the feature
-- is complete and reviewable while the canonical Supabase environment is still
-- being chosen. Until someone runs it, every appointment read returns empty and
-- every booking is refused with a clear "not provisioned" state — see
-- lib/doctor/appointments.ts, which talks to this table over raw SQL precisely
-- so the application compiles and runs whether or not the table exists.
--
-- ── Why a new table rather than ClinicVisit ─────────────────────────────────
-- ClinicVisit records someone physically part-way through an intake right now,
-- and refuses scheduling on purpose. A booking is a promise about a time that
-- has not happened; writing one into ClinicVisit would put a person who is not
-- in the building onto the waiting-room list.
--
-- ── No link to Assessment ──────────────────────────────────────────────────
-- Nothing here points at the assessment the patient eventually submits.
-- Matching a booking to a submission by timestamp proximity is a guess, and a
-- wrong guess silently rewrites clinical history. The calendar shows intent
-- (appointments) and outcome (assessments) as two separate reads of a day.

CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "Appointment" (
    "id"                TEXT NOT NULL,
    "clinicId"          TEXT NOT NULL,
    "patientId"         TEXT NOT NULL,
    -- Required. An appointment is with a clinician, not with a building: a row
    -- without one cannot be placed on anybody's day.
    "doctorId"          TEXT NOT NULL,
    -- UTC instant. Rendered in "Clinic"."timezone" by the reader; the fact
    -- being recorded is a point in time, not a slot in someone's grid.
    "scheduledAt"       TIMESTAMP(3) NOT NULL,
    "durationMinutes"   INTEGER NOT NULL DEFAULT 20,
    -- Scheduling context shown on the calendar row, e.g. "3-month follow-up".
    -- Never clinical content; no engine reads it.
    "reason"            TEXT,
    "notes"             TEXT,
    "status"            "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    -- Nullable: a future reception or patient-facing booking path has no
    -- acting doctor, and backfilling one would be a false attribution.
    "createdByDoctorId" TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    "cancelledAt"       TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- The calendar's only query: one clinic's month. Equality on clinicId, range
-- on scheduledAt — both usable from one btree.
CREATE INDEX "Appointment_clinicId_scheduledAt_idx"
    ON "Appointment" ("clinicId", "scheduledAt");

-- "This doctor's day".
CREATE INDEX "Appointment_doctorId_scheduledAt_idx"
    ON "Appointment" ("doctorId", "scheduledAt");

-- "This patient's next visit".
CREATE INDEX "Appointment_patientId_scheduledAt_idx"
    ON "Appointment" ("patientId", "scheduledAt");

ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
