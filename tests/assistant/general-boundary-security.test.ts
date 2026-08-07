import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repo = process.cwd();
const retrieval = readFileSync(`${repo}/src/packages/assistant-core/hybridRetrieval.ts`, "utf8");
const generalRoute = readFileSync(`${repo}/apps/patient-portal/src/app/api/assistant/general/route.ts`, "utf8");
const personalRoute = readFileSync(`${repo}/apps/patient-portal/src/app/api/assistant/chat/route.ts`, "utf8");
const retrievalMigration = readFileSync(`${repo}/prisma/migrations/20260720_general_assistant_retrieval/migration.sql`, "utf8");
const governanceMigration = readFileSync(`${repo}/prisma/migrations/20260720_hair_scope_claim_governance/migration.sql`, "utf8");
const migration = `${retrievalMigration}\n${governanceMigration}`;

describe("general versus personal access boundary", () => {
  it("locks anonymous knowledge retrieval to active, effective, patient-published Hair claims", () => {
    expect(retrieval).toContain('kc."clinicId" IS NULL');
    expect(retrieval).toContain('kd."clinicId" IS NULL');
    expect(retrieval).toContain('kc."domain" = \'HAIR\'');
    expect(retrieval).toContain('kd."sourceStatus" = \'ACTIVE\'');
    expect(retrieval).toContain('c."approvalStatus" = \'PUBLISHED_PATIENT\'');
    expect(retrieval).toContain('kc."effectiveUntil" IS NULL OR kc."effectiveUntil" > CURRENT_TIMESTAMP');
    expect(retrieval).toContain('kv."effectiveUntil" IS NULL OR kv."effectiveUntil" > CURRENT_TIMESTAMP');
    expect(retrieval).toContain("row_number() OVER");
    expect(retrieval).toContain("CrossEncoderReranker");
  });

  it("keeps the general route independent of clinic and patient context", () => {
    expect(generalRoute).not.toContain("getClinicContext");
    expect(generalRoute).not.toContain("prisma.patient");
    expect(generalRoute).not.toContain("prisma.assessment");
    expect(generalRoute).not.toContain("assistantThread.create");
    expect(generalRoute).toContain("PrismaGeneralCatalogue");
    expect(generalRoute).toContain("rateLimit");
  });

  it("requires an explicit personal mode on the authenticated endpoint", () => {
    expect(personalRoute).toContain("getClinicContext");
    expect(personalRoute).toContain("isPersonalPlanRequest(body.mode)");
    expect(personalRoute).toContain('mode: "PERSONAL_PLAN"');
  });
});

describe("Hair governance migration", () => {
  it("retains FTS and pgvector indexes", () => {
    expect(migration).toContain("to_tsvector('simple'");
    expect(migration).toContain("USING hnsw");
    expect(migration).toContain("vector_cosine_ops");
  });

  it("blocks non-Hair publication, enables RLS, and publishes no rows", () => {
    expect(governanceMigration).toContain("Only active HAIR documents may be published");
    expect(governanceMigration).toContain('ALTER TABLE "KnowledgeClaim" ENABLE ROW LEVEL SECURITY');
    expect(governanceMigration).toContain('CREATE POLICY "KnowledgeClaim_patient_published"');
    expect(governanceMigration).toContain('"domain"=\'HAIR\'');
    expect(governanceMigration).not.toMatch(/INSERT INTO "KnowledgeClaim"/i);
  });

  it("does not weaken existing RLS", () => {
    expect(migration).not.toMatch(/DROP\s+POLICY/i);
    expect(migration).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });
});
