-- Branch attribution on assessments (two-branch clinic launch).
--
-- Lets a completed Assessment record WHICH physical branch of its clinic the
-- patient was assessed at, and gives each ClinicLocation a URL-safe handle so
-- the patient-facing QR/link can name a branch on the shared clinic route
-- (/q/[clinicSlug]?branch=<slug>).
--
-- Kept as an independent, additive migration unit. It adds two nullable
-- columns, one unique index and one foreign key; it changes no existing row
-- and is revertible on its own.
--
-- ── Backfill: deliberately none ──────────────────────────────────────────────
-- Assessment.clinicLocationId is NULL for every assessment submitted before
-- branch attribution existed, and for every submission from a generic clinic
-- URL where the patient named no branch. There is no branch recorded anywhere
-- on those rows to promote, and inventing one — defaulting to a clinic's
-- primary branch, say — would assert a physical location a patient may never
-- have visited. Readers treat NULL as "branch not captured", which is true.
--
-- ClinicLocation.slug is NULL until an operator assigns a QR handle. A branch
-- with no handle is simply unreachable by ?branch= until one is set, which is
-- correct rather than a defect.
--
-- ── Isolation ────────────────────────────────────────────────────────────────
-- clinicLocationId is scope, never a tenant boundary. Clinic.id remains the
-- single boundary every isolation query relies on; a branch is only ever
-- resolved after the clinic is resolved, and the slug is unique per clinic, so
-- it can never cross a clinic. See lib/clinics/resolveClinicBranch.

-- A branch handle, unique within its clinic. Nullable, so existing branches
-- keep working with no handle; Postgres treats NULLs as distinct, so any
-- number of handle-less branches coexist under one clinic.
ALTER TABLE "ClinicLocation" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "ClinicLocation_clinicId_slug_key"
    ON "ClinicLocation" ("clinicId", "slug");

-- The validated branch an assessment was taken at. Nullable, no backfill.
ALTER TABLE "Assessment" ADD COLUMN "clinicLocationId" TEXT;

-- Deleting or soft-deleting a branch must never delete a patient's assessment.
-- The attribution simply drops to NULL — the clinical record outlives the
-- premises. ON UPDATE CASCADE mirrors Prisma's default for an optional relation.
ALTER TABLE "Assessment"
    ADD CONSTRAINT "Assessment_clinicLocationId_fkey"
    FOREIGN KEY ("clinicLocationId") REFERENCES "ClinicLocation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- The doctor registry's branch filter reads the latest assessment's branch
-- for this clinic: equality on clinicId, then branch.
CREATE INDEX "Assessment_clinicId_clinicLocationId_idx"
    ON "Assessment" ("clinicId", "clinicLocationId");
