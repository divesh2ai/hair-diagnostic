import { findCatalogueEntityMatches, normalizeEntityName } from "./fullCatalogue";
import { detectRequestedDomain, type PlatformDomain } from "./domainConfig";
import type { GeneralConversationContext } from "./conversationContext";

export type GeneralIntent = "HAIR_EDUCATION" | "PROMPT_INJECTION" | "MIXED_KIT_INFORMATION" | "CATALOGUE_PRICE" | "KIT_OVERVIEW" | "KIT_MECHANISM" | "KIT_COMPOSITION" | "PRODUCT_LOOKUP" | "COMPARISON" | "CONDITION_EXPLANATION" | "LIFESTYLE_FACTOR_IMPACT" | "INGREDIENT_INFORMATION" | "TOPICAL_INFORMATION" | "LIFESTYLE_NUTRITION" | "OUT_OF_SCOPE_DOMAIN" | "GENERAL_SAFETY" | "PERSONAL_PLAN_REQUEST" | "DIAGNOSIS_REQUEST" | "KIT_SUITABILITY_REQUEST" | "UNSAFE_TREATMENT_CHANGE" | "INGREDIENT_RATIONALE" | "KIT_PATHWAYS" | "KIT_CLINICAL_RELEVANCE" | "KIT_SUMMARY" | "FORMULATION_RATIONALE" | "SOURCE_INSPECTION" | "FOLLOW_UP_REFERENCE";

export type UnderstoodQuestion = {
  original: string;
  normalized: string;
  retrievalQuery: string;
  rewrittenQueries: string[];
  requestedDomain: PlatformDomain;
  language: "en" | "hi" | "hinglish";
  intent: GeneralIntent;
  entities: ReturnType<typeof findCatalogueEntityMatches>;
  usedFollowUpContext: boolean;
  depth: AnswerDepth;
  inheritedProductFamily?: string;
  ingredient?: string;
  lifestyleFactor?: string;
};

export type AnswerDepth = "QUICK" | "EXPLAIN" | "DEEP_DIVE";

export function inferAnswerDepth(text: string): AnswerDepth {
  const normalized = normalizeEntityName(text.toLowerCase());
  if (/deep dive|complete rationale|full ingredient|full formulation|detailed formulation|detailed clinical|deep clinical|complete explanation|in detail/.test(normalized)) return "DEEP_DIVE";
  if (/\bwhy\b|\bhow\b|explain|mechanism|rationale|work together|pathway/.test(normalized)) return "EXPLAIN";
  return "QUICK";
}

const HINGLISH: Record<string, string> = {
  baal: "hair", bal: "hair", jhad: "shed", jhadna: "shedding", girna: "shedding", gir: "shed", khujli: "itching", khushki: "dandruff", tel: "oil", daam: "price", kimat: "price", kitna: "what", kya: "what", kyu: "why", kyun: "why", kaise: "how", fark: "difference", farak: "difference", safed: "greying", ganjapan: "hair loss", dawa: "medicine", lena: "take", lu: "take", chahiye: "should", mera: "my", meri: "my", mere: "my", iska: "this", uska: "that", wala: "one",
};
const TYPO: Record<string, string> = {
  alopacia: "alopecia", alopecai: "alopecia", dandraf: "dandruff", dandruuf: "dandruff", minoxydil: "minoxidil", minoxidle: "minoxidil", finastride: "finasteride", ingredent: "ingredient", ingridient: "ingredient", compair: "compare", comparision: "comparison", ayurved: "ayurveda", telogenefluvium: "telogen effluvium", inflamation: "inflammation", inflam: "inflammation", nutriton: "nutrition",
};
const DEVANAGARI: Record<string, string> = { "बालों": "hair", "बाल": "hair", "झड़ना": "shedding", "झड़": "shed", "गिरना": "shedding", "रूसी": "dandruff", "खुजली": "itching", "तेल": "oil", "कीमत": "price", "दाम": "price", "क्या": "what", "क्यों": "why", "कैसे": "how", "मेरा": "my", "मेरी": "my", "आयुर्वेद": "ayurveda" };

function canonicalize(query: string): { text: string; language: UnderstoodQuestion["language"] } {
  const hasHindi = /[\u0900-\u097f]/.test(query);
  let translated = query.toLowerCase();
  for (const [term, replacement] of Object.entries(DEVANAGARI)) translated = translated.replaceAll(term, ` ${replacement} `);
  let text = normalizeEntityName(translated); let hinglishHits = 0;
  text = text.split(" ").map((token) => TYPO[token] ?? (HINGLISH[token] ? (hinglishHits += 1, HINGLISH[token]) : token)).join(" ");
  return { text, language: hasHindi ? "hi" : hinglishHits ? "hinglish" : "en" };
}

function intentFor(text: string, domain: PlatformDomain, entities: ReturnType<typeof findCatalogueEntityMatches>): GeneralIntent {
  const hasKitEntity = entities.some((entity) => entity.type === "KIT");
  if (domain !== "HAIR") return "OUT_OF_SCOPE_DOMAIN";
  if (/ignore (all |the )?(previous|prior)|system prompt|developer message|bypass|publish draft|drop table|api key|secret key|other clinic|another clinic|tenant data|private configuration|reveal private/.test(text)) return "PROMPT_INJECTION";
  if (/my approved (?:treatment )?plan|my treatment plan|my assessment|doctor approve|my doctor|mere (plan|assessment)|personal plan/.test(text)) return "PERSONAL_PLAN_REQUEST";
  if (/increase|decrease|double|stop|start|change|replace|dose|dosage|how many tablets|kitni goli/.test(text) && /medicine|minoxidil|finasteride|tablet|treatment|dose/.test(text)) return "UNSAFE_TREATMENT_CHANGE";
  if (/do i have|diagnose|is this alopecia|what condition do i have|am i balding/.test(text)) return "DIAGNOSIS_REQUEST";
  if (/which kit|what kit.*take|kit.*should.*take|which .* should .*take|should i take .*kit|best kit|recommend.*kit/.test(text)) return "KIT_SUITABILITY_REQUEST";
  if (/emergency|chest pain|faint|breathing|severe swelling|allergic|seek medical|side effect|safe|pregnan|breastfeed/.test(text)) return "GENERAL_SAFETY";
  if (/what source|which source|source are you using|show (?:me )?(?:the )?sources?/.test(text)) return "SOURCE_INSPECTION";
  if (/complete formulation rationale|full formulation rationale|formulation rationale/.test(text)) return "FORMULATION_RATIONALE";
  if (/why (?:is |are )?(?:nac|n acetyl|curcumin|resveratrol|vitamin d)|(?:nac|n acetyl|curcumin|resveratrol|vitamin d).*(?:role|rationale|included)|other ingredients.*oxidative/.test(text)) return "INGREDIENT_RATIONALE";
  if (/what pathways|which pathways|pathways? does|pathways?.*target/.test(text)) return "KIT_PATHWAYS";
  if (/clinical factors|clinically relevant|clinical relevance|factors.*assess/.test(text)) return "KIT_CLINICAL_RELEVANCE";
  if (/(?:explain|summari[sz]e).*(?:kit|phenotype).*(?:bullet|points)|(?:kit|phenotype).*(?:in )?\d+ bullets?/.test(text)) return "KIT_SUMMARY";
  if (hasKitEntity && /ingredient|ingredients|formulation/.test(text) && /explain|work together|how|why|mechanism|rationale|role|roles/.test(text)) return "MIXED_KIT_INFORMATION";
  if (/(price|mrp|cost|how much|composition|contains|inside kit|products in|what comes in)/.test(text) && /(why|purpose|used for|addresses|mechanism|objective)/.test(text)) return "MIXED_KIT_INFORMATION";
  if (/price|mrp|cost|how much/.test(text)) return "CATALOGUE_PRICE";
  if (/compare|comparison|difference|differ|versus| vs /.test(` ${text} `)) return "COMPARISON";
  if (/composition|contain|inside|products? (?:are )?(?:in|inside)|list the products|what comes in/.test(text)) return "KIT_COMPOSITION";
  if (hasKitEntity && /ingredient|ingredients|formulation|inside|\bkit\b/.test(text)) return "KIT_COMPOSITION";
  if (hasKitEntity && /variant|variants/.test(text)) return "KIT_OVERVIEW";
  if (hasKitEntity && /what is|overview|tell me about/.test(text)) return "KIT_OVERVIEW";
  if (hasKitEntity && /explain|work|works|mechanism|objective|pathway|why|role|rationale/.test(text)) return "KIT_MECHANISM";
  if (/smok|tobacco|vaping|alcohol|drinking|stress|poor sleep|sleep deprivation|night shift|restrictive diet|crash diet|rapid weight loss|weight loss/.test(text)) return "LIFESTYLE_FACTOR_IMPACT";
  if (/telogen effluvium|gut health|gut imbalance|dysbiosis|microbiome|insulin resistance|iron deficiency|thyroid|oxidative stress|inflammation and hair/.test(text)) return "CONDITION_EXPLANATION";
  if (/ingredient|formulation|contains what/.test(text)) return "INGREDIENT_INFORMATION";
  if (/topical|minoxidil|finasteride|dutasteride|ketoconazole|shampoo|serum/.test(text)) return "TOPICAL_INFORMATION";
  if (/nutrition|diet|protein|iron|vitamin|sleep|stress|exercise|lifestyle|hair care/.test(text)) return "LIFESTYLE_NUTRITION";
  const shortEntityOnly = hasKitEntity && text.split(" ").filter(Boolean).length <= 4;
  if (/kit|product/.test(text) || shortEntityOnly) return "PRODUCT_LOOKUP";
  return "HAIR_EDUCATION";
}
const contextLabel = (id?: string) => id === "KIT_INFLAMMATION_PHENOTYPE" ? "Inflammation Phenotype" : id?.replace(/^KIT_/, "").replaceAll("_", " ");
const ingredientFor = (text: string) => /\bn[-\s]?a[-\s]?c\b|n acetyl cysteine/.test(text) ? "NAC" : /curcumin/.test(text) ? "CURCUMIN" : /resveratrol/.test(text) ? "RESVERATROL" : /vitamin d/.test(text) ? "VITAMIN_D" : undefined;
const lifestyleFactorFor = (text: string) => /smok|tobacco|vaping/.test(text) ? "SMOKING" : /alcohol|drinking/.test(text) ? "ALCOHOL" : /\bstress\b/.test(text.replace(/oxidative stress/g, "")) ? "STRESS" : /sleep|night shift/.test(text) ? "SLEEP" : undefined;

export function understandQuestion(query: string, history: Array<{ role: string; content: string }> = [], context?: GeneralConversationContext): UnderstoodQuestion {
  const current = canonicalize(query);
  const prior = [...history].reverse().find((item) => item.role === "user")?.content ?? "";
  const explicitEntities = findCatalogueEntityMatches(current.text);
  const contextualReference = /\b(it|this kit|the kit|this phenotype|that one|this one|its|it target)\b/.test(current.text)
    || /^(and |what about|how about|it |that |this |iska|usme|aur )/.test(current.text)
    || (!explicitEntities.some((entity) => entity.type === "KIT") && !!context?.activeProductFamily && /ingredient|nac|pathway|clinical factor|formulation|source|price|smok|oxidative stress|bullet/.test(current.text));
  const inheritedLabel = contextualReference ? contextLabel(context?.activeProductFamily) : undefined;
  const retrievalQuery = inheritedLabel ? `${inheritedLabel} ${current.text}` : contextualReference && prior ? `${canonicalize(prior).text} ${current.text}` : current.text;
  const requestedDomain = detectRequestedDomain(retrievalQuery);
  const rewrittenQueries = [...new Set([retrievalQuery, retrievalQuery.replace(/\bmphl\b/g, "male pattern hair loss").replace(/\bfphl\b/g, "female pattern hair loss").replace(/\bte\b/g, "telogen effluvium")])];
  const entities = findCatalogueEntityMatches(retrievalQuery);
  return { original: query, normalized: current.text, retrievalQuery, rewrittenQueries, requestedDomain, language: current.language, intent: intentFor(current.text, requestedDomain, entities), entities, usedFollowUpContext: !!inheritedLabel || (contextualReference && !!prior), depth: inferAnswerDepth(current.text), inheritedProductFamily: inheritedLabel ? context?.activeProductFamily : undefined, ingredient: ingredientFor(current.text), lifestyleFactor: lifestyleFactorFor(current.text) };
}

