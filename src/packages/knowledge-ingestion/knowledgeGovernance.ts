import type { PlatformDomain } from "../assistant-core/domainConfig";

export const KNOWLEDGE_SOURCE_TYPES = [
  "PRODUCT_MASTER",
  "SAFETY_MASTER",
  "CLINICAL_PROTOCOL",
  "SCIENTIFIC_EVIDENCE",
  "PATIENT_EDUCATION",
  "PRODUCT_BROCHURE",
  "COMMERCIAL_PRICE_SOURCE",
  "INTERNAL_DRAFT",
] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_CLAIM_TYPES = [
  "MEDICAL_MECHANISM",
  "EXPECTED_OUTCOME",
  "USAGE",
  "SAFETY_WORDING",
  "PRODUCT_COMPOSITION",
  "COMMERCIAL_PRICE",
  "GENERAL_EDUCATION",
] as const;
export type KnowledgeClaimType = (typeof KNOWLEDGE_CLAIM_TYPES)[number];

export type EvidenceStatus = "UNASSESSED" | "SUPPORTED" | "LIMITED" | "CONFLICTING" | "REJECTED";
export type ClaimAudience = "INTERNAL" | "DOCTOR" | "PATIENT" | "DOCTOR_AND_PATIENT";

export const SOURCE_AUTHORITY: Record<KnowledgeSourceType, number> = {
  PRODUCT_MASTER: 100,
  SAFETY_MASTER: 100,
  CLINICAL_PROTOCOL: 95,
  SCIENTIFIC_EVIDENCE: 90,
  COMMERCIAL_PRICE_SOURCE: 90,
  PATIENT_EDUCATION: 75,
  PRODUCT_BROCHURE: 45,
  INTERNAL_DRAFT: 20,
};

const PROTECTED_FROM_BROCHURES = new Set<KnowledgeSourceType>([
  "PRODUCT_MASTER",
  "SAFETY_MASTER",
  "CLINICAL_PROTOCOL",
  "SCIENTIFIC_EVIDENCE",
]);

export function canSourceOverride(incoming: KnowledgeSourceType, existing: KnowledgeSourceType, claimType: KnowledgeClaimType): boolean {
  if (incoming === "PRODUCT_BROCHURE" && PROTECTED_FROM_BROCHURES.has(existing)) return false;
  if (claimType === "PRODUCT_COMPOSITION" && existing === "PRODUCT_MASTER" && incoming !== "PRODUCT_MASTER") return false;
  if (claimType === "SAFETY_WORDING" && existing === "SAFETY_MASTER" && incoming !== "SAFETY_MASTER") return false;
  if (claimType === "COMMERCIAL_PRICE" && incoming !== "COMMERCIAL_PRICE_SOURCE" && incoming !== "PRODUCT_MASTER") return false;
  return SOURCE_AUTHORITY[incoming] > SOURCE_AUTHORITY[existing];
}

export type GovernedClaimDraft = {
  claimId: string;
  domain: PlatformDomain;
  subject: string;
  subjectType: string;
  subjectId?: string;
  claimType: KnowledgeClaimType;
  statement: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  authorityScore: number;
  evidenceStatus: EvidenceStatus;
  approvalStatus: "DRAFT" | "MEDICAL_REVIEW" | "MEDICAL_APPROVED" | "COMMERCIAL_APPROVED" | "PUBLISHED_INTERNAL" | "PUBLISHED_PATIENT" | "RETIRED";
  audience: ClaimAudience;
  effectiveFrom?: string;
  effectiveUntil?: string;
  contradictionGroup?: string;
  supersededByClaimId?: string;
};

export function requiredApprovals(claimType: KnowledgeClaimType): Array<"MEDICAL_APPROVED" | "COMMERCIAL_APPROVED"> {
  if (claimType === "COMMERCIAL_PRICE" || claimType === "PRODUCT_COMPOSITION") return ["COMMERCIAL_APPROVED"];
  if (["MEDICAL_MECHANISM", "EXPECTED_OUTCOME", "USAGE", "SAFETY_WORDING"].includes(claimType)) return ["MEDICAL_APPROVED"];
  return ["MEDICAL_APPROVED"];
}
