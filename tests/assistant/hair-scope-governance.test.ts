import { describe, expect, it, vi } from "vitest";
import { ACTIVE_ASSISTANT_DOMAIN, DOMAIN_CONFIG } from "../../src/packages/assistant-core/domainConfig";
import { GENERAL_KNOWLEDGE_SEED } from "../../src/packages/assistant-core/generalKnowledgeSeed";
import { AdvancedKnowledgeIngestionPipeline, assertReadyForPublication, classifyDocumentType, type GovernedIngestionDraft, type IngestionFile, type IngestionRepository } from "../../src/packages/knowledge-ingestion/advancedIngestion";
import { canSourceOverride, SOURCE_AUTHORITY, type GovernedClaimDraft } from "../../src/packages/knowledge-ingestion/knowledgeGovernance";

const hairFile = (name = "hair-evidence.pdf", bytes = "hair-v1"): IngestionFile => ({ fileName: name, mimeType: "application/pdf", bytes: new TextEncoder().encode(bytes), logicalDocumentKey: "hair-evidence" });

function harness(existingFingerprint = false, priorHashes = new Set<string>()) {
  let saved: GovernedIngestionDraft | undefined;
  const repository: IngestionRepository = {
    findByFingerprint: vi.fn(async () => existingFingerprint ? ({ id: "existing", fingerprint: "x", logicalDocumentKey: "hair-evidence", version: 1, domain: "HAIR" as const, sourceType: "SCIENTIFIC_EVIDENCE" as const, lifecycleStatus: "ACTIVE" as const }) : null),
    findLatest: vi.fn(async () => null), getSectionHashes: vi.fn(async () => priorHashes), getActiveClaims: vi.fn(async () => []),
    saveDraft: vi.fn(async (draft) => { saved = draft; }),
  };
  const pipeline = new AdvancedKnowledgeIngestionPipeline(
    repository,
    { extract: vi.fn(async (file) => ({ title: file.fileName, metadata: {}, sections: [{ heading: "Hair cycle", text: "Hair follicle anagen catagen telogen education." }] })) },
    { extract: vi.fn(async () => [{ entityType: "CONDITION" as const, name: "Telogen effluvium" }]) },
    { extract: vi.fn(async () => []) },
    { extract: vi.fn(async ({ sourceId, sourceType }): Promise<GovernedClaimDraft[]> => [{ claimId: `${sourceId}:claim`, domain: "HAIR", subject: "Telogen effluvium", subjectType: "CONDITION", claimType: "MEDICAL_MECHANISM", statement: "Draft claim", sourceType, sourceId, authorityScore: 0, evidenceStatus: "UNASSESSED", approvalStatus: "DRAFT", audience: "PATIENT" }]) },
    { detect: vi.fn(async () => []) },
  );
  return { pipeline, repository, getSaved: () => saved };
}

describe("Hair domain scope", () => {
  it("keeps Hair active while Skin/Ortho are future and Ayurveda disabled", () => {
    expect(ACTIVE_ASSISTANT_DOMAIN).toBe("HAIR");
    expect(DOMAIN_CONFIG.SKIN.lifecycle).toBe("FUTURE");
    expect(DOMAIN_CONFIG.ORTHO.lifecycle).toBe("FUTURE");
    expect(DOMAIN_CONFIG.AYURVEDA.lifecycle).toBe("DISABLED");
  });

  it("contains no active non-Hair seed or Ayurveda publication", () => {
    expect(GENERAL_KNOWLEDGE_SEED.every((entry) => entry.domain === "HAIR" && entry.sourceStatus === "ACTIVE")).toBe(true);
    expect(JSON.stringify(GENERAL_KNOWLEDGE_SEED)).not.toMatch(/AYURVEDA/i);
  });
});

describe("governed multi-format ingestion", () => {
  it.each([
    ["file.pdf", "application/pdf", "PDF"], ["brochure.pdf", "application/pdf", "BROCHURE"],
    ["file.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX"],
    ["file.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "SPREADSHEET"],
    ["clinical-study.txt", "text/plain", "SCIENTIFIC_DOCUMENT"],
  ])("classifies %s", (fileName, mimeType, expected) => expect(classifyDocumentType({ fileName, mimeType })).toBe(expected));

  it("fingerprints duplicates and creates no second draft", async () => {
    const { pipeline, repository } = harness(true);
    expect((await pipeline.ingest(hairFile())).status).toBe("DUPLICATE");
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it.each(["ayurveda-hair.pdf", "skin-acne.pdf", "ortho-knee.pdf"])("rejects out-of-scope file %s before persistence", async (name) => {
    const { pipeline, repository } = harness();
    expect((await pipeline.ingest(hairFile(name))).status).toBe("REJECTED_OUT_OF_SCOPE");
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it("stores Hair extraction only as draft and blocks embedding pending review", async () => {
    const { pipeline, getSaved } = harness();
    expect((await pipeline.ingest(hairFile())).status).toBe("AWAITING_REVIEW");
    expect(getSaved()?.publicationStatus).toBe("DRAFT");
    expect(getSaved()?.embeddingStatus).toBe("BLOCKED_PENDING_APPROVAL");
    expect(getSaved()?.claims[0].approvalStatus).toBe("DRAFT");
    expect(getSaved()?.claims[0].authorityScore).toBe(SOURCE_AUTHORITY.INTERNAL_DRAFT);
  });

  it("requires approval and contradiction resolution before publication", () => {
    const draft = { source: { domain: "HAIR" }, contradictions: [], requiredReview: ["MEDICAL_APPROVED"] } as unknown as GovernedIngestionDraft;
    expect(() => assertReadyForPublication(draft, new Set())).toThrow(/MEDICAL_APPROVED/);
    expect(() => assertReadyForPublication(draft, new Set(["MEDICAL_APPROVED"]))).not.toThrow();
  });
});

describe("source authority", () => {
  it("prevents brochures overriding governed product, safety, protocol and scientific claims", () => {
    for (const source of ["PRODUCT_MASTER", "SAFETY_MASTER", "CLINICAL_PROTOCOL", "SCIENTIFIC_EVIDENCE"] as const) {
      expect(canSourceOverride("PRODUCT_BROCHURE", source, "MEDICAL_MECHANISM")).toBe(false);
    }
    expect(canSourceOverride("PRODUCT_BROCHURE", "PRODUCT_MASTER", "PRODUCT_COMPOSITION")).toBe(false);
    expect(canSourceOverride("PRODUCT_BROCHURE", "SAFETY_MASTER", "SAFETY_WORDING")).toBe(false);
  });
});
