import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20260718_drfact_rag_stage1/migration.sql"), "utf8");
const tables = [
  "Product", "ProductAlias", "ProductPriceVersion", "ProductPrice", "Ingredient", "ProductIngredient", "Kit", "KitAlias", "KitVersion", "KitProduct", "KitPrice", "KitSchedule",
  "KnowledgeDocument", "KnowledgeDocumentVersion", "KnowledgeChunk", "KnowledgeApproval", "KnowledgeConflict", "IngestionRun",
  "AssistantThread", "AssistantMessage", "AssistantCitation", "AssistantToolCall", "AssistantSafetyEvent", "AssistantFeedback", "AssistantEscalation", "AdverseEvent",
];

describe("Stage 1 migration security contract", () => {
  it.each(tables)("enables RLS for %s", (table) => expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
  it("restricts patient knowledge to patient-published, effective records", () => {
    const patientPolicy = sql.slice(sql.indexOf("KnowledgeChunk_patient_published"), sql.indexOf("KnowledgeChunk_write"));
    expect(patientPolicy).toContain("PUBLISHED_PATIENT");
    expect(patientPolicy).toContain('"effectiveFrom"');
    expect(patientPolicy).toContain('"effectiveUntil"');
    expect(patientPolicy).not.toContain("MEDICAL_REVIEW");
  });
  it("prevents null-scope duplicates and overlapping active prices", () => {
    expect(sql).toContain('COALESCE("clinicId", \'\')');
    expect(sql).toContain("ProductPrice_no_overlapping_active_ranges");
    expect(sql).toContain("KitPrice_no_overlapping_active_ranges");
  });
  it("binds assistant clinical scope to clinic-owned parents", () => {
    expect(sql).toContain("stage1_validate_thread_scope");
    expect(sql).toContain("AssistantThread_patient_scope_fkey");
    expect(sql).toContain("AssistantThread_assessment_scope_fkey");
  });
  it("grants service role while keeping authenticated access policy-bound", () => {
    expect(sql).toContain('GRANT ALL ON');
    expect(sql).toContain('TO service_role');
    expect(sql).toContain('TO authenticated');
  });
});
