import { createHash } from "node:crypto";
import { ACTIVE_ASSISTANT_DOMAIN, detectRequestedDomain, type PlatformDomain } from "../assistant-core/domainConfig";
import { SOURCE_AUTHORITY, requiredApprovals, type GovernedClaimDraft, type KnowledgeSourceType } from "./knowledgeGovernance";

export const SUPPORTED_DOCUMENT_TYPES = ["PDF", "DOCX", "SPREADSHEET", "SCIENTIFIC_DOCUMENT", "BROCHURE"] as const;
export type SupportedDocumentType = (typeof SUPPORTED_DOCUMENT_TYPES)[number];

export type IngestionFile = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  logicalDocumentKey: string;
  declaredSourceType?: KnowledgeSourceType;
};

export type ExtractedSection = { heading: string; text: string; page?: number; table?: Array<Record<string, unknown>>; imageText?: string[] };
export type ExtractedDocument = { title: string; sections: ExtractedSection[]; metadata: Record<string, unknown> };
export type ExtractedEntity = { entityType: "PRODUCT" | "KIT" | "CONDITION" | "INGREDIENT" | "TOPICAL"; name: string; canonicalId?: string; aliases?: string[] };
export type StructuredFact = { entityType: string; entityId?: string; field: string; value: unknown; sourceSection: string };
export type SectionChunk = { id: string; heading: string; content: string; page?: number; hash: string; topic: string };
export type ContradictionFinding = { group: string; claimIds: string[]; severity: "LOW" | "MEDIUM" | "HIGH"; reason: string };

export interface DocumentExtractor {
  extract(file: IngestionFile, documentType: SupportedDocumentType): Promise<ExtractedDocument>;
}
export interface EntityExtractionPort { extract(document: ExtractedDocument, chunks: SectionChunk[]): Promise<ExtractedEntity[]>; }
export interface StructuredExtractionPort { extract(document: ExtractedDocument, entities: ExtractedEntity[]): Promise<StructuredFact[]>; }
export interface ClaimExtractionPort { extract(input: { document: ExtractedDocument; chunks: SectionChunk[]; entities: ExtractedEntity[]; sourceId: string; sourceType: KnowledgeSourceType }): Promise<GovernedClaimDraft[]>; }
export interface ContradictionDetectionPort { detect(claims: GovernedClaimDraft[], existingClaims: GovernedClaimDraft[]): Promise<ContradictionFinding[]>; }

export type StoredSource = { id: string; fingerprint: string; logicalDocumentKey: string; version: number; domain: PlatformDomain; sourceType: KnowledgeSourceType; lifecycleStatus: "ACTIVE" | "SUPERSEDED" | "INACTIVE" };
export interface IngestionRepository {
  findByFingerprint(fingerprint: string): Promise<StoredSource | null>;
  findLatest(logicalDocumentKey: string): Promise<StoredSource | null>;
  getSectionHashes(sourceId: string): Promise<Set<string>>;
  getActiveClaims(domain: PlatformDomain, subjects: string[]): Promise<GovernedClaimDraft[]>;
  saveDraft(input: GovernedIngestionDraft): Promise<void>;
}

export type GovernedIngestionDraft = {
  source: StoredSource & { supersedesSourceId?: string; fileName: string; mimeType: string; documentType: SupportedDocumentType; authorityScore: number };
  chunks: SectionChunk[];
  entities: ExtractedEntity[];
  structuredFacts: StructuredFact[];
  claims: GovernedClaimDraft[];
  contradictions: ContradictionFinding[];
  requiredReview: Array<"MEDICAL_APPROVED" | "COMMERCIAL_APPROVED">;
  publicationStatus: "DRAFT";
  embeddingStatus: "BLOCKED_PENDING_APPROVAL";
};

export type IngestionOutcome =
  | { status: "DUPLICATE"; fingerprint: string; sourceId: string }
  | { status: "REJECTED_OUT_OF_SCOPE"; fingerprint: string; detectedDomain: PlatformDomain }
  | { status: "AWAITING_REVIEW"; fingerprint: string; sourceId: string; version: number; changedChunks: number; contradictions: number };

export function fingerprintFile(file: IngestionFile): string {
  return createHash("sha256").update(file.bytes).digest("hex");
}

export function classifyDocumentType(file: Pick<IngestionFile, "fileName" | "mimeType">): SupportedDocumentType {
  const lower = file.fileName.toLowerCase();
  if (file.mimeType === "application/pdf" || lower.endsWith(".pdf")) return /brochure|leaflet|catalog/.test(lower) ? "BROCHURE" : "PDF";
  if (file.mimeType.includes("wordprocessingml") || lower.endsWith(".docx")) return "DOCX";
  if (file.mimeType.includes("spreadsheet") || /\.(xlsx|xls|csv|tsv)$/.test(lower)) return "SPREADSHEET";
  if (/paper|study|journal|evidence|trial/.test(lower)) return "SCIENTIFIC_DOCUMENT";
  throw new Error(`Unsupported knowledge file type: ${file.fileName}`);
}

export function classifyKnowledgeDomain(file: IngestionFile, extracted?: ExtractedDocument): PlatformDomain {
  const sample = `${file.fileName} ${extracted?.title ?? ""} ${extracted?.sections.slice(0, 8).map((section) => `${section.heading} ${section.text}`).join(" ") ?? ""}`;
  return detectRequestedDomain(sample);
}

function topicFor(section: ExtractedSection): string {
  const text = `${section.heading} ${section.text}`.toLowerCase();
  if (/safety|warning|contraindication|adverse|red flag/.test(text)) return "SAFETY";
  if (/ingredient|composition|formulation/.test(text)) return "INGREDIENT";
  if (/price|mrp|commercial/.test(text)) return "COMMERCIAL";
  if (/topical|shampoo|serum|minoxidil/.test(text)) return "TOPICAL";
  if (/nutrition|diet|iron|protein|vitamin|lifestyle/.test(text)) return "LIFESTYLE";
  if (/scalp|dandruff|inflammation/.test(text)) return "SCALP_CONDITION";
  if (/cycle|follicle|anagen|catagen|telogen/.test(text)) return "HAIR_BIOLOGY";
  return "HAIR_CONDITION";
}

export function sectionAwareChunks(sourceId: string, document: ExtractedDocument, maxCharacters = 1400, overlap = 160): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  for (const section of document.sections) {
    const tableText = section.table?.length ? `\nTABLE:\n${JSON.stringify(section.table)}` : "";
    const imageText = section.imageText?.length ? `\nIMAGE TEXT:\n${section.imageText.join("\n")}` : "";
    const content = `${section.text}${tableText}${imageText}`.trim();
    if (!content) continue;
    let offset = 0; let part = 0;
    while (offset < content.length) {
      const slice = content.slice(offset, offset + maxCharacters);
      const hash = createHash("sha256").update(`${section.heading}\n${slice}`).digest("hex");
      chunks.push({ id: `${sourceId}:${hash.slice(0, 20)}`, heading: section.heading, content: slice, page: section.page, hash, topic: topicFor(section) });
      if (offset + maxCharacters >= content.length) break;
      offset += Math.max(1, maxCharacters - overlap); part += 1;
      if (part > 10000) throw new Error("Chunking safety limit exceeded");
    }
  }
  return chunks;
}

export class AdvancedKnowledgeIngestionPipeline {
  constructor(
    private readonly repository: IngestionRepository,
    private readonly extractor: DocumentExtractor,
    private readonly entityExtractor: EntityExtractionPort,
    private readonly structuredExtractor: StructuredExtractionPort,
    private readonly claimExtractor: ClaimExtractionPort,
    private readonly contradictionDetector: ContradictionDetectionPort,
  ) {}

  async ingest(file: IngestionFile): Promise<IngestionOutcome> {
    const fingerprint = fingerprintFile(file);
    const duplicate = await this.repository.findByFingerprint(fingerprint);
    if (duplicate) return { status: "DUPLICATE", fingerprint, sourceId: duplicate.id };
    const documentType = classifyDocumentType(file);
    const document = await this.extractor.extract(file, documentType);
    const domain = classifyKnowledgeDomain(file, document);
    if (domain !== ACTIVE_ASSISTANT_DOMAIN) return { status: "REJECTED_OUT_OF_SCOPE", fingerprint, detectedDomain: domain };

    const prior = await this.repository.findLatest(file.logicalDocumentKey);
    const sourceType = file.declaredSourceType ?? (documentType === "BROCHURE" ? "PRODUCT_BROCHURE" : documentType === "SCIENTIFIC_DOCUMENT" ? "SCIENTIFIC_EVIDENCE" : "INTERNAL_DRAFT");
    const sourceId = createHash("sha256").update(`${file.logicalDocumentKey}:${fingerprint}`).digest("hex").slice(0, 32);
    const allChunks = sectionAwareChunks(sourceId, document);
    const priorHashes = prior ? await this.repository.getSectionHashes(prior.id) : new Set<string>();
    const chunks = allChunks.filter((chunk) => !priorHashes.has(chunk.hash));
    const entities = await this.entityExtractor.extract(document, chunks);
    const structuredFacts = await this.structuredExtractor.extract(document, entities);
    const extractedClaims = await this.claimExtractor.extract({ document, chunks, entities, sourceId, sourceType });
    const claims = extractedClaims.map((claim) => ({ ...claim, domain: ACTIVE_ASSISTANT_DOMAIN, sourceType, sourceId, authorityScore: SOURCE_AUTHORITY[sourceType], approvalStatus: "DRAFT" as const }));
    const existingClaims = await this.repository.getActiveClaims(ACTIVE_ASSISTANT_DOMAIN, [...new Set(claims.map((claim) => claim.subject))]);
    const contradictions = await this.contradictionDetector.detect(claims, existingClaims);
    const requiredReview = [...new Set(claims.flatMap((claim) => requiredApprovals(claim.claimType)))];
    const version = (prior?.version ?? 0) + 1;
    await this.repository.saveDraft({
      source: { id: sourceId, fingerprint, logicalDocumentKey: file.logicalDocumentKey, version, domain, sourceType, lifecycleStatus: "ACTIVE", supersedesSourceId: prior?.id, fileName: file.fileName, mimeType: file.mimeType, documentType, authorityScore: SOURCE_AUTHORITY[sourceType] },
      chunks, entities, structuredFacts, claims, contradictions, requiredReview, publicationStatus: "DRAFT", embeddingStatus: "BLOCKED_PENDING_APPROVAL",
    });
    return { status: "AWAITING_REVIEW", fingerprint, sourceId, version, changedChunks: chunks.length, contradictions: contradictions.length };
  }

  async ingestBatch(files: IngestionFile[], concurrency = 4): Promise<IngestionOutcome[]> {
    const results: IngestionOutcome[] = new Array(files.length); let cursor = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, 16)) }, async () => {
      while (cursor < files.length) { const index = cursor; cursor += 1; results[index] = await this.ingest(files[index]); }
    });
    await Promise.all(workers); return results;
  }
}

export function assertReadyForPublication(draft: GovernedIngestionDraft, approvals: Set<string>): void {
  if (draft.source.domain !== ACTIVE_ASSISTANT_DOMAIN) throw new Error("Only Hair knowledge can be published in the current phase");
  if (draft.contradictions.some((finding) => finding.severity === "HIGH")) throw new Error("High-severity contradictions must be resolved before publication");
  for (const required of draft.requiredReview) if (!approvals.has(required)) throw new Error(`${required} is required before publication and embedding`);
}
