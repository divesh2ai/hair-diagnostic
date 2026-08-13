-- In-clinic visit state.
--
-- The Doctor Dashboard needs to answer a question the schema could not: "who
-- is in the clinic right now, part-way through the assessment?" Every existing
-- table refuses that question for a good reason.
--
--   * Assessment means SUBMITTED. Creating a row at question one would make
--     every pending count, queue, orchestration trigger and clinical engine
--     wrong at once.
--   * Patient means a person this clinic has a record for. Identity is
--     resolved and written at submission; creating a person because someone
--     scanned a QR code fills the register with people who walked out.
--
-- So the operational state gets its own table, and is kept small enough that
-- nothing clinical can grow on it.
--
-- ── No phone column ─────────────────────────────────────────────────────────
-- The dashboard shows a name so the doctor knows who is waiting. It has no
-- server-side need for the number, and a table that starts holding
-- identifiers "in case" becomes a second, unreviewed patient database.
--
-- ── No status, no scheduling, no cleanup job ────────────────────────────────
-- A visit is OPEN when "assessmentId" IS NULL and CLOSED when it is set. The
-- dashboard excludes anything older than a clinic session rather than running
-- an abandonment workflow. Purging genuinely abandoned rows is P2.
--
-- ── No clinicLocationId ─────────────────────────────────────────────────────
-- The signed intake session carries a clinicId and nothing else. Recording a
-- branch would mean plumbing one through the QR link, the landing page and the
-- token first; adding the column now would only guarantee it is null.

CREATE TABLE "ClinicVisit" (
    "id"              TEXT NOT NULL,
    "clinicId"        TEXT NOT NULL,
    -- Idempotency key. One intake session is one visit, however many times the
    -- patient edits their name or the client retries.
    "intakeSessionId" TEXT NOT NULL,
    "displayName"     TEXT NOT NULL,
    -- Used ONLY for "Assessment in progress - started 6 min ago". Doctor-review
    -- waiting time is measured from "Assessment"."submittedAt" and never here.
    "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Written once, by the submission transaction.
    "assessmentId"    TEXT,

    CONSTRAINT "ClinicVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicVisit_intakeSessionId_key"
    ON "ClinicVisit" ("intakeSessionId");

-- One visit can never be claimed by two submissions.
CREATE UNIQUE INDEX "ClinicVisit_assessmentId_key"
    ON "ClinicVisit" ("assessmentId");

-- The dashboard's only query: open visits at this clinic inside the session
-- window. Equality on clinicId, IS NULL on assessmentId, range on startedAt —
-- all three usable from one btree.
CREATE INDEX "ClinicVisit_clinicId_assessmentId_startedAt_idx"
    ON "ClinicVisit" ("clinicId", "assessmentId", "startedAt");

ALTER TABLE "ClinicVisit"
    ADD CONSTRAINT "ClinicVisit_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClinicVisit"
    ADD CONSTRAINT "ClinicVisit_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
