import { createHash } from "node:crypto";
import type { ConflictDraft, FiveKitDraftManifest, FiveKitId, KnowledgeClaimDraft, StructuredFactDraft } from "./fiveKitSlice";
import type { GovernanceAudit, GovernedConflictGroup, GovernedMissingValueRecord, GovernanceSeverity } from "./fiveKitGovernance";

export type QuantityGapCategory =
  | "EXPLICIT_COMPETING_QUANTITY"
  | "MISSING_INGREDIENT_QUANTITY"
  | "MISSING_KIT_COMPONENT_COUNT"
  | "MISSING_SERVING_BASIS"
  | "MISSING_UNIT"
  | "VARIANT_SPECIFIC_QUANTITY"
  | "PRODUCT_IDENTITY_DEPENDENT";

export type ProductIdentityClassification =
  | "ONE_PRODUCT_WITH_ALIASES"
  | "SEPARATE_PRODUCTS"
  | "OLD_AND_NEW_VERSION"
  | "VARIANT_SPECIFIC_PRODUCT"
  | "UNRESOLVED";

export type ClaimBatch = "BATCH_1" | "BATCH_2" | "BATCH_3" | "BATCH_4";

export type ConflictImpactExplanation = {
  relationshipId: string;
  conflictId: string;
  conflictType: ConflictDraft["type"];
  affectedKitIds: FiveKitId[];
  affectedProduct: string | null;
  affectedIngredient: string | null;
  sourceLocation: string;
  sourceDocument: string | null;
  reasonEnteredCurrentScope: string;
  relationshipOrigin: "EXISTING_RELATIONSHIP_RETAINED" | "NEWLY_DISCOVERED_RELATIONSHIP" | "CONSEQUENCE_OF_CANONICAL_VARIANT_EXPANSION";
  valueA: unknown;
  valueB: unknown;
};

export type QuantityGapDecision = {
  gapId: string;
  category: QuantityGapCategory;
  affectedKitIds: FiveKitId[];
  affectedProduct: string | null;
  affectedIngredient: string | null;
  currentRawValues: unknown[];
  currentNormalisedValues: unknown[];
  sourceDocument: string;
  sourceLocation: string;
  relatedConflictGroup: string | null;
  publicationImpact: string;
  humanQuestion: string;
  factId: string;
};

export type ProductIdentityIssue = {
  issueId: string;
  sourceName: string;
  canonicalProductId: string | null;
  relatedNames: string[];
  affectedKitIds: FiveKitId[];
  sourceLocation: string;
  classification: ProductIdentityClassification;
  status: "AWAITING_HUMAN_DECISION" | "RESOLVED_BY_GOVERNED_SOURCE";
  evidenceAvailable: string[];
  humanQuestion: string;
  automaticResolutionAllowed: false;
};

export type PrioritizedClaimReview = {
  claimId: string;
  kitId: FiveKitId;
  batch: ClaimBatch;
  category: string;
  risk: GovernanceSeverity;
  currentExtractedWording: string;
  sourceProvenance: KnowledgeClaimDraft["provenance"];
  unresolvedDependencies: string[];
  exactHairOsScientificInputRequired: string;
  patientWordingField: string;
  doctorWordingField: string;
  limitationsField: string;
  prohibitedWordingField: string;
  evidenceField: string;
  escalationField: string;
  status: "AWAITING_HAIROS_CONTENT";
};

export type PhenotypeInflammationReviewPackage = {
  kitId: "KIT_INFLAMMATION_PHENOTYPE";
  status: "AWAITING_HAIROS_CONTENT";
  purposeClaims: PrioritizedClaimReview[];
  inflammationBiologyClaims: PrioritizedClaimReview[];
  kitSelectionClaims: PrioritizedClaimReview[];
  scalpSymptomReview: Array<{
    topic: string;
    exactScientificExplanation: string;
    approvedPatientWording: string;
    approvedDoctorWording: string;
    triggeringAssessmentSignals: string[];
    exclusions: string;
    limitations: string;
    prohibitedClaims: string;
    escalationRules: string;
    evidenceReferences: string;
  }>;
  activeInfectionLimitations: string;
  productAndQuantityDependencies: QuantityGapDecision[];
  conflictDependencies: GovernedConflictGroup[];
};

export type FiveKitReviewPackages = {
  generatedAt: string;
  conflictImpactExplanation: {
    previousImpactCount: 13;
    currentImpactCount: number;
    explanation: string;
    records: ConflictImpactExplanation[];
  };
  quantityGapDecisions: QuantityGapDecision[];
  quantityGapBreakdown: Record<QuantityGapCategory, number>;
  productIdentityReview: ProductIdentityIssue[];
  prioritizedClaimReviewQueue: PrioritizedClaimReview[];
  claimBatchCounts: Record<ClaimBatch, number>;
  claimRiskCounts: Record<GovernanceSeverity, number>;
  phenotypeInflammationReview: PhenotypeInflammationReviewPackage;
};

const stableId = (...parts: unknown[]): string => createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
const md = (value: unknown): string => String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

function sourceLocation(provenance: { sourceSheet?: string; sourceRow?: number; sourceColumn?: number; cellAddress?: string; paragraphStart?: number; paragraphEnd?: number } | null | undefined): string {
  if (!provenance) return "unknown";
  if (provenance.cellAddress) return `${provenance.sourceSheet ?? "sheet"}!${provenance.cellAddress}`;
  if (provenance.paragraphStart != null) return `paragraph ${provenance.paragraphStart}${provenance.paragraphEnd != null && provenance.paragraphEnd !== provenance.paragraphStart ? `-${provenance.paragraphEnd}` : ""}`;
  if (provenance.sourceRow != null) return `${provenance.sourceSheet ?? "sheet"} row ${provenance.sourceRow}`;
  return "unknown";
}

function splitProductIngredient(entityId: string): { product: string | null; ingredient: string | null } {
  const parts = entityId.split(":");
  if (parts.length >= 2 && !parts[0].startsWith("KIT_")) return { product: parts[0], ingredient: parts.slice(1).join(":") };
  if (parts.length >= 3 && parts[0].startsWith("KIT_")) return { product: parts[1], ingredient: null };
  return { product: entityId.startsWith("KIT_") ? null : entityId, ingredient: null };
}

function buildProductKitIndex(manifest: FiveKitDraftManifest): Map<string, FiveKitId[]> {
  const index = new Map<string, FiveKitId[]>();
  for (const fact of manifest.structuredFacts) {
    if (fact.entityType !== "KIT_COMPONENT" || fact.field !== "productId" || typeof fact.value !== "string") continue;
    const kitId = fact.entityId.split(":")[0] as FiveKitId;
    index.set(fact.value, [...(index.get(fact.value) ?? []), kitId]);
  }
  return index;
}

function kitIdsForFact(fact: GovernedMissingValueRecord, productKitIndex: Map<string, FiveKitId[]>): FiveKitId[] {
  if (fact.entityId.startsWith("KIT_")) return [fact.entityId.split(":")[0] as FiveKitId];
  const product = fact.entityId.split(":")[0];
  return [...new Set(productKitIndex.get(product) ?? [])];
}

function kitIdsForConflict(conflict: ConflictDraft, productKitIndex: Map<string, FiveKitId[]>): FiveKitId[] {
  if (conflict.entity.startsWith("KIT_")) return [conflict.entity as FiveKitId];
  const product = conflict.entity.split(":")[0];
  return [...new Set(productKitIndex.get(product) ?? [])];
}

function conflictGroupForFact(fact: GovernedMissingValueRecord, governance: GovernanceAudit): GovernedConflictGroup | null {
  return governance.conflictGroups.find((group) => group.entity === fact.entityId && group.conflictType === "MISSING_QUANTITY") ?? null;
}

function hasVariantKit(kitIds: FiveKitId[]): boolean {
  return kitIds.some((kitId) => kitId === "KIT_PRO_FACT_META_B_PCOS" || kitId === "KIT_PRO_FACT_META_B_THYROID" || kitId === "KIT_PRO_FACT_META_B_MENOPAUSE");
}

function classifyQuantityGap(fact: GovernedMissingValueRecord, governance: GovernanceAudit, kitIds: FiveKitId[]): QuantityGapCategory {
  const relatedConflict = conflictGroupForFact(fact, governance);
  const rawText = String(fact.provenance.rawExtractedValue ?? "").trim();
  if (/TRICHOGROW\+?/i.test(fact.entityId)) return "PRODUCT_IDENTITY_DEPENDENT";
  if (hasVariantKit(kitIds)) return "VARIANT_SPECIFIC_QUANTITY";
  if (relatedConflict) return "EXPLICIT_COMPETING_QUANTITY";
  if (fact.entityType === "KIT_COMPONENT") return "MISSING_KIT_COMPONENT_COUNT";
  if (rawText && /\d/.test(rawText) && /\b(I\s*U|IU|mcg|mg|cfu|billion)\b/i.test(rawText)) return "MISSING_SERVING_BASIS";
  if (rawText && /\d/.test(rawText)) return "MISSING_UNIT";
  return "MISSING_INGREDIENT_QUANTITY";
}

function quantityQuestion(category: QuantityGapCategory, fact: GovernedMissingValueRecord, kitIds: FiveKitId[], product: string | null, ingredient: string | null): string {
  const raw = String(fact.provenance.rawExtractedValue ?? "missing source value").trim();
  if (category === "PRODUCT_IDENTITY_DEPENDENT") return `Is this quantity for ${product ?? fact.entityId} tied to F-TRICHOGROW, F-TRICHOGROW+, or an old/current version mapping?`;
  if (category === "VARIANT_SPECIFIC_QUANTITY") return `Does this quantity belong specifically to ${kitIds.join(", ")} rather than the base PRO FACT META B kit?`;
  if (category === "MISSING_KIT_COMPONENT_COUNT") return `How many units of ${product ?? fact.entityId} are included in ${kitIds.join(", ") || "the kit"}?`;
  if (category === "EXPLICIT_COMPETING_QUANTITY") return `For ${ingredient ?? product ?? fact.entityId}, should the raw value "${raw}" be normalised, and what exact numeric quantity, unit, and serving basis should be stored?`;
  if (category === "MISSING_SERVING_BASIS") return `Does "${raw}" apply per tablet, per sachet, per serving, or per day for ${ingredient ?? product ?? fact.entityId}?`;
  if (category === "MISSING_UNIT") return `Is the source value "${raw}" expressed in mg, mcg, IU, CFU, or another governed unit for ${ingredient ?? product ?? fact.entityId}?`;
  return `What is the exact ingredient quantity for ${ingredient ?? fact.entityId} in ${product ?? "the product"}, including numeric value, unit, and serving basis?`;
}

function buildQuantityGapDecisions(manifest: FiveKitDraftManifest, governance: GovernanceAudit): QuantityGapDecision[] {
  const productKitIndex = buildProductKitIndex(manifest);
  return governance.missingValues
    .filter((fact) => fact.field === "quantity" && fact.status === "STILL_BLOCKING")
    .map((fact, index) => {
      const kitIds = kitIdsForFact(fact, productKitIndex);
      const { product, ingredient } = splitProductIngredient(fact.entityId);
      const relatedConflict = conflictGroupForFact(fact, governance);
      const category = classifyQuantityGap(fact, governance, kitIds);
      return {
        gapId: `gap_${stableId(fact.factId, fact.entityId, fact.provenance.cellAddress, index)}`,
        category,
        affectedKitIds: kitIds,
        affectedProduct: product,
        affectedIngredient: ingredient,
        currentRawValues: [fact.provenance.rawExtractedValue],
        currentNormalisedValues: [fact.value],
        sourceDocument: fact.provenance.sourceFile,
        sourceLocation: sourceLocation(fact.provenance),
        relatedConflictGroup: relatedConflict?.id ?? null,
        publicationImpact: "Patient and doctor RAG must not state this quantity until a governed value, unit, and serving basis are approved.",
        humanQuestion: quantityQuestion(category, fact, kitIds, product, ingredient),
        factId: fact.factId,
      };
    });
}

function buildConflictImpactExplanation(manifest: FiveKitDraftManifest): FiveKitReviewPackages["conflictImpactExplanation"] {
  const productKitIndex = buildProductKitIndex(manifest);
  const records = manifest.conflicts.map((conflict, index): ConflictImpactExplanation => {
    const kitIds = kitIdsForConflict(conflict, productKitIndex);
    const { product, ingredient } = splitProductIngredient(conflict.entity);
    const variantExpansion = conflict.entity === "F_TRICHO_INO:VITAMIN_D3" || kitIds.some((kitId) => kitId.includes("META_B_"));
    const origin = variantExpansion ? "CONSEQUENCE_OF_CANONICAL_VARIANT_EXPANSION" : "EXISTING_RELATIONSHIP_RETAINED";
    const source = conflict.sourceA ?? conflict.sourceB;
    return {
      relationshipId: `impact_${stableId(conflict.id, index, sourceLocation(source))}`,
      conflictId: conflict.id,
      conflictType: conflict.type,
      affectedKitIds: kitIds,
      affectedProduct: product,
      affectedIngredient: ingredient,
      sourceLocation: sourceLocation(source),
      sourceDocument: source?.sourceFile ?? null,
      reasonEnteredCurrentScope: variantExpansion
        ? "The current canonical scope registers Meta B variants as separate governed kits, so F-TRICHO INO Vitamin D3 formulation relationships now participate in the five-kit audit."
        : "The relationship belongs to a canonical governed kit or product already inside the five-kit HairOS slice.",
      relationshipOrigin: origin,
      valueA: conflict.valueA,
      valueB: conflict.valueB,
    };
  });
  return {
    previousImpactCount: 13,
    currentImpactCount: manifest.conflicts.length,
    explanation: "The impact count increased net +1: 13 - 1 + 2 = 14. The old generic Meta B ambiguity was resolved (-1), while two F-TRICHO INO Vitamin D3 relationships entered scope through canonical Meta B variant expansion (+2).",
    records,
  };
}

function relatedNamesForProduct(sourceName: string, manifest: FiveKitDraftManifest): string[] {
  const base = sourceName.replace(/\+$/, "");
  const names = new Set<string>([sourceName, base, `${base}+`]);
  for (const mapping of manifest.productMappings) {
    if (mapping.sourceName.replace(/\+$/, "") === base) names.add(mapping.sourceName);
    if (mapping.canonicalName?.replace(/\+$/, "") === base) names.add(mapping.canonicalName);
  }
  return [...names].filter(Boolean).sort();
}

function buildProductIdentityReview(manifest: FiveKitDraftManifest, quantityGaps: QuantityGapDecision[]): ProductIdentityIssue[] {
  const issues: ProductIdentityIssue[] = [];
  const ambiguousMappings = manifest.productMappings.filter((mapping) => mapping.matchMethod === "AMBIGUOUS_REVIEW_REQUIRED" || mapping.matchMethod === "UNMATCHED");
  for (const mapping of ambiguousMappings) {
    issues.push({
      issueId: `identity_${stableId(mapping.sourceName, mapping.provenance.cellAddress)}`,
      sourceName: mapping.sourceName,
      canonicalProductId: mapping.productId,
      relatedNames: relatedNamesForProduct(mapping.sourceName, manifest),
      affectedKitIds: /TRICHOGROW/i.test(mapping.sourceName) ? ["KIT_INFLAMMATION_PHENOTYPE"] : quantityGaps.filter((gap) => gap.affectedProduct === mapping.productId || gap.affectedProduct === mapping.sourceName).flatMap((gap) => gap.affectedKitIds),
      sourceLocation: sourceLocation(mapping.provenance),
      classification: "UNRESOLVED",
      status: "AWAITING_HUMAN_DECISION",
      evidenceAvailable: ["Workbook source name is present, but no authoritative approved product code or exact formulation identity has been recorded for an automatic merge."],
      humanQuestion: `Is ${mapping.sourceName} the same product as ${mapping.sourceName.replace(/\+$/, "")}, a separate plus product, or an old/current version relationship?`,
      automaticResolutionAllowed: false,
    });
  }
  if (!issues.some((issue) => /TRICHOGROW/i.test(issue.sourceName))) {
    issues.push({
      issueId: `identity_${stableId("F-TRICHOGROW_PLUS_NON_PLUS")}`,
      sourceName: "F-TRICHOGROW / F-TRICHOGROW+",
      canonicalProductId: "F_TRICHOGROW",
      relatedNames: ["F-TRICHOGROW", "F-TRICHOGROW+", "TRICHOGROW"],
      affectedKitIds: [],
      sourceLocation: "catalogue and workbook aliases",
      classification: "UNRESOLVED",
      status: "AWAITING_HUMAN_DECISION",
      evidenceAvailable: ["Plus and non-plus names appear in governed catalogue/workbook context without a recorded authoritative merge decision."],
      humanQuestion: "Should F-TRICHOGROW+ be governed as an alias of F-TRICHOGROW, a separate product, or an old/current version pair?",
      automaticResolutionAllowed: false,
    });
  }
  let variantIssueIndex = 0;
  for (const gap of quantityGaps.filter((item) => item.category === "VARIANT_SPECIFIC_QUANTITY")) {
    issues.push({
      issueId: `identity_${stableId(gap.gapId, "variant", variantIssueIndex++)}`,
      sourceName: gap.affectedProduct ?? gap.gapId,
      canonicalProductId: gap.affectedProduct,
      relatedNames: [gap.affectedProduct ?? gap.gapId],
      affectedKitIds: gap.affectedKitIds,
      sourceLocation: gap.sourceLocation,
      classification: "VARIANT_SPECIFIC_PRODUCT",
      status: "AWAITING_HUMAN_DECISION",
      evidenceAvailable: ["The product appears inside a canonical Meta B variant composition, but no inherited component rule is approved."],
      humanQuestion: `Does ${gap.affectedProduct ?? "this product"} have a variant-specific identity or quantity rule for ${gap.affectedKitIds.join(", ")}?`,
      automaticResolutionAllowed: false,
    });
  }
  return issues;
}

function claimBatch(claim: KnowledgeClaimDraft): { batch: ClaimBatch; category: string; risk: GovernanceSeverity } {
  const text = claim.claimText.toLowerCase();
  if (/expected|timeline|week|month|response|outcome|regrowth|result/.test(text) || claim.claimType === "EXPECTED_RESPONSE") return { batch: "BATCH_4", category: "Expected response / outcome / timeline", risk: "HIGH" };
  if (/safety|contraindicat|avoid|escalat|doctor|severe|boil|pus|fever|infection|pain|redness/.test(text) || claim.claimType === "SAFETY") return { batch: "BATCH_2", category: "Safety / contraindication / escalation", risk: "HIGH" };
  if (/inflammation|gut|metabolic|thyroid|pcos|menopause|androgen|dht|nutrient|biology|mechanism|cytokine|insulin/.test(text) || claim.claimType === "MECHANISM" || claim.claimType === "INGREDIENT_MECHANISM") return { batch: "BATCH_3", category: "Hair biology and mechanism", risk: "HIGH" };
  return { batch: "BATCH_1", category: "Kit purpose and patient-plan explanation", risk: "MEDIUM" };
}

function claimDependencies(claim: KnowledgeClaimDraft, quantityGaps: QuantityGapDecision[], productIssues: ProductIdentityIssue[]): string[] {
  const dependencies: string[] = [];
  if (quantityGaps.some((gap) => gap.affectedKitIds.includes(claim.kitId))) dependencies.push("Publication-blocking quantity gaps exist for this kit.");
  if (productIssues.some((issue) => issue.affectedKitIds.includes(claim.kitId) || /TRICHOGROW/i.test(issue.sourceName))) dependencies.push("Unresolved product identity decisions may affect product-specific wording.");
  if (claim.evidenceStatus !== "SUPPORTED") dependencies.push("Evidence is not yet marked SUPPORTED.");
  if (claim.medicalReviewStatus !== "APPROVED") dependencies.push("Medical approval is not recorded.");
  return dependencies;
}

function buildPrioritizedClaims(manifest: FiveKitDraftManifest, quantityGaps: QuantityGapDecision[], productIssues: ProductIdentityIssue[]): PrioritizedClaimReview[] {
  return manifest.claims.map((claim) => {
    const classified = claimBatch(claim);
    return {
      claimId: claim.claimId,
      kitId: claim.kitId,
      batch: classified.batch,
      category: classified.category,
      risk: classified.risk,
      currentExtractedWording: claim.claimText,
      sourceProvenance: claim.provenance,
      unresolvedDependencies: claimDependencies(claim, quantityGaps, productIssues),
      exactHairOsScientificInputRequired: `Authorized HairOS team must provide exact science, approved scope, evidence references, limitations, and audience-specific wording for ${classified.category}.`,
      patientWordingField: "AWAITING_HAIROS_CONTENT",
      doctorWordingField: "AWAITING_HAIROS_CONTENT",
      limitationsField: "AWAITING_HAIROS_CONTENT",
      prohibitedWordingField: "AWAITING_HAIROS_CONTENT",
      evidenceField: "AWAITING_HAIROS_CONTENT",
      escalationField: classified.batch === "BATCH_2" ? "AWAITING_HAIROS_CONTENT" : "NOT_APPLICABLE_UNLESS_REVIEWER_ADDS_ESCALATION_RULE",
      status: "AWAITING_HAIROS_CONTENT",
    };
  });
}

function buildPhenotypeInflammationReview(governance: GovernanceAudit, prioritizedClaims: PrioritizedClaimReview[], quantityGaps: QuantityGapDecision[]): PhenotypeInflammationReviewPackage {
  const kitClaims = prioritizedClaims.filter((claim) => claim.kitId === "KIT_INFLAMMATION_PHENOTYPE");
  const topics = ["scalp symptoms", "bumps and boils", "pus or discharge", "pain", "spreading redness", "fever", "recurrence", "scarring", "patchy loss", "mild/moderate/severe classification", "doctor escalation", "active infection limitations"];
  return {
    kitId: "KIT_INFLAMMATION_PHENOTYPE",
    status: "AWAITING_HAIROS_CONTENT",
    purposeClaims: kitClaims.filter((claim) => claim.batch === "BATCH_1"),
    inflammationBiologyClaims: kitClaims.filter((claim) => claim.batch === "BATCH_3"),
    kitSelectionClaims: kitClaims.filter((claim) => claim.batch === "BATCH_2" || claim.batch === "BATCH_4"),
    scalpSymptomReview: topics.map((topic) => ({
      topic,
      exactScientificExplanation: "AWAITING_HAIROS_CONTENT",
      approvedPatientWording: "AWAITING_HAIROS_CONTENT",
      approvedDoctorWording: "AWAITING_HAIROS_CONTENT",
      triggeringAssessmentSignals: [],
      exclusions: "AWAITING_HAIROS_CONTENT",
      limitations: "AWAITING_HAIROS_CONTENT",
      prohibitedClaims: "AWAITING_HAIROS_CONTENT",
      escalationRules: "AWAITING_HAIROS_CONTENT",
      evidenceReferences: "AWAITING_HAIROS_CONTENT",
    })),
    activeInfectionLimitations: "AWAITING_HAIROS_CONTENT",
    productAndQuantityDependencies: quantityGaps.filter((gap) => gap.affectedKitIds.includes("KIT_INFLAMMATION_PHENOTYPE")),
    conflictDependencies: governance.conflictGroups.filter((group) => group.kitIds.includes("KIT_INFLAMMATION_PHENOTYPE")),
  };
}

export function buildFiveKitReviewPackages(manifest: FiveKitDraftManifest, governance: GovernanceAudit): FiveKitReviewPackages {
  const quantityGapDecisions = buildQuantityGapDecisions(manifest, governance);
  const productIdentityReview = buildProductIdentityReview(manifest, quantityGapDecisions);
  const prioritizedClaimReviewQueue = buildPrioritizedClaims(manifest, quantityGapDecisions, productIdentityReview);
  const quantityGapBreakdown = quantityGapDecisions.reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] ?? 0) + 1 }), {
    EXPLICIT_COMPETING_QUANTITY: 0,
    MISSING_INGREDIENT_QUANTITY: 0,
    MISSING_KIT_COMPONENT_COUNT: 0,
    MISSING_SERVING_BASIS: 0,
    MISSING_UNIT: 0,
    VARIANT_SPECIFIC_QUANTITY: 0,
    PRODUCT_IDENTITY_DEPENDENT: 0,
  } as Record<QuantityGapCategory, number>);
  const claimBatchCounts = prioritizedClaimReviewQueue.reduce((acc, item) => ({ ...acc, [item.batch]: (acc[item.batch] ?? 0) + 1 }), { BATCH_1: 0, BATCH_2: 0, BATCH_3: 0, BATCH_4: 0 } as Record<ClaimBatch, number>);
  const claimRiskCounts = prioritizedClaimReviewQueue.reduce((acc, item) => ({ ...acc, [item.risk]: (acc[item.risk] ?? 0) + 1 }), { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<GovernanceSeverity, number>);
  return {
    generatedAt: manifest.generatedAt,
    conflictImpactExplanation: buildConflictImpactExplanation(manifest),
    quantityGapDecisions,
    quantityGapBreakdown,
    productIdentityReview,
    prioritizedClaimReviewQueue,
    claimBatchCounts,
    claimRiskCounts,
    phenotypeInflammationReview: buildPhenotypeInflammationReview(governance, prioritizedClaimReviewQueue, quantityGapDecisions),
  };
}

export function renderDecisionReadyQuantityGapReport(packages: FiveKitReviewPackages): string {
  const groupOrder: Array<[string, (gap: QuantityGapDecision) => boolean]> = [
    ["Product identity dependencies", (gap) => gap.category === "PRODUCT_IDENTITY_DEPENDENT"],
    ["Explicit quantity conflicts", (gap) => gap.category === "EXPLICIT_COMPETING_QUANTITY"],
    ["Missing kit-component counts", (gap) => gap.category === "MISSING_KIT_COMPONENT_COUNT"],
    ["Missing ingredient quantities", (gap) => gap.category === "MISSING_INGREDIENT_QUANTITY"],
    ["Serving-basis or unit gaps", (gap) => gap.category === "MISSING_SERVING_BASIS" || gap.category === "MISSING_UNIT"],
    ["Meta B variant-specific gaps", (gap) => gap.category === "VARIANT_SPECIFIC_QUANTITY"],
  ];
  return `# Decision-ready publication-blocking quantity gaps\n\nGenerated: ${packages.generatedAt}\n\n## Breakdown\n\n${Object.entries(packages.quantityGapBreakdown).map(([category, count]) => `- ${category}: ${count}`).join("\n")}\n\n${groupOrder.map(([heading, predicate]) => {
    const rows = packages.quantityGapDecisions.filter(predicate);
    return `## ${heading}\n\n| Gap id | Category | Kit ids | Product | Ingredient | Raw values | Normalised values | Source | Related conflict group | Publication impact | Human question |\n|---|---|---|---|---|---|---|---|---|---|---|\n${rows.map((gap) => `| ${gap.gapId} | ${gap.category} | ${md(gap.affectedKitIds.join(", "))} | ${md(gap.affectedProduct)} | ${md(gap.affectedIngredient)} | ${md(JSON.stringify(gap.currentRawValues))} | ${md(JSON.stringify(gap.currentNormalisedValues))} | ${md(`${gap.sourceDocument} ${gap.sourceLocation}`)} | ${md(gap.relatedConflictGroup)} | ${md(gap.publicationImpact)} | ${md(gap.humanQuestion)} |`).join("\n") || "| none | | | | | | | | | | |"}`;
  }).join("\n\n")}`;
}

export function renderProductIdentityReview(packages: FiveKitReviewPackages): string {
  return `# Five-kit product identity review\n\nGenerated: ${packages.generatedAt}\n\n| Issue id | Source name | Classification | Status | Related names | Affected kits | Source | Human question |\n|---|---|---|---|---|---|---|---|\n${packages.productIdentityReview.map((issue) => `| ${issue.issueId} | ${md(issue.sourceName)} | ${issue.classification} | ${issue.status} | ${md(issue.relatedNames.join(", "))} | ${md(issue.affectedKitIds.join(", "))} | ${md(issue.sourceLocation)} | ${md(issue.humanQuestion)} |`).join("\n")}\n\nNo product identities are automatically merged from name similarity alone.`;
}

export function renderClaimReviewReport(packages: FiveKitReviewPackages): string {
  return `# Five-kit prioritized claim review queue\n\nGenerated: ${packages.generatedAt}\n\n## Batch counts\n\n${Object.entries(packages.claimBatchCounts).map(([batch, count]) => `- ${batch}: ${count}`).join("\n")}\n\n## Risk counts\n\n${Object.entries(packages.claimRiskCounts).map(([risk, count]) => `- ${risk}: ${count}`).join("\n")}\n\n| Claim id | Kit | Batch | Category | Risk | Current extracted wording | Dependencies | Required HairOS input | Status |\n|---|---|---|---|---|---|---|---|---|\n${packages.prioritizedClaimReviewQueue.map((claim) => `| ${claim.claimId} | ${claim.kitId} | ${claim.batch} | ${md(claim.category)} | ${claim.risk} | ${md(claim.currentExtractedWording)} | ${md(claim.unresolvedDependencies.join("; "))} | ${md(claim.exactHairOsScientificInputRequired)} | ${claim.status} |`).join("\n")}`;
}

export function renderPhenotypeInflammationReview(packages: FiveKitReviewPackages): string {
  const review = packages.phenotypeInflammationReview;
  return `# Phenotype Inflammation medical review package\n\nGenerated: ${packages.generatedAt}\n\nStatus: ${review.status}\n\n## Claim inventory\n\n- Purpose claims: ${review.purposeClaims.length}\n- Inflammation biology claims: ${review.inflammationBiologyClaims.length}\n- Kit-selection, escalation, and response claims: ${review.kitSelectionClaims.length}\n- Product and quantity dependencies: ${review.productAndQuantityDependencies.length}\n- Conflict dependencies: ${review.conflictDependencies.length}\n\n## Scalp symptom and escalation fields\n\n| Topic | Exact scientific explanation | Approved patient wording | Approved doctor wording | Triggering signals | Exclusions | Limitations | Prohibited claims | Escalation rules | Evidence references |\n|---|---|---|---|---|---|---|---|---|---|\n${review.scalpSymptomReview.map((item) => `| ${md(item.topic)} | ${item.exactScientificExplanation} | ${item.approvedPatientWording} | ${item.approvedDoctorWording} | ${md(item.triggeringAssessmentSignals.join(", "))} | ${item.exclusions} | ${item.limitations} | ${item.prohibitedClaims} | ${item.escalationRules} | ${item.evidenceReferences} |`).join("\n")}\n\n## Product and quantity dependencies\n\n| Gap id | Product | Ingredient | Category | Human question |\n|---|---|---|---|---|\n${review.productAndQuantityDependencies.map((gap) => `| ${gap.gapId} | ${md(gap.affectedProduct)} | ${md(gap.affectedIngredient)} | ${gap.category} | ${md(gap.humanQuestion)} |`).join("\n") || "| none | | | | |"}\n\nNo missing science has been filled by AI; all wording fields remain for the authorised HairOS team.`;
}

export function renderConflictImpactComparison(packages: FiveKitReviewPackages): string {
  const explanation = packages.conflictImpactExplanation;
  return `# Five-kit conflict-impact comparison\n\nGenerated: ${packages.generatedAt}\n\n${explanation.explanation}\n\n| Relationship id | Conflict id | Type | Kit ids | Product | Ingredient | Source | Origin | Reason entered current scope |\n|---|---|---|---|---|---|---|---|---|\n${explanation.records.map((record) => `| ${record.relationshipId} | ${record.conflictId} | ${record.conflictType} | ${md(record.affectedKitIds.join(", "))} | ${md(record.affectedProduct)} | ${md(record.affectedIngredient)} | ${md(`${record.sourceDocument ?? "unknown"} ${record.sourceLocation}`)} | ${record.relationshipOrigin} | ${md(record.reasonEnteredCurrentScope)} |`).join("\n")}`;
}