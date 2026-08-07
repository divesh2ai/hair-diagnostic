import { findCatalogueEntityMatches, normalizeEntityName } from "./fullCatalogue";
import { detectRequestedDomain, type PlatformDomain } from "./domainConfig";

export type GeneralIntent = "HAIR_EDUCATION" | "PROMPT_INJECTION" | "MIXED_KIT_INFORMATION" | "CATALOGUE_PRICE" | "KIT_OVERVIEW" | "KIT_MECHANISM" | "KIT_COMPOSITION" | "PRODUCT_LOOKUP" | "COMPARISON" | "CONDITION_EXPLANATION" | "LIFESTYLE_FACTOR_IMPACT" | "INGREDIENT_INFORMATION" | "TOPICAL_INFORMATION" | "LIFESTYLE_NUTRITION" | "OUT_OF_SCOPE_DOMAIN" | "GENERAL_SAFETY" | "PERSONAL_PLAN_REQUEST" | "DIAGNOSIS_REQUEST" | "KIT_SUITABILITY_REQUEST" | "UNSAFE_TREATMENT_CHANGE";

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
};

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
export function understandQuestion(query: string, history: Array<{ role: string; content: string }> = []): UnderstoodQuestion {
  const current = canonicalize(query);
  const prior = [...history].reverse().find((item) => item.role === "user")?.content ?? "";
  const followUp = /^(and |what about|how about|it |that |this |iska|usme|aur )/.test(current.text) || /\b(it|that one|this one|iska|usme)\b/.test(current.text);
  const retrievalQuery = followUp && prior ? `${canonicalize(prior).text} ${current.text}` : current.text;
  const requestedDomain = detectRequestedDomain(retrievalQuery);
  const rewrittenQueries = [...new Set([retrievalQuery, retrievalQuery.replace(/\bmphl\b/g, "male pattern hair loss").replace(/\bfphl\b/g, "female pattern hair loss").replace(/\bte\b/g, "telogen effluvium")])];
  const entities = findCatalogueEntityMatches(retrievalQuery);
  return { original: query, normalized: current.text, retrievalQuery, rewrittenQueries, requestedDomain, language: current.language, intent: intentFor(current.text, requestedDomain, entities), entities, usedFollowUpContext: followUp && !!prior };
}

