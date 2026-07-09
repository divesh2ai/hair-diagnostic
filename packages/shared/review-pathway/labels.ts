import type { ReviewPathwayReasonCode } from "./types";

export const REVIEW_PATHWAY_DISPLAY_LABELS = Object.freeze({
  RESOLUTION_ASSESSMENT_FAILED: "Assessment failed",
  RESOLUTION_PARTIAL_FAILURE: "Assessment partial failure",
  RESOLUTION_GROUNDING_VIOLATION: "Grounding violation",
  RESOLUTION_REASONING_GAP: "Reasoning gap",
  RESOLUTION_READINESS_SNAPSHOT_MALFORMED: "Readiness snapshot malformed",
  RESOLUTION_APPROVAL_BLOCKED: "Explicit approval blocker",
  EXAM_PATCHY_HAIR_LOSS: "Circular or coin-sized bald patches",
  EXAM_ALOPECIA_AREATA_REPORTED: "Self-reported alopecia areata",
  EXAM_SCALP_BOILS_OR_PUSTULES: "Scalp boils or pustules",
  FOCUSED_PREGNANCY: "Pregnancy",
  FOCUSED_POSTPARTUM_OR_BREASTFEEDING: "Postpartum or breastfeeding",
  FOCUSED_HEAVY_BLEEDING_WITH_IRON_INDICATORS: "Heavy bleeding with iron indicators",
  FOCUSED_RAPID_WEIGHT_LOSS_TREATMENT_IMPACT: "Rapid weight loss with treatment impact",
  FOCUSED_GLP1_TREATMENT_IMPACT: "GLP-1 use with treatment impact",
} as const satisfies Record<ReviewPathwayReasonCode, string>);

export const REVIEW_PATHWAY_QUESTIONNAIRE_LABELS = Object.freeze({
  FOCUSED_PREGNANCY: ["Currently pregnant"],
  FOCUSED_POSTPARTUM_OR_BREASTFEEDING: [
    "Post partum — still feeding",
    "Post partum — not feeding",
    "Post-delivery or breastfeeding",
  ],
  FOCUSED_HEAVY_BLEEDING_WITH_IRON_INDICATORS: ["Heavy bleeding periods"],
  FOCUSED_RAPID_WEIGHT_LOSS_TREATMENT_IMPACT: ["Rapid weight loss / Crash diet"],
  FOCUSED_GLP1_TREATMENT_IMPACT: [
    "Post GLP-1 receptor agonist (hair loss within 6 months)",
    "Post GLP-1 receptor agonist (hair loss after 6 months)",
  ],
  EXAM_PATCHY_HAIR_LOSS: ["Circular bald patches / Coin-sized bald spots"],
  EXAM_ALOPECIA_AREATA_REPORTED: ["Alopecia Areata (circular patches)"],
  EXAM_SCALP_BOILS_OR_PUSTULES: ["Boils or pimples"],
} as const satisfies Partial<Record<ReviewPathwayReasonCode, readonly string[]>>);

