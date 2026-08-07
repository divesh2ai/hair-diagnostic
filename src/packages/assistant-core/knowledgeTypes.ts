import type { KnowledgePublicationStatus } from "./knowledgeStatus";
import type { PlatformDomain } from "./domainConfig";

export const HAIR_TOPICS = ["HAIR_BIOLOGY", "HAIR_CONDITION", "SCALP_CONDITION", "TOPICAL", "INGREDIENT", "LIFESTYLE", "SAFETY"] as const;
export type HairKnowledgeTopic = (typeof HAIR_TOPICS)[number];
export type KnowledgeSystem = "MODERN_DERMATOLOGY" | "TRICHOLOGY" | "NUTRITION_LIFESTYLE";
export type KnowledgeTaxonomyDomain = "CONDITION" | "SYMPTOM" | "LIFESTYLE_FACTOR" | "KIT" | "KIT_VARIANT" | "INGREDIENT" | "SAFETY" | "FAQ";
export type KnowledgeContentType = "OVERVIEW" | "INDICATION" | "TREATMENT_OBJECTIVE" | "PATIENT_FACTOR" | "SYMPTOM_CONDITION" | "THERAPEUTIC_PATHWAY" | "INGREDIENT_LIST" | "INGREDIENT_ROLE" | "FORMULATION_RATIONALE" | "VARIANT" | "COMPARISON_NOTE" | "DOCTOR_EXPLANATION" | "PATIENT_EXPLANATION" | "SAFETY_NOTE" | "CONDITION_EXPLANATION" | "LIFESTYLE_IMPACT" | "FAQ";
export const KNOWLEDGE_SOURCE_TYPES = ["PRODUCT_MASTER", "SAFETY_MASTER", "CLINICAL_PROTOCOL", "SCIENTIFIC_EVIDENCE", "PATIENT_EDUCATION", "PRODUCT_BROCHURE", "COMMERCIAL_PRICE_SOURCE", "INTERNAL_DRAFT"] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];
export const KNOWLEDGE_CLAIM_TYPES = ["MEDICAL_MECHANISM", "EXPECTED_OUTCOME", "USAGE", "SAFETY_WORDING", "PRODUCT_COMPOSITION", "COMMERCIAL_PRICE", "GENERAL_EDUCATION"] as const;
export type KnowledgeClaimType = (typeof KNOWLEDGE_CLAIM_TYPES)[number];

export type GovernedClaim = {
  claimId: string;
  claimType: KnowledgeClaimType;
  statement: string;
  evidenceStatus: "SUPPORTED" | "LIMITED" | "CONFLICTING" | "INSUFFICIENT";
  approvalStatus: KnowledgePublicationStatus;
  audience: "INTERNAL" | "DOCTOR" | "PATIENT";
  effectiveFrom: string;
  effectiveUntil?: string;
  contradictionGroup?: string;
  supersededByClaimId?: string;
};

export type GeneralKnowledgeEntry = {
  id: string;
  title: string;
  domain: PlatformDomain;
  topic: HairKnowledgeTopic;
  knowledgeSystem: KnowledgeSystem;
  language: "en";
  content: string;
  keywords: string[];
  approvalStatus: KnowledgePublicationStatus;
  authorityScore: number;
  sourceType: KnowledgeSourceType;
  sourceStatus: "ACTIVE" | "SUPERSEDED" | "RETIRED";
  sourceLabel: string;
  sourceUrl: string;
  sourceVersion: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  metadata?: {
    taxonomyDomain?: KnowledgeTaxonomyDomain;
    canonicalEntity?: string;
    aliases?: string[];
    audience?: Array<"INTERNAL" | "DOCTOR" | "PATIENT">;
    contentType?: KnowledgeContentType;
    productFamily?: string;
    variant?: string;
    sourceDocument?: string;
    sourceSection?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    missingInformation?: string[];
    conflictingInformation?: string[];
  };
  claims: GovernedClaim[];
};