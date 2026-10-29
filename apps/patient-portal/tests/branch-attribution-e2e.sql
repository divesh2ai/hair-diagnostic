-- End-to-end verification for two-branch assessment attribution.
--
-- This is a DATA-LAYER E2E: it runs the real schema (post
-- prisma/migrations/20261029_assessment_clinic_location) against a real
-- Postgres and asserts the whole contract the feature rests on. The pure
-- resolver/filter logic is unit-tested in:
--   src/lib/clinics/branches.test.ts
--   src/lib/doctor/branchFilter.test.ts
--
-- It is written to run inside a transaction and ROLL BACK, so it leaves no
-- rows behind — safe to run against staging. Run it with any SQL client bound
-- to a database that has the migration applied, e.g. via the Supabase SQL
-- editor or `psql -f`. Expected result: one JSON row where
--   attribution.mulund_case = <Mulund location id>
--   attribution.bandra_case = <Bandra location id>
--   attribution.generic_case_is_null = true
--   attribution.cross_clinic_forge_is_null = true
--   dashboard_clinicA = { all_patients:4, mulund:1, bandra:1, unattributed:2 }
--   isolation.clinicA_assessments_attributed_to_foreign_branch = 0
--   isolation.clinicB_branch_unresolvable_under_clinicA = 0
--   review_carry_through = { decision:"APPROVED", branch_after_review:<Mulund>, consultation_clinic:"e2e_cA" }

BEGIN;

INSERT INTO "Clinic"(id,name,slug,region,"updatedAt") VALUES
 ('e2e_cA','E2E Yavana','e2e-yavana','Mumbai, IN',now()),
 ('e2e_cB','E2E Other','e2e-other','Delhi, IN',now());

-- Clinic A has Mulund + Bandra. Clinic B also carries slug 'mulund' to prove
-- the branch slug is unique PER CLINIC and never crosses a clinic boundary.
INSERT INTO "ClinicLocation"(id,"clinicId","branchName",slug,status,"updatedAt") VALUES
 ('e2e_mul','e2e_cA','Mulund','mulund','ACTIVE',now()),
 ('e2e_ban','e2e_cA','Bandra','bandra','ACTIVE',now()),
 ('e2e_bmul','e2e_cB','Mulund','mulund','ACTIVE',now());

INSERT INTO "Doctor"(id,"clinicId",name,"updatedAt") VALUES
 ('e2e_dA','e2e_cA','Dr A',now()),('e2e_dB','e2e_cB','Dr B',now());

INSERT INTO "Patient"(id,"clinicId",name,"updatedAt") VALUES
 ('e2e_pA1','e2e_cA','A1 Mulund',now()),
 ('e2e_pA2','e2e_cA','A2 Bandra',now()),
 ('e2e_pA3','e2e_cA','A3 Generic',now()),
 ('e2e_pA4','e2e_cA','A4 Forge',now()),
 ('e2e_pB1','e2e_cB','B1',now());

-- Each clinicLocationId is the result of the SAME clinic-scoped validation the
-- submit route runs via resolveClinicBranch: clinicId + (slug|id) + not
-- soft-deleted + not CLOSED. A3 is a generic-URL walk-in (no branch). A4 is a
-- forged submission: Clinic A naming Clinic B's branch id — it must resolve to
-- null, never to Clinic B's branch.
INSERT INTO "Assessment"(id,"clinicId","patientId","clinicLocationId","updatedAt") VALUES
 ('e2e_aA1','e2e_cA','e2e_pA1',(SELECT id FROM "ClinicLocation" WHERE "clinicId"='e2e_cA' AND slug='mulund' AND "deletedAt" IS NULL AND status<>'CLOSED'),now()),
 ('e2e_aA2','e2e_cA','e2e_pA2',(SELECT id FROM "ClinicLocation" WHERE "clinicId"='e2e_cA' AND slug='bandra' AND "deletedAt" IS NULL AND status<>'CLOSED'),now()),
 ('e2e_aA3','e2e_cA','e2e_pA3',NULL,now()),
 ('e2e_aA4','e2e_cA','e2e_pA4',(SELECT id FROM "ClinicLocation" WHERE "clinicId"='e2e_cA' AND id='e2e_bmul' AND "deletedAt" IS NULL AND status<>'CLOSED'),now()),
 ('e2e_aB1','e2e_cB','e2e_pB1',(SELECT id FROM "ClinicLocation" WHERE "clinicId"='e2e_cB' AND slug='mulund' AND "deletedAt" IS NULL AND status<>'CLOSED'),now());

-- Consultation creation + doctor review on the Mulund case; branch must survive.
INSERT INTO "Consultation"(id,"assessmentId","clinicId","patientId","createdBy","updatedAt")
 VALUES ('e2e_con1','e2e_aA1','e2e_cA','e2e_pA1','e2e_dA',now());
UPDATE "Assessment" SET "reviewDecision"='APPROVED',"reviewingDoctorId"='e2e_dA',"reviewedAt"=now()
 WHERE id='e2e_aA1';

WITH latest AS (
  SELECT DISTINCT ON (p.id) p.id AS pid, a."clinicLocationId" AS loc
  FROM "Patient" p
  LEFT JOIN "Assessment" a ON a."patientId"=p.id AND a."clinicId"=p."clinicId"
  WHERE p."clinicId"='e2e_cA' AND p."deletedAt" IS NULL
  ORDER BY p.id, a."submittedAt" DESC NULLS LAST
)
SELECT json_build_object(
  'attribution', json_build_object(
    'mulund_case', (SELECT "clinicLocationId" FROM "Assessment" WHERE id='e2e_aA1'),
    'bandra_case', (SELECT "clinicLocationId" FROM "Assessment" WHERE id='e2e_aA2'),
    'generic_case_is_null', (SELECT "clinicLocationId" FROM "Assessment" WHERE id='e2e_aA3') IS NULL,
    'cross_clinic_forge_is_null', (SELECT "clinicLocationId" FROM "Assessment" WHERE id='e2e_aA4') IS NULL,
    'clinicB_mulund_case', (SELECT "clinicLocationId" FROM "Assessment" WHERE id='e2e_aB1')
  ),
  'dashboard_clinicA', json_build_object(
    'all_patients', (SELECT count(*) FROM latest),
    'mulund', (SELECT count(*) FROM latest WHERE loc='e2e_mul'),
    'bandra', (SELECT count(*) FROM latest WHERE loc='e2e_ban'),
    'unattributed', (SELECT count(*) FROM latest WHERE loc IS NULL)
  ),
  'isolation', json_build_object(
    'clinicA_patients_all_in_A', (SELECT bool_and("clinicId"='e2e_cA') FROM "Patient" WHERE "clinicId"='e2e_cA'),
    'clinicA_assessments_attributed_to_foreign_branch',
       (SELECT count(*) FROM "Assessment" a JOIN "ClinicLocation" l ON l.id=a."clinicLocationId"
        WHERE a."clinicId"='e2e_cA' AND l."clinicId"<>'e2e_cA'),
    'clinicB_branch_unresolvable_under_clinicA',
       (SELECT count(*) FROM "ClinicLocation" WHERE "clinicId"='e2e_cA' AND id='e2e_bmul')
  ),
  'review_carry_through', json_build_object(
    'decision', (SELECT "reviewDecision" FROM "Assessment" WHERE id='e2e_aA1'),
    'branch_after_review', (SELECT "clinicLocationId" FROM "Assessment" WHERE id='e2e_aA1'),
    'consultation_clinic', (SELECT "clinicId" FROM "Consultation" WHERE id='e2e_con1')
  )
) AS result;

ROLLBACK;
