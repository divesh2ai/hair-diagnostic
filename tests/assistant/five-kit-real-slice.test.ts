import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { deriveFiveKitGovernanceAudit } from "../../src/packages/knowledge-ingestion/fiveKitGovernance";
import { buildFiveKitReviewPackages, type FiveKitReviewPackages } from "../../src/packages/knowledge-ingestion/fiveKitReviewPackages";
import { extractDocx, extractWorkbook } from "../../src/packages/knowledge-ingestion/fiveKitSourceAdapters";
import { assertDraftOnly, buildFiveKitDraftManifest, FIVE_KIT_IDS, reconcileExactFact, type FiveKitDraftManifest, type StructuredFactDraft } from "../../src/packages/knowledge-ingestion/fiveKitSlice";

const docxPath = process.env.FIVE_KIT_DOCX ?? "C:\\Users\\ERA\\Downloads\\All Kits  Info.docx";
const xlsxPath = process.env.FIVE_KIT_XLSX ?? "C:\\Users\\ERA\\Downloads\\MRP sheet fluence khushal's copy.xlsx";
let manifest: FiveKitDraftManifest;
let governance: ReturnType<typeof deriveFiveKitGovernanceAudit>;
let reviewPackages: FiveKitReviewPackages;

beforeAll(async () => {
  const [docx, workbook] = await Promise.all([
    readFile(docxPath).then((bytes) => extractDocx(bytes, "All Kits  Info.docx")),
    readFile(xlsxPath).then((bytes) => extractWorkbook(bytes, "MRP sheet fluence khushal's copy.xlsx")),
  ]);
  manifest = buildFiveKitDraftManifest(workbook, docx);
  governance = deriveFiveKitGovernanceAudit(manifest);
  reviewPackages = buildFiveKitReviewPackages(manifest, governance);
});

describe("real five-kit ingestion slice", () => {
  it("extracts the real OOXML sources with stable fingerprints and exact source locations", () => {
    expect(manifest.sourceFiles.map((source) => source.fingerprint)).toEqual([
      "7d60d0cf984b7ada0ed7c96b76ee9e32372e51f49808cd795dc94c8b9c7227f9",
      "ced944ac2532207a8e9b2c32387862bce727d49b8c318650170f12f65f4860be",
    ]);
    expect(manifest.structuredFacts.every((fact) => !!fact.provenance.sourceFile && (!!fact.provenance.cellAddress || fact.provenance.paragraphOrTableIndex != null))).toBe(true);
  });

  it("builds the governed canonical kit set including the resolved Meta B family", () => {
    expect(manifest.kits.map((kit) => kit.kitId)).toEqual(FIVE_KIT_IDS);
    expect(manifest.kits.some((kit) => kit.kitId === "KIT_PRO_FACT_META_B" && kit.canonicalName === "PRO FACT META B")).toBe(true);
    expect(manifest.kits.some((kit) => kit.kitId === "KIT_PRO_FACT_META_B_PCOS" && kit.canonicalName === "PRO FACT META B PCOS")).toBe(true);
    expect(manifest.kits.some((kit) => kit.kitId === "KIT_PRO_FACT_META_B_THYROID" && kit.canonicalName === "PRO FACT META B THYROID")).toBe(true);
    expect(manifest.kits.some((kit) => kit.kitId === "KIT_PRO_FACT_META_B_MENOPAUSE" && kit.canonicalName === "PRO FACT META B MENOPAUSE")).toBe(true);
    expect(manifest.counts.kits).toBe(FIVE_KIT_IDS.length);
    expect(manifest.counts.claims).toBe(49);
    expect(manifest.counts.components).toBeGreaterThan(0);
  });

  it("keeps every real record draft, blocked, and non-patient-visible", () => {
    expect(() => assertDraftOnly(manifest)).not.toThrow();
    expect(manifest.productionPublished).toBe(false);
    expect(manifest.structuredFacts.every((fact) => fact.publicationBlocked)).toBe(true);
    expect(manifest.claims.every((claim) => claim.approvalStatus === "DRAFT" && !claim.patientVisible)).toBe(true);
  });

  it("resolves generic Meta B to the base kit and keeps named variants distinct", () => {
    const baseKit = manifest.kits.find((item) => item.kitId === "KIT_PRO_FACT_META_B");
    const pcosKit = manifest.kits.find((item) => item.kitId === "KIT_PRO_FACT_META_B_PCOS");
    const thyroidKit = manifest.kits.find((item) => item.kitId === "KIT_PRO_FACT_META_B_THYROID");
    const menopauseKit = manifest.kits.find((item) => item.kitId === "KIT_PRO_FACT_META_B_MENOPAUSE");
    expect(baseKit?.aliases).toContain("Meta B");
    expect(baseKit?.aliases).toContain("Profact Meta B");
    expect(baseKit?.sourceNames).toContain("PRO FACT  META-B");
    expect(pcosKit?.sourceNames).toContain("PRO FACT  META B - PCOS 6 (veg)");
    expect(thyroidKit?.sourceNames).toContain("PRO FACT  META B - HYPOTHYROID 3");
    expect(menopauseKit?.sourceNames).toContain("PRO FACT  META B - POST M 2");
    expect(manifest.conflicts.some((item) => item.entity === "KIT_META_B")).toBe(false);
    expect(governance.metaBIdentity.status).toBe("RESOLVED");
  });

  it("keeps Meta B variant composition distinct and blocked from publication", () => {
    const baseProducts = manifest.structuredFacts.filter((fact) => fact.entityType === "KIT_COMPONENT" && fact.entityId.startsWith("KIT_PRO_FACT_META_B:") && fact.field === "productId").map((fact) => fact.value);
    const pcosProducts = manifest.structuredFacts.filter((fact) => fact.entityType === "KIT_COMPONENT" && fact.entityId.startsWith("KIT_PRO_FACT_META_B_PCOS:") && fact.field === "productId").map((fact) => fact.value);
    expect(baseProducts).toContain("F_EASME");
    expect(pcosProducts).toContain("F_NAT_TX");
    expect(pcosProducts).not.toContain("F_EASME");
    expect(manifest.structuredFacts.filter((fact) => fact.entityId.includes("KIT_PRO_FACT_META_B")).every((fact) => fact.publicationBlocked)).toBe(true);
  });

  it("reconciles the current blocker inventory into governed audit outputs", () => {
    expect(governance.counts.raw.blockedClaims).toBe(49);
    expect(governance.counts.raw.conflictImpacts).toBe(14);
    expect(governance.counts.groupedConflictCount).toBe(11);
    expect(governance.counts.raw.missingValues).toBe(449);
    expect(governance.counts.routeNullsNotRequired).toBe(382);
    expect(governance.counts.publicationBlockingQuantityGaps).toBe(67);
    expect(governance.counts.byCategory.claims.STILL_BLOCKING).toBe(49);
    expect(governance.counts.byCategory.priceRecords.INTENTIONALLY_PARKED).toBeGreaterThan(0);
    expect(governance.comparison.current.ambiguousGenericMetaBMapping).toBe("RESOLVED");
  });

  it("reclassifies route nulls as not required while keeping quantity gaps publication-blocking", () => {
    const routeNulls = governance.missingValues.filter((item) => item.field === "route");
    const quantityGaps = governance.missingValues.filter((item) => item.field === "quantity");
    expect(routeNulls).toHaveLength(382);
    expect(routeNulls.every((item) => item.status === "NOT_REQUIRED_FOR_PUBLICATION" && item.missingReason === "NOT_APPLICABLE" && !item.governancePublicationBlocking)).toBe(true);
    expect(quantityGaps).toHaveLength(67);
    expect(quantityGaps.every((item) => item.status === "STILL_BLOCKING" && item.missingReason === "PUBLICATION_BLOCKING" && item.governancePublicationBlocking)).toBe(true);
  });

  it("keeps all claims in the HairOS replacement queue and out of patient publication", () => {
    expect(governance.claimReviewQueue).toHaveLength(49);
    expect(governance.claimReviewQueue.every((item) => item.queueStatus === "AWAITING_AUTHORIZED_HAIROS_CONTENT" && item.status === "STILL_BLOCKING" && !item.safeForPatientPublication)).toBe(true);
    expect(governance.safeForPatientPublication.some((item) => item.recordType === "CLAIM")).toBe(false);
  });

  it("tracks unresolved duplicate product identity and parseable quantity conflict groups separately", () => {
    const trichogrow = governance.conflictGroups.find((item) => item.entity === "F-TRICHOGROW+" && item.conflictType === "DUPLICATE_PRODUCT");
    const parseable = governance.conflictGroups.filter((item) => item.conflictType === "MISSING_QUANTITY" && item.authoritativeResolutionAvailable);
    expect(trichogrow?.status).toBe("STILL_BLOCKING");
    expect(parseable.length).toBeGreaterThan(0);
    expect(governance.counts.parseableQuantityGapImpacts).toBe(11);
  });


  it("explains the current 13-to-14 conflict-impact change at record level", () => {
    expect(reviewPackages.conflictImpactExplanation.previousImpactCount).toBe(13);
    expect(reviewPackages.conflictImpactExplanation.currentImpactCount).toBe(14);
    expect(reviewPackages.conflictImpactExplanation.explanation).toContain("13 - 1 + 2");
    expect(reviewPackages.conflictImpactExplanation.records).toHaveLength(14);
    const variantImpacts = reviewPackages.conflictImpactExplanation.records.filter((item) => item.relationshipOrigin === "CONSEQUENCE_OF_CANONICAL_VARIANT_EXPANSION");
    expect(variantImpacts).toHaveLength(2);
    expect(variantImpacts.every((item) => item.affectedProduct === "F_TRICHO_INO" && item.affectedIngredient === "VITAMIN_D3")).toBe(true);
  });

  it("produces decision-ready quantity gaps with categories and specific questions", () => {
    expect(reviewPackages.quantityGapDecisions).toHaveLength(67);
    expect(Object.values(reviewPackages.quantityGapBreakdown).reduce((sum, count) => sum + count, 0)).toBe(67);
    expect(reviewPackages.quantityGapBreakdown.EXPLICIT_COMPETING_QUANTITY).toBe(9);
    expect(reviewPackages.quantityGapBreakdown.MISSING_KIT_COMPONENT_COUNT).toBe(33);
    expect(reviewPackages.quantityGapBreakdown.VARIANT_SPECIFIC_QUANTITY).toBe(25);
    expect(new Set(reviewPackages.quantityGapDecisions.map((gap) => gap.gapId)).size).toBe(67);
    expect(reviewPackages.quantityGapDecisions.every((gap) => gap.gapId && gap.sourceDocument && gap.sourceLocation && gap.publicationImpact && gap.humanQuestion.length > 20)).toBe(true);
    expect(reviewPackages.quantityGapDecisions.some((gap) => gap.humanQuestion.toLowerCase().includes("confirm the quantity"))).toBe(false);
  });

  it("keeps product identity decisions unresolved unless governed evidence proves the relationship", () => {
    const trichogrow = reviewPackages.productIdentityReview.find((item) => item.sourceName.includes("TRICHOGROW"));
    expect(trichogrow?.classification).toBe("UNRESOLVED");
    expect(new Set(reviewPackages.productIdentityReview.map((item) => item.issueId)).size).toBe(reviewPackages.productIdentityReview.length);
    expect(reviewPackages.productIdentityReview.every((item) => item.automaticResolutionAllowed === false)).toBe(true);
    expect(reviewPackages.productIdentityReview.filter((item) => item.status === "RESOLVED_BY_GOVERNED_SOURCE")).toHaveLength(0);
  });

  it("prioritises all claims into HairOS review batches without approving patient content", () => {
    expect(reviewPackages.prioritizedClaimReviewQueue).toHaveLength(49);
    expect(Object.values(reviewPackages.claimBatchCounts).reduce((sum, count) => sum + count, 0)).toBe(49);
    expect(reviewPackages.prioritizedClaimReviewQueue.every((claim) => claim.status === "AWAITING_HAIROS_CONTENT" && claim.patientWordingField === "AWAITING_HAIROS_CONTENT")).toBe(true);
  });

  it("builds the Phenotype Inflammation review package with HairOS-owned science fields", () => {
    const review = reviewPackages.phenotypeInflammationReview;
    expect(review.kitId).toBe("KIT_INFLAMMATION_PHENOTYPE");
    expect(review.status).toBe("AWAITING_HAIROS_CONTENT");
    expect(review.scalpSymptomReview.map((item) => item.topic)).toEqual(expect.arrayContaining(["bumps and boils", "pus or discharge", "fever", "patchy loss"]));
    expect(review.scalpSymptomReview.every((item) => item.exactScientificExplanation === "AWAITING_HAIROS_CONTENT" && item.approvedPatientWording === "AWAITING_HAIROS_CONTENT")).toBe(true);
    expect(review.productAndQuantityDependencies.length).toBeGreaterThan(0);
  });
  it("refuses unavailable or conflicting exact facts and lets an approved structured fact override stale narrative", () => {
    const price = manifest.structuredFacts.find((fact) => fact.field === "mrp")!;
    expect(reconcileExactFact({ structured: [price], narrativeClaims: [] }).status).toBe("NO_APPROVED_FACT");
    const approved = { ...price, approvalStatus: "APPROVED", publicationBlocked: false, conflictStatus: "NONE" } as StructuredFactDraft;
    const conflict = { ...approved, id: `${approved.id}_conflict`, value: Number(approved.value) + 1 } as StructuredFactDraft;
    expect(reconcileExactFact({ structured: [approved, conflict], narrativeClaims: [] }).status).toBe("REFUSE_CONFLICT");
    const staleClaim = { ...manifest.claims[0], claimType: "COMMERCIAL_FACT" as const, claimText: "Old MRP 1" };
    const result = reconcileExactFact({ structured: [approved], narrativeClaims: [staleClaim] });
    expect(result.status).toBe("ANSWER");
    if (result.status === "ANSWER") expect(result.staleNarrativeClaimIds).toContain(staleClaim.claimId);
  });

  it("migration enforces RLS and blocks unsafe structured publication", () => {
    const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20260721_five_kit_real_slice/migration.sql"), "utf8");
    for (const table of ["ClaimEvidence", "StructuredFactRecord", "KnowledgeReviewAction"]) expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    expect(sql).toContain("StructuredFactRecord_publication_guard");
    expect(sql).toContain("conflictStatus");
    expect(sql).toContain("formulaError");
    expect(sql).toContain("requiresReview");
  });
});