export const KNOWLEDGE_PUBLICATION_STATUSES = [
  "DRAFT",
  "MEDICAL_REVIEW",
  "MEDICAL_APPROVED",
  "COMMERCIAL_APPROVED",
  "PUBLISHED_INTERNAL",
  "PUBLISHED_PATIENT",
  "RETIRED",
] as const;

export type KnowledgePublicationStatus = (typeof KNOWLEDGE_PUBLICATION_STATUSES)[number];

const NEXT: Record<KnowledgePublicationStatus, readonly KnowledgePublicationStatus[]> = {
  DRAFT: ["MEDICAL_REVIEW"],
  MEDICAL_REVIEW: ["DRAFT", "MEDICAL_APPROVED"],
  MEDICAL_APPROVED: ["MEDICAL_REVIEW", "COMMERCIAL_APPROVED"],
  COMMERCIAL_APPROVED: ["MEDICAL_APPROVED", "PUBLISHED_INTERNAL"],
  PUBLISHED_INTERNAL: ["COMMERCIAL_APPROVED", "PUBLISHED_PATIENT", "RETIRED"],
  PUBLISHED_PATIENT: ["PUBLISHED_INTERNAL", "RETIRED"],
  RETIRED: [],
};

export function canTransitionKnowledgeStatus(from: KnowledgePublicationStatus, to: KnowledgePublicationStatus): boolean {
  return NEXT[from].includes(to);
}

export function isKnowledgeRetrievable(status: KnowledgePublicationStatus, audience: "INTERNAL" | "PATIENT"): boolean {
  return audience === "PATIENT"
    ? status === "PUBLISHED_PATIENT"
    : status === "PUBLISHED_INTERNAL" || status === "PUBLISHED_PATIENT";
}

export function assertKnowledgeTransition(from: KnowledgePublicationStatus, to: KnowledgePublicationStatus): void {
  if (!canTransitionKnowledgeStatus(from, to)) throw new Error(`Invalid knowledge publication transition: ${from} -> ${to}`);
}
