import { createHash } from "node:crypto";
import type { DocxBlock, ExtractedDocx, ExtractedWorkbook, SourceProvenance, WorkbookCell, WorkbookSheet } from "./fiveKitSourceAdapters";
import { cellAt, provenanceForCell } from "./fiveKitSourceAdapters";

export const FIVE_KIT_IDS = [
  "KIT_TE_GOLD",
  "KIT_GI_HEALTH_GOLD",
  "KIT_PRO_IMMUNE_GOLD",
  "KIT_INFLAMMATION_PHENOTYPE",
  "KIT_PRO_FACT_META_B",
  "KIT_PRO_FACT_META_B_PCOS",
  "KIT_PRO_FACT_META_B_THYROID",
  "KIT_PRO_FACT_META_B_MENOPAUSE",
] as const;
export type FiveKitId = (typeof FIVE_KIT_IDS)[number];

export type ReviewState = "DRAFT" | "PENDING_REVIEW" | "CONFLICTED" | "INCOMPLETE" | "APPROVED" | "PUBLISHED" | "REJECTED" | "RETIRED";
export type MatchMethod = "EXACT_NORMALISED" | "APPROVED_ALIAS" | "PROPOSED_HIGH_CONFIDENCE" | "AMBIGUOUS_REVIEW_REQUIRED" | "UNMATCHED";
export type SectionType = "OVERVIEW" | "INDICATION" | "DIAGNOSIS_INSIGHT" | "TREATMENT_OBJECTIVE" | "THERAPEUTIC_STRATEGY" | "FORMULATION_RATIONALE" | "INGREDIENT_MECHANISM" | "EXPECTED_RESPONSE" | "CLINICAL_NOTE" | "CONCLUSION";
export type ClaimType = "PRODUCT_PURPOSE" | "INDICATION" | "CONDITION_EDUCATION" | "THERAPEUTIC_OBJECTIVE" | "MECHANISM" | "INGREDIENT_MECHANISM" | "EXPECTED_RESPONSE" | "SAFETY" | "USAGE" | "COMMERCIAL_FACT" | "MARKETING_CLAIM" | "SCIENTIFIC_CLAIM";

export type CanonicalKitDraft = {
  kitId: FiveKitId;
  canonicalName: string;
  aliases: string[];
  sourceNames: string[];
  domain: "HAIR";
  status: ReviewState;
  medicalVersion: number;
  commercialVersion: number;
  approvalStatus: ReviewState;
  requiresReview: boolean;
};

export type CanonicalProductMapping = {
  productId: string | null;
  canonicalName: string | null;
  sourceName: string;
  aliases: string[];
  matchMethod: MatchMethod;
  matchConfidence: number;
  reviewStatus: ReviewState;
  provenance: SourceProvenance;
};

export type StructuredFactDraft = {
  id: string;
  entityType: "KIT" | "PRODUCT" | "KIT_COMPONENT" | "PRODUCT_FORMULATION";
  entityId: string;
  field: string;
  value: unknown;
  approvalStatus: ReviewState;
  conflictStatus: "NONE" | "CONFLICTED" | "FORMULA_ERROR" | "MISSING" | "AMBIGUOUS";
  publicationBlocked: boolean;
  requiresReview: boolean;
  provenance: SourceProvenance;
};

export type KnowledgeChunkDraft = {
  id: string;
  kitId: FiveKitId;
  sectionType: SectionType;
  heading: string;
  content: string;
  paragraphStart: number;
  paragraphEnd: number;
  approvalStatus: "DRAFT";
  patientVisible: false;
  provenance: SourceProvenance;
};

export type KnowledgeClaimDraft = {
  claimId: string;
  chunkId: string;
  kitId: FiveKitId;
  claimText: string;
  claimType: ClaimType;
  audience: "INTERNAL" | "DOCTOR" | "PATIENT" | "DOCTOR_AND_PATIENT";
  patientVisible: boolean;
  medicalReviewStatus: ReviewState;
  commercialReviewStatus: ReviewState;
  evidenceStatus: "UNASSESSED" | "SUPPORTED" | "LIMITED" | "CONFLICTING" | "REJECTED";
  sourceAuthority: number;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  supersessionStatus: "ACTIVE" | "SUPERSEDED" | "STALE";
  approvalStatus: "DRAFT";
  provenance: SourceProvenance;
};

export type ConflictDraft = {
  id: string;
  type: "DUPLICATE_NARRATIVE" | "ALTERNATIVE_NARRATIVE" | "DUPLICATE_PRODUCT" | "ALIAS_AMBIGUITY" | "CONFLICTING_MRP" | "CONFLICTING_KIT_TOTAL" | "CONFLICTING_FORMULATION" | "BROKEN_FORMULA" | "MISSING_QUANTITY" | "INCONSISTENT_SCHEDULE" | "INCONSISTENT_EXPECTED_RESPONSE" | "BROCHURE_STRUCTURED_CONFLICT" | "OBSOLETE_SOURCE" | "INCOMPLETE_KIT" | "MISSING_LINKED_PRODUCT";
  entity: string;
  fieldOrClaim: string;
  sourceA: SourceProvenance | null;
  sourceB: SourceProvenance | null;
  valueA: unknown;
  valueB: unknown;
  authorityA: number;
  authorityB: number;
  proposedCanonicalValue: unknown;
  automaticResolutionAllowed: boolean;
  reviewRequired: true;
  publicationBlocked: boolean;
  recommendedAction: string;
};

export type FiveKitDraftManifest = {
  generatedAt: string;
  extractorVersion: string;
  sourceFiles: Array<{ fileName: string; fingerprint: string; version: number }>;
  kits: CanonicalKitDraft[];
  productMappings: CanonicalProductMapping[];
  structuredFacts: StructuredFactDraft[];
  chunks: KnowledgeChunkDraft[];
  claims: KnowledgeClaimDraft[];
  conflicts: ConflictDraft[];
  counts: Record<string, number>;
  publicationStatus: "DRAFT";
  productionPublished: false;
};

type KitDefinition = {
  kitId: FiveKitId;
  canonicalName: string;
  workbookExactName: string | null;
  workbookCandidate: RegExp;
  docStart: RegExp | null;
  seedAliases: string[];
};

export const FIVE_KIT_DEFINITIONS: readonly KitDefinition[] = [
  { kitId: "KIT_TE_GOLD", canonicalName: "Hair Fact TE GOLD", workbookExactName: "HAIR FACT TE GOLD", workbookCandidate: /^HAIR\s+FACT\s+TE\s+GOLD$/i, docStart: /^(Telogen Effluvium:|Clinical Recommendation:\s*Telogen Effluvium Gold)/i, seedAliases: ["T.E Gold", "TE GOLD", "Hair Fact T E Gold", "Telogen Effluvium Gold", "Telogen Effluvium Gold Stabilisation Protocol"] },
  { kitId: "KIT_GI_HEALTH_GOLD", canonicalName: "Pro Fact GI Health GOLD", workbookExactName: "PRO FACT GI HEALTH GOLD", workbookCandidate: /^PRO\s+FACT\s+GI\s+HEALTH\s+GOLD$/i, docStart: /^Gut.+GI Health Gold/i, seedAliases: ["GI Health GOLD", "GI GOLD", "Pro Fact GI Gold", "Gut-Brain-Skin Axis Optimization Protocol"] },
  { kitId: "KIT_PRO_IMMUNE_GOLD", canonicalName: "Pro Immune GOLD", workbookExactName: "PRO IMMUNE GOLD", workbookCandidate: /^PRO\s+IMMUNE\s+GOLD$/i, docStart: /^Pro\s+immune\s+gold$/i, seedAliases: ["Pro Immune", "Pro-Immune Gold", "PRO IMMUNE GOLD"] },
  { kitId: "KIT_INFLAMMATION_PHENOTYPE", canonicalName: "Pro Fact Inflammation Phenotype", workbookExactName: "PRO FACT INFLAMMATION PHENOTYPE", workbookCandidate: /^PRO\s+FACT\s+INFLAMMATION\s+PHENOTYPE$/i, docStart: /^Inflammation Control Protocol$/i, seedAliases: ["Inflammation Phenotype", "Phenotype Inflammation", "Inflammation Control Protocol"] },
  { kitId: "KIT_PRO_FACT_META_B", canonicalName: "PRO FACT META B", workbookExactName: "PRO FACT  META-B", workbookCandidate: /^PRO\s+FACT\s+META(?:\s+|-)B$/i, docStart: /^Meta\s+B$/i, seedAliases: ["Meta B", "META-B", "Profact Meta B", "Pro Fact Meta B", "Metabolic Optimization Protocol (Meta-B)"] },
  { kitId: "KIT_PRO_FACT_META_B_PCOS", canonicalName: "PRO FACT META B PCOS", workbookExactName: "PRO FACT  META B - PCOS 6 (veg)", workbookCandidate: /^PRO\s+FACT\s+META\s+B\s+PCOS/i, docStart: null, seedAliases: ["Meta B PCOS", "Profact Meta B PCOS", "Pro Fact Meta B PCOS"] },
  { kitId: "KIT_PRO_FACT_META_B_THYROID", canonicalName: "PRO FACT META B THYROID", workbookExactName: "PRO FACT  META B - HYPOTHYROID 3", workbookCandidate: /^PRO\s+FACT\s+META\s+B\s+HYPOTHYROID/i, docStart: null, seedAliases: ["Meta B Thyroid", "Profact Meta B Thyroid", "Pro Fact Meta B Thyroid", "Meta B Hypothyroid"] },
  { kitId: "KIT_PRO_FACT_META_B_MENOPAUSE", canonicalName: "PRO FACT META B MENOPAUSE", workbookExactName: "PRO FACT  META B - POST M 2", workbookCandidate: /^PRO\s+FACT\s+META\s+B\s+POST\s+M/i, docStart: null, seedAliases: ["Meta B Menopause", "Profact Meta B Menopause", "Pro Fact Meta B Menopause", "Meta B Post M 2"] },
] as const;

export const normaliseIdentity = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const stableId = (...parts: unknown[]): string => createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
const valueOf = (cell: WorkbookCell | null): string | number | boolean | null => cell?.formula ? cell.formulaResult : cell?.rawValue ?? null;
const asString = (value: unknown): string => value === null || value === undefined ? "" : String(value).trim();

const sectionType = (heading: string): SectionType => {
  const value = normaliseIdentity(heading);
  if (/INDICATION/.test(value)) return "INDICATION";
  if (/DIAGNOSIS|METABOLIC INSIGHT|CLINICAL IMPACT/.test(value)) return "DIAGNOSIS_INSIGHT";
  if (/OBJECTIVE|GOAL/.test(value)) return "TREATMENT_OBJECTIVE";
  if (/STRATEGY|ROOT CAUSE/.test(value)) return "THERAPEUTIC_STRATEGY";
  if (/FORMULATION RATIONALE/.test(value)) return "FORMULATION_RATIONALE";
  if (/INGREDIENT|MECHANISM/.test(value)) return "INGREDIENT_MECHANISM";
  if (/EXPECTED/.test(value)) return "EXPECTED_RESPONSE";
  if (/CLINICAL NOTE/.test(value)) return "CLINICAL_NOTE";
  if (/CONCLUSION/.test(value)) return "CONCLUSION";
  return "OVERVIEW";
};

const claimType = (text: string, section: SectionType): ClaimType => {
  if (/contraindicat|warning|adverse|avoid|unsafe|safety/i.test(text)) return "SAFETY";
  if (/mrp|price|gst|₹|rs\.?\s*\d/i.test(text)) return "COMMERCIAL_FACT";
  if (section === "INDICATION") return "INDICATION";
  if (section === "TREATMENT_OBJECTIVE") return "THERAPEUTIC_OBJECTIVE";
  if (section === "EXPECTED_RESPONSE") return "EXPECTED_RESPONSE";
  if (section === "INGREDIENT_MECHANISM" || /ingredient/i.test(text)) return "INGREDIENT_MECHANISM";
  if (/mechanism|modulat|inhibit|stimulat|conversion|sensitivity|cytokine/i.test(text)) return "MECHANISM";
  if (/take|daily|weekly|schedule|dose/i.test(text)) return "USAGE";
  if (/designed|purpose|support/i.test(text)) return "PRODUCT_PURPOSE";
  return "CONDITION_EDUCATION";
};

const STRONG_MEDICAL = /cytokine|thyroid conversion|androgen inhibit|insulin sensitivit|immune modulat|stem.?cell stimulat|disease outcome|steroid reduction|guaranteed|regrowth|within\s+\d+\s*(day|week|month)/i;

function docxRangeForKit(docx: ExtractedDocx, definition: KitDefinition): DocxBlock[] {
  if (!definition.docStart) return [];
  const start = docx.blocks.findIndex((block) => definition.docStart!.test(block.text.trim()));
  if (start < 0) return [];
  let conclusionSeen = false;
  let end = docx.blocks.length;
  for (let index = start + 1; index < docx.blocks.length; index += 1) {
    const block = docx.blocks[index];
    if (sectionType(block.text) === "CONCLUSION" && block.headingLevel !== null) conclusionSeen = true;
    if (conclusionSeen && block.headingLevel !== null && sectionType(block.text) !== "CONCLUSION") { end = index; break; }
  }
  return docx.blocks.slice(start, end);
}

function buildKnowledge(docx: ExtractedDocx): { chunks: KnowledgeChunkDraft[]; claims: KnowledgeClaimDraft[]; aliases: Map<FiveKitId, Set<string>>; conflicts: ConflictDraft[] } {
  const chunks: KnowledgeChunkDraft[] = [];
  const claims: KnowledgeClaimDraft[] = [];
  const aliases = new Map<FiveKitId, Set<string>>();
  const conflicts: ConflictDraft[] = [];
  for (const definition of FIVE_KIT_DEFINITIONS) {
    const blocks = docxRangeForKit(docx, definition);
    const seededAliases = new Set([definition.canonicalName, ...definition.seedAliases, ...blocks.filter((block) => block.headingLevel !== null).map((block) => block.text).filter((value) => value.length < 140)]);
    aliases.set(definition.kitId, seededAliases);
    if (!definition.docStart) continue;
    if (!blocks.length) {
      conflicts.push(conflict("INCOMPLETE_KIT", definition.kitId, "DOCX_SECTION", null, null, null, null, "Locate or authoritatively map the missing kit narrative."));
      continue;
    }
    let currentHeading = definition.canonicalName;
    let currentType: SectionType = "OVERVIEW";
    let current: DocxBlock[] = [];
    const flush = () => {
      if (!current.length) return;
      const pieces: DocxBlock[][] = [];
      let part: DocxBlock[] = [];
      let length = 0;
      for (const block of current) {
        if (part.length && length + block.text.length > 1600) { pieces.push(part); part = []; length = 0; }
        part.push(block); length += block.text.length;
      }
      if (part.length) pieces.push(part);
      for (const [partIndex, piece] of pieces.entries()) {
        const content = piece.map((block) => block.bullet ? `- ${block.text}` : block.text).join("\n").trim();
        const paragraphStart = piece[0].position;
        const paragraphEnd = piece[piece.length - 1].position;
        const provenance: SourceProvenance = { sourceFile: docx.fileName, sourceVersion: 1, sourceFingerprint: docx.fingerprint, sourceSection: currentHeading, paragraphStart, paragraphEnd, rawExtractedValue: content, normalisedValue: content, extractedAt: docx.extractedAt, extractorVersion: docx.extractorVersion };
        const id = `chunk_${stableId(definition.kitId, currentHeading, partIndex, content)}`;
        chunks.push({ id, kitId: definition.kitId, sectionType: currentType, heading: currentHeading, content, paragraphStart, paragraphEnd, approvalStatus: "DRAFT", patientVisible: false, provenance });
        const sentences = content.replace(/^[-•]\s*/gm, "").split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((value) => value.trim()).filter((value) => value.length >= 20);
        for (const sentence of sentences) {
          const type = claimType(sentence, currentType);
          const strong = STRONG_MEDICAL.test(sentence);
          claims.push({ claimId: `claim_${stableId(id, sentence)}`, chunkId: id, kitId: definition.kitId, claimText: sentence, claimType: type, audience: strong ? "DOCTOR" : "INTERNAL", patientVisible: false, medicalReviewStatus: "PENDING_REVIEW", commercialReviewStatus: type === "COMMERCIAL_FACT" ? "PENDING_REVIEW" : "DRAFT", evidenceStatus: "UNASSESSED", sourceAuthority: 20, effectiveFrom: null, effectiveUntil: null, supersessionStatus: "ACTIVE", approvalStatus: "DRAFT", provenance });
        }
      }
      current = [];
    };
    for (const block of blocks) {
      if (block.headingLevel !== null) {
        const candidate = sectionType(block.text);
        if (candidate !== "OVERVIEW" || block === blocks[0]) { flush(); currentHeading = block.text; currentType = candidate; continue; }
      }
      if (/^\s*Or\s*[:.-]?\s*$/i.test(block.text) || /alternative version/i.test(block.text)) {
        conflicts.push(conflict("ALTERNATIVE_NARRATIVE", definition.kitId, currentHeading, provenanceForDoc(docx, block), null, block.text, null, "Reviewer must select or merge the alternative narrative."));
      }
      current.push(block);
    }
    flush();
    const required = new Set<SectionType>(["INDICATION", "TREATMENT_OBJECTIVE", "THERAPEUTIC_STRATEGY", "FORMULATION_RATIONALE", "EXPECTED_RESPONSE", "CLINICAL_NOTE", "CONCLUSION"]);
    for (const chunk of chunks.filter((item) => item.kitId === definition.kitId)) required.delete(chunk.sectionType);
    if (required.size) conflicts.push(conflict("INCOMPLETE_KIT", definition.kitId, [...required].join(", "), null, null, null, null, "Review missing narrative sections before publication."));
  }
  return { chunks, claims, aliases, conflicts };
}
function provenanceForDoc(docx: ExtractedDocx, block: DocxBlock): SourceProvenance {
  return { sourceFile: docx.fileName, sourceVersion: 1, sourceFingerprint: docx.fingerprint, sourceSection: block.style, paragraphStart: block.position, paragraphEnd: block.position, rawExtractedValue: block.text, normalisedValue: block.text.trim(), extractedAt: docx.extractedAt, extractorVersion: docx.extractorVersion };
}

function conflict(type: ConflictDraft["type"], entity: string, field: string, sourceA: SourceProvenance | null, sourceB: SourceProvenance | null, valueA: unknown, valueB: unknown, action: string, authorityA = 20, authorityB = 20): ConflictDraft {
  return { id: `conflict_${stableId(type, entity, field, valueA, valueB)}`, type, entity, fieldOrClaim: field, sourceA, sourceB, valueA, valueB, authorityA, authorityB, proposedCanonicalValue: authorityA > authorityB ? valueA : authorityB > authorityA ? valueB : null, automaticResolutionAllowed: false, reviewRequired: true, publicationBlocked: true, recommendedAction: action };
}

function rowsMatching(sheet: WorkbookSheet, column: number, predicate: (value: string) => boolean): number[] {
  const rows: number[] = [];
  for (const [row, cells] of sheet.rows) if (predicate(asString(valueOf(cells.get(column) ?? null)))) rows.push(row);
  return rows;
}

function productId(sourceName: string): string { return normaliseIdentity(sourceName).replace(/\s+/g, "_"); }

function qty(value: unknown): { quantity: number | null; unit: string | null } {
  const text = asString(value);
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*([A-Za-z%µ]+(?:\s*\/\s*[A-Za-z]+)?)?$/);
  return match ? { quantity: Number(match[1]), unit: match[2]?.trim() ?? null } : { quantity: null, unit: text || null };
}

function buildStructured(workbook: ExtractedWorkbook): { facts: StructuredFactDraft[]; mappings: CanonicalProductMapping[]; sourceNames: Map<FiveKitId, string[]>; conflicts: ConflictDraft[] } {
  const facts: StructuredFactDraft[] = [];
  const mappings: CanonicalProductMapping[] = [];
  const conflicts: ConflictDraft[] = [];
  const sourceNames = new Map<FiveKitId, string[]>();
  const kitSheet = workbook.sheets.find((sheet) => sheet.name === "New MRP of kits");
  const productSheet = workbook.sheets.find((sheet) => sheet.name === "Individual products MRP");
  const formulationSheet = workbook.sheets.find((sheet) => sheet.name === "Complete formulation");
  if (!kitSheet || !productSheet || !formulationSheet) throw new Error("Required primary workbook sheets are missing");
  const productRows = new Map<string, number[]>();
  for (const [row, cells] of productSheet.rows) {
    if (row <= 2) continue;
    const name = asString(valueOf(cells.get(1) ?? null));
    if (!name) continue;
    const key = normaliseIdentity(name);
    productRows.set(key, [...(productRows.get(key) ?? []), row]);
  }
  const seenMappings = new Set<string>();
  for (const definition of FIVE_KIT_DEFINITIONS) {
    const candidates = rowsMatching(kitSheet, 1, (value) => definition.workbookCandidate.test(normaliseIdentity(value)));
    const candidateNames = [...new Set(candidates.map((row) => asString(valueOf(cellAt(kitSheet, row, 1)))))];
    sourceNames.set(definition.kitId, candidateNames);
    const exact = definition.workbookExactName ? candidates.filter((row) => normaliseIdentity(asString(valueOf(cellAt(kitSheet, row, 1)))) === normaliseIdentity(definition.workbookExactName!)) : [];
    if (exact.length === 0) {
      conflicts.push(conflict("ALIAS_AMBIGUITY", definition.kitId, "workbook kit identity", candidates[0] ? provenanceForCell(workbook, kitSheet, cellAt(kitSheet, candidates[0], 1)!, candidateNames[0]) : null, null, candidateNames, null, "Select the canonical workbook variant; generic Meta B must not be inferred."));
      continue;
    }
    const exactRows = exact;
    const firstRow = exactRows[0];
    const priceCell = cellAt(kitSheet, firstRow, 11) ?? cellAt(kitSheet, firstRow, 10);
    addFact(facts, workbook, kitSheet, priceCell, "KIT", definition.kitId, "mrp", valueOf(priceCell), priceCell?.formulaError ? "FORMULA_ERROR" : valueOf(priceCell) === null ? "MISSING" : "NONE");
    const totalCell = cellAt(kitSheet, firstRow, 10);
    addFact(facts, workbook, kitSheet, totalCell, "KIT", definition.kitId, "calculatedTotal", valueOf(totalCell), totalCell?.formulaError ? "FORMULA_ERROR" : valueOf(totalCell) === null ? "MISSING" : "NONE");
    for (const [index, row] of exactRows.entries()) {
      const productCell = cellAt(kitSheet, row, 2);
      const sourceName = asString(valueOf(productCell));
      if (!productCell || !sourceName) {
        conflicts.push(conflict("MISSING_LINKED_PRODUCT", definition.kitId, `component row ${row}`, productCell ? provenanceForCell(workbook, kitSheet, productCell, null) : null, null, null, null, "Map the missing component product."));
        continue;
      }
      const masterRows = productRows.get(normaliseIdentity(sourceName)) ?? [];
      const mappingKey = `${definition.kitId}:${normaliseIdentity(sourceName)}`;
      const matchMethod: MatchMethod = masterRows.length === 1 ? "EXACT_NORMALISED" : masterRows.length > 1 ? "AMBIGUOUS_REVIEW_REQUIRED" : "UNMATCHED";
      const id = masterRows.length === 1 ? productId(sourceName) : null;
      if (!seenMappings.has(mappingKey)) {
        mappings.push({ productId: id, canonicalName: id ? sourceName : null, sourceName, aliases: [sourceName], matchMethod, matchConfidence: masterRows.length === 1 ? 1 : 0, reviewStatus: matchMethod === "EXACT_NORMALISED" ? "PENDING_REVIEW" : "CONFLICTED", provenance: provenanceForCell(workbook, kitSheet, productCell, id) });
        seenMappings.add(mappingKey);
      }
      if (!id) {
        conflicts.push(conflict(masterRows.length > 1 ? "DUPLICATE_PRODUCT" : "MISSING_LINKED_PRODUCT", sourceName, "canonical product", provenanceForCell(workbook, kitSheet, productCell, sourceName), null, masterRows, null, "Approve an exact alias or create the missing canonical product."));
        continue;
      }
      const quantityCell = cellAt(kitSheet, row, 3);
      const scheduleCell = cellAt(kitSheet, row, 4);
      addFact(facts, workbook, kitSheet, productCell, "KIT_COMPONENT", `${definition.kitId}:${id}:${index + 1}`, "productId", id, "NONE");
      addFact(facts, workbook, kitSheet, quantityCell ?? productCell, "KIT_COMPONENT", `${definition.kitId}:${id}:${index + 1}`, "quantity", valueOf(quantityCell), valueOf(quantityCell) === null ? "MISSING" : "NONE");
      addFact(facts, workbook, kitSheet, scheduleCell ?? productCell, "KIT_COMPONENT", `${definition.kitId}:${id}:${index + 1}`, "schedule", valueOf(scheduleCell), valueOf(scheduleCell) === null ? "MISSING" : "NONE");
      const masterRow = masterRows[0];
      const priceFields: Array<[string, number]> = [["gstPercent", 2], ["mrp", 3], ["mrpExcludingGst", 4], ["gstAmount", 5], ["previousMrp", 7], ["doctorPrice", 9]];
      for (const [field, column] of priceFields) {
        const cell = cellAt(productSheet, masterRow, column);
        addFact(facts, workbook, productSheet, cell ?? cellAt(productSheet, masterRow, 1), "PRODUCT", id, field, valueOf(cell), cell?.formulaError ? "FORMULA_ERROR" : valueOf(cell) === null ? "MISSING" : "NONE");
      }
      const formulationRows = rowsMatching(formulationSheet, 1, (value) => normaliseIdentity(value) === normaliseIdentity(sourceName));
      for (const formulationRow of formulationRows) {
        const ingredientCell = cellAt(formulationSheet, formulationRow, 2);
        const quantitySource = cellAt(formulationSheet, formulationRow, 3);
        const routeCell = cellAt(formulationSheet, formulationRow, 4);
        const ingredientName = asString(valueOf(ingredientCell));
        if (!ingredientCell || !ingredientName) continue;
        const parsed = qty(valueOf(quantitySource));
        const formulationId = `${id}:${normaliseIdentity(ingredientName).replace(/\s+/g, "_")}`;
        addFact(facts, workbook, formulationSheet, ingredientCell, "PRODUCT_FORMULATION", formulationId, "ingredientName", ingredientName, "NONE");
        addFact(facts, workbook, formulationSheet, quantitySource ?? ingredientCell, "PRODUCT_FORMULATION", formulationId, "quantity", parsed.quantity, parsed.quantity === null ? "MISSING" : "NONE");
        addFact(facts, workbook, formulationSheet, quantitySource ?? ingredientCell, "PRODUCT_FORMULATION", formulationId, "unit", parsed.unit, parsed.unit === null ? "MISSING" : "NONE");
        addFact(facts, workbook, formulationSheet, routeCell ?? ingredientCell, "PRODUCT_FORMULATION", formulationId, "route", valueOf(routeCell), valueOf(routeCell) === null ? "MISSING" : "NONE");
        if (parsed.quantity === null) conflicts.push(conflict("MISSING_QUANTITY", formulationId, "quantity", provenanceForCell(workbook, formulationSheet, quantitySource ?? ingredientCell, parsed.quantity), null, valueOf(quantitySource), null, "Product reviewer must enter or confirm the ingredient quantity."));
      }
    }
  }
  for (const sheet of workbook.sheets.filter((item) => !item.authoritativeCandidate && /copy of new mrp of kits/i.test(item.name))) {
    for (const definition of FIVE_KIT_DEFINITIONS.filter((item) => item.workbookExactName)) {
      const primaryRows = rowsMatching(kitSheet, 1, (value) => normaliseIdentity(value) === normaliseIdentity(definition.workbookExactName!));
      const copyRows = rowsMatching(sheet, 1, (value) => normaliseIdentity(value) === normaliseIdentity(definition.workbookExactName!));
      if (!primaryRows.length || !copyRows.length) continue;
      const a = valueOf(cellAt(kitSheet, primaryRows[0], 11) ?? cellAt(kitSheet, primaryRows[0], 10));
      const b = valueOf(cellAt(sheet, copyRows[0], 11) ?? cellAt(sheet, copyRows[0], 10));
      if (a !== b) conflicts.push(conflict("CONFLICTING_MRP", definition.kitId, "mrp", provenanceForCell(workbook, kitSheet, (cellAt(kitSheet, primaryRows[0], 11) ?? cellAt(kitSheet, primaryRows[0], 10))!, a), provenanceForCell(workbook, sheet, (cellAt(sheet, copyRows[0], 11) ?? cellAt(sheet, copyRows[0], 10))!, b), a, b, "Commercial reviewer must confirm the authoritative MRP.", 90, 20));
    }
  }
  return { facts, mappings, sourceNames, conflicts };
}

function addFact(facts: StructuredFactDraft[], workbook: ExtractedWorkbook, sheet: WorkbookSheet, cell: WorkbookCell | null, entityType: StructuredFactDraft["entityType"], entityId: string, field: string, value: unknown, conflictStatus: StructuredFactDraft["conflictStatus"]): void {
  if (!cell) return;
  facts.push({ id: `fact_${stableId(entityType, entityId, field, sheet.name, cell.address)}`, entityType, entityId, field, value, approvalStatus: conflictStatus === "NONE" ? "DRAFT" : conflictStatus === "MISSING" ? "INCOMPLETE" : "CONFLICTED", conflictStatus, publicationBlocked: true, requiresReview: true, provenance: provenanceForCell(workbook, sheet, cell, value) });
}

export function buildFiveKitDraftManifest(workbook: ExtractedWorkbook, docx: ExtractedDocx): FiveKitDraftManifest {
  const knowledge = buildKnowledge(docx);
  const structured = buildStructured(workbook);
  const conflicts = [...knowledge.conflicts, ...structured.conflicts];
  const kits = FIVE_KIT_DEFINITIONS.map((definition): CanonicalKitDraft => {
    const sourceNames = structured.sourceNames.get(definition.kitId) ?? [];
    const aliases = [...new Set([...(knowledge.aliases.get(definition.kitId) ?? []), ...sourceNames])];
    const kitConflicts = conflicts.filter((item) => item.entity === definition.kitId);
    return { kitId: definition.kitId, canonicalName: definition.canonicalName, aliases, sourceNames, domain: "HAIR", status: kitConflicts.length ? "CONFLICTED" : "DRAFT", medicalVersion: 1, commercialVersion: 1, approvalStatus: "DRAFT", requiresReview: true };
  });
  const missingValues = structured.facts.filter((fact) => fact.conflictStatus === "MISSING").length;
  const formulaErrors = structured.facts.filter((fact) => fact.conflictStatus === "FORMULA_ERROR").length;
  return {
    generatedAt: new Date().toISOString(), extractorVersion: workbook.extractorVersion,
    sourceFiles: [{ fileName: workbook.fileName, fingerprint: workbook.fingerprint, version: 1 }, { fileName: docx.fileName, fingerprint: docx.fingerprint, version: 1 }],
    kits, productMappings: structured.mappings, structuredFacts: structured.facts, chunks: knowledge.chunks, claims: knowledge.claims, conflicts,
    counts: {
      kits: kits.length,
      products: new Set(structured.mappings.map((item) => item.productId).filter(Boolean)).size,
      aliases: kits.reduce((sum, kit) => sum + kit.aliases.length, 0) + structured.mappings.reduce((sum, item) => sum + item.aliases.length, 0),
      prices: structured.facts.filter((fact) => fact.field === "mrp").length,
      components: structured.facts.filter((fact) => fact.entityType === "KIT_COMPONENT" && fact.field === "productId").length,
      formulationRows: new Set(structured.facts.filter((fact) => fact.entityType === "PRODUCT_FORMULATION").map((fact) => fact.entityId)).size,
      chunks: knowledge.chunks.length,
      claims: knowledge.claims.length,
      claimsBlocked: knowledge.claims.filter((claim) => !claim.patientVisible).length,
      conflicts: conflicts.length,
      missingValues,
      formulaErrors,
      exactMatches: structured.mappings.filter((item) => item.matchMethod === "EXACT_NORMALISED").length,
      ambiguousMatches: structured.mappings.filter((item) => item.matchMethod === "AMBIGUOUS_REVIEW_REQUIRED").length,
      unmatchedProducts: structured.mappings.filter((item) => item.matchMethod === "UNMATCHED").length,
    },
    publicationStatus: "DRAFT", productionPublished: false,
  };
}

export function assertDraftOnly(manifest: FiveKitDraftManifest): void {
  if (manifest.productionPublished || manifest.publicationStatus !== "DRAFT") throw new Error("Real source records must remain draft");
  if (manifest.structuredFacts.some((fact) => !fact.publicationBlocked)) throw new Error("Imported structured facts must be publication blocked");
  if (manifest.claims.some((claim) => claim.approvalStatus !== "DRAFT" || claim.patientVisible)) throw new Error("Imported claims must be draft and non-patient-visible");
}

export type ReconciledFact = { status: "ANSWER"; value: unknown; source: SourceProvenance; staleNarrativeClaimIds: string[] } | { status: "REFUSE_CONFLICT"; reason: string } | { status: "NO_APPROVED_FACT"; reason: string };

export function reconcileExactFact(input: { structured: StructuredFactDraft[]; narrativeClaims: KnowledgeClaimDraft[]; now?: Date }): ReconciledFact {
  const approved = input.structured.filter((fact) => fact.approvalStatus === "APPROVED" || fact.approvalStatus === "PUBLISHED").filter((fact) => !fact.publicationBlocked && fact.conflictStatus === "NONE");
  if (!approved.length) return { status: "NO_APPROVED_FACT", reason: "No approved active structured fact is available." };
  const distinct = new Map(approved.map((fact) => [JSON.stringify(fact.value), fact]));
  if (distinct.size > 1) return { status: "REFUSE_CONFLICT", reason: "Equally authoritative approved records conflict; review is required." };
  const winner = approved[0];
  const staleNarrativeClaimIds = input.narrativeClaims.filter((claim) => claim.claimType === "COMMERCIAL_FACT" && !claim.claimText.includes(String(winner.value))).map((claim) => claim.claimId);
  return { status: "ANSWER", value: winner.value, source: winner.provenance, staleNarrativeClaimIds };
}






