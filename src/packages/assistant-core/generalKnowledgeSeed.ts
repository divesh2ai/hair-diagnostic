import type { GeneralKnowledgeEntry, HairKnowledgeTopic, KnowledgeSystem } from "./knowledgeTypes";
import { FIVE_KIT_CONTROLLED_KNOWLEDGE } from "./fiveKitKnowledge";

export type KnowledgeDomain = HairKnowledgeTopic;
export type { GeneralKnowledgeEntry, KnowledgeSystem } from "./knowledgeTypes";

type SeedEntry = Omit<GeneralKnowledgeEntry, "domain" | "topic" | "sourceType" | "sourceStatus" | "claims"> & { topic: HairKnowledgeTopic };

const HAIR_SEED: SeedEntry[] = [
  {
    id: "AAD_HAIR_LOSS_CAUSES_V1", title: "Hair loss has multiple causes", topic: "HAIR_CONDITION", knowledgeSystem: "MODERN_DERMATOLOGY", language: "en",
    content: "Hair loss is not one diagnosis. Hereditary pattern loss, excessive shedding after physical or emotional stress, autoimmune alopecia areata, medicines, illness, tight hairstyles, scalp infection and damaging hair practices can produce different patterns. A clinician may need history, scalp examination and selected tests to distinguish them.",
    keywords: ["hair loss", "causes", "androgenetic alopecia", "pattern hair loss", "diagnosis"], approvalStatus: "PUBLISHED_PATIENT", authorityScore: 100,
    sourceLabel: "American Academy of Dermatology - Hair loss causes", sourceUrl: "https://www.aad.org/public/diseases/hair-loss/causes/18-causes", sourceVersion: "accessed-2026-07-18", effectiveFrom: "2026-07-18",
  },
  {
    id: "AAD_SHEDDING_VS_LOSS_V1", title: "Hair shedding versus hair loss", topic: "HAIR_BIOLOGY", knowledgeSystem: "MODERN_DERMATOLOGY", language: "en",
    content: "Excessive shedding and progressive hair loss are different patterns. Telogen effluvium commonly appears a few months after a major stressor such as childbirth, fever, surgery, illness, marked weight loss or sustained stress. Persistent thinning, patchy loss, scarring, pain or inflammation needs assessment because another cause may be present.",
    keywords: ["telogen effluvium", "shedding", "stress", "postpartum", "hair cycle"], approvalStatus: "PUBLISHED_PATIENT", authorityScore: 100,
    sourceLabel: "American Academy of Dermatology - Hair shedding", sourceUrl: "https://www.aad.org/public/diseases/hair-loss/insider/shedding", sourceVersion: "accessed-2026-07-18", effectiveFrom: "2026-07-18",
  },
  {
    id: "AAD_PATTERN_LOSS_V1", title: "Pattern hair loss", topic: "HAIR_CONDITION", knowledgeSystem: "MODERN_DERMATOLOGY", language: "en",
    content: "Hereditary pattern hair loss can affect men and women. Follicles gradually shrink, so hairs become finer and growth can eventually stop. Men often notice a receding hairline or crown thinning; women often notice diffuse thinning or a widening part. Similar-looking loss can have other causes, so this description is educational rather than diagnostic.",
    keywords: ["male pattern", "female pattern", "androgenetic alopecia", "DHT", "crown", "widening part"], approvalStatus: "PUBLISHED_PATIENT", authorityScore: 100,
    sourceLabel: "American Academy of Dermatology - Hair loss causes", sourceUrl: "https://www.aad.org/public/diseases/hair-loss/causes/18-causes", sourceVersion: "accessed-2026-07-18", effectiveFrom: "2026-07-18",
  },
  {
    id: "AAD_ALOPECIA_AREATA_V1", title: "Alopecia areata", topic: "HAIR_CONDITION", knowledgeSystem: "MODERN_DERMATOLOGY", language: "en",
    content: "Alopecia areata is an autoimmune disease in which the immune system attacks hair follicles. It often causes rapidly appearing round or oval patches and can affect scalp, brows, lashes or body hair. Patchy loss should be professionally assessed; treatment and outlook vary with age, extent, duration and associated health factors.",
    keywords: ["alopecia areata", "patchy hair loss", "autoimmune", "bald patches"], approvalStatus: "PUBLISHED_PATIENT", authorityScore: 100,
    sourceLabel: "American Academy of Dermatology - Alopecia areata", sourceUrl: "https://www.aad.org/public/diseases/hair-loss/types/alopecia/causes", sourceVersion: "accessed-2026-07-18", effectiveFrom: "2026-07-18",
  },
  {
    id: "AAD_HEALTHY_HAIR_CARE_V1", title: "Healthy hair care", topic: "LIFESTYLE", knowledgeSystem: "NUTRITION_LIFESTYLE", language: "en",
    content: "Hair-care needs vary by hair and scalp type. General measures include cleansing the scalp according to oil and buildup, conditioning appropriately, detangling gently, avoiding rough towel friction, and limiting excessive heat. Persistent flakes, itching, pain, sores or shedding should not be managed only as a cosmetic issue.",
    keywords: ["hair care", "washing", "shampoo", "conditioner", "heat", "breakage", "lifestyle", "dandruff"], approvalStatus: "PUBLISHED_PATIENT", authorityScore: 100,
    sourceLabel: "American Academy of Dermatology - Healthy hair tips", sourceUrl: "https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips", sourceVersion: "accessed-2026-07-18", effectiveFrom: "2026-07-18",
  },
  {
    id: "HAIROS_NUTRITION_GENERAL_V1", title: "Nutrition and hair", topic: "LIFESTYLE", knowledgeSystem: "NUTRITION_LIFESTYLE", language: "en",
    content: "Hair growth depends on adequate energy, protein and micronutrient availability, but supplements are not automatically helpful when no deficiency exists. Rapid weight loss, restrictive diets and deficiencies such as iron deficiency can contribute to shedding. Persistent shedding warrants assessment rather than high-dose self-supplementation.",
    keywords: ["nutrition", "protein", "iron", "vitamin", "diet", "weight loss", "supplements"], approvalStatus: "PUBLISHED_PATIENT", authorityScore: 85,
    sourceLabel: "HairOS structured trichology knowledge", sourceUrl: "repo:.md files/HAIROS_FOLLICULAR_BIOLOGY_INTELLIGENCE.md", sourceVersion: "2026-06", effectiveFrom: "2026-07-18",
  },
  {
    id: "HAIROS_TOPICALS_GENERAL_V1", title: "Topical treatment categories", topic: "TOPICAL", knowledgeSystem: "MODERN_DERMATOLOGY", language: "en",
    content: "Topicals used in hair care have different purposes: growth-support medicines, anti-inflammatory or antifungal scalp treatments, cosmetic serums and cleansers are not interchangeable. Suitability depends on the condition, scalp state, age, pregnancy status, medicines and cardiovascular history. General information cannot select a prescription or dose for an individual.",
    keywords: ["topical", "minoxidil", "finasteride", "ketoconazole", "serum", "shampoo", "scalp"], approvalStatus: "PUBLISHED_PATIENT", authorityScore: 90,
    sourceLabel: "HairOS structured topical registry", sourceUrl: "repo:src/packages/ai-engine/knowledge-engine/kb/topicals", sourceVersion: "reviewed-2026-06", effectiveFrom: "2026-07-18",
  },
  {
    id: "HAIROS_MINOXIDIL_GENERAL_V1", title: "Minoxidil general information", topic: "TOPICAL", knowledgeSystem: "MODERN_DERMATOLOGY", language: "en",
    content: "Minoxidil is a growth-support medicine used for some types of hair loss. Not every hair-loss condition responds to it, and irritation, unwanted hair growth, dizziness or cardiovascular symptoms require appropriate advice. Pregnancy, breastfeeding, age, blood-pressure history and other treatment can change suitability. Do not start, stop or change strength based on a general chat answer.",
    keywords: ["minoxidil", "topical minoxidil", "hair growth", "side effects", "blood pressure"], approvalStatus: "PUBLISHED_PATIENT", authorityScore: 90,
    sourceLabel: "HairOS structured ingredient knowledge - Minoxidil", sourceUrl: "repo:src/packages/ai-engine/knowledge-engine/kb/ingredients/minoxidil.ts", sourceVersion: "reviewed-2026-06", effectiveFrom: "2026-07-18",
  },
  {
    id: "HAIROS_SAFETY_RED_FLAGS_V1", title: "When hair or scalp symptoms need medical review", topic: "SAFETY", knowledgeSystem: "MODERN_DERMATOLOGY", language: "en",
    content: "Seek prompt medical advice for sudden patchy loss, a painful or burning scalp, pus, spreading redness, scarring, eyebrow or eyelash loss, hair loss in a child, symptoms after a new medicine, or shedding accompanied by systemic illness. Chest pain, fainting, breathing difficulty or facial swelling after a treatment needs urgent care.",
    keywords: ["red flags", "doctor", "urgent", "pain", "scarring", "medicine reaction", "chest pain", "fainting"], approvalStatus: "PUBLISHED_PATIENT", authorityScore: 100,
    sourceLabel: "American Academy of Dermatology - Types and causes of hair loss", sourceUrl: "https://www.aad.org/public/diseases/hair-loss/types", sourceVersion: "accessed-2026-07-18", effectiveFrom: "2026-07-18",
  },
];

const GENERAL_HAIR_KNOWLEDGE: GeneralKnowledgeEntry[] = HAIR_SEED.map((entry) => ({
  ...entry,
  domain: "HAIR",
  sourceType: entry.sourceUrl.startsWith("repo:") ? "CLINICAL_PROTOCOL" : "PATIENT_EDUCATION",
  sourceStatus: "ACTIVE",
  claims: [{
    claimId: `${entry.id}_CLAIM_1`,
    claimType: entry.topic === "SAFETY" ? "SAFETY_WORDING" : entry.topic === "TOPICAL" ? "USAGE" : "GENERAL_EDUCATION",
    statement: entry.content,
    evidenceStatus: "SUPPORTED",
    approvalStatus: entry.approvalStatus,
    audience: "PATIENT",
    effectiveFrom: entry.effectiveFrom,
  }],
}));

export const GENERAL_KNOWLEDGE_SEED: GeneralKnowledgeEntry[] = [...FIVE_KIT_CONTROLLED_KNOWLEDGE, ...GENERAL_HAIR_KNOWLEDGE];
