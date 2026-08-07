import type { AssistantIntent, SafetyFlag } from "./types";

export function isHairAssistantScope(query: string): boolean {
  const q = query.toLowerCase();
  if (/\bayurveda\b|\bskin(?:care)?\b/.test(q)) return false;
  return /hair|scalp|follic|alopecia|shedd|telogen|anagen|dht|kit|gold|meta b|immusurge|lactoferrin|probiotic|topical|minoxidil|finasteride|inflammation|price|mrp|dose|medicine|pregnan|breastfeed|child|swelling|breath|stomach pain|source|what information|recovery|expectation|months?/.test(q);
}

export function detectSafetyFlags(query: string): SafetyFlag[] {
  const q = query.toLowerCase();
  const flags: SafetyFlag[] = [];
  if (/(breath|breathing).*(difficult|problem)|swelling.*(breath|face|tongue)/.test(q)) flags.push("EMERGENCY", "ADVERSE_EVENT");
  else if (/severe stomach pain|adverse|side effect|reaction/.test(q)) flags.push("ADVERSE_EVENT");
  if (/pregnan/.test(q)) flags.push("PREGNANCY");
  if (/breastfeed|lactat/.test(q)) flags.push("LACTATION");
  if (/\bchild\b|paediatric|pediatric/.test(q)) flags.push("PEDIATRIC");
  if (/with .*medicine|interaction|thyroid medicine/.test(q)) flags.push("DRUG_INTERACTION");
  if (/double the dose|change.*dose|missed.*dose/.test(q)) flags.push("DOSAGE_CHANGE");
  if (/stop.*(medicine|medication)/.test(q)) flags.push("MEDICATION_STOP");
  if (/replace|switch|remove one kit|buy only one product/.test(q)) flags.push("TREATMENT_CHANGE");
  return [...new Set(flags)];
}

export function classifyIntent(query: string): AssistantIntent {
  const q = query.toLowerCase();
  if (detectSafetyFlags(q).length || /sudden round patches/.test(q)) return "SAFETY_OR_ADVERSE_EVENT";
  if (/source|what information do you not know/.test(q)) return "SYSTEM_TRANSPARENCY";
  if (/why was .*not selected/.test(q)) return "SUPPRESSED_KIT_EXPLANATION";
  if (/why was .*selected|selected for me|doctor remove/.test(q)) return "PLAN_EXPLANATION";
  if (/start first|placed before|not first|after i finish|sequence/.test(q)) return "SEQUENCE_EXPLANATION";
  if (/price|mrp|cost|discount|stock|charge/.test(q)) return "PRICE_INFORMATION";
  if (/compare|different from/.test(q)) return "KIT_COMPARISON";
  if (/ingredient|lactoferrin|probiotic/.test(q)) return "INGREDIENT_INFORMATION";
  if (/what products|contain|inside|composition|which pilot kits/.test(q)) return "KIT_COMPOSITION";
  if (/sunday|daily|alternate day|schedule|taken/.test(q)) return "KIT_SCHEDULE";
  if (/what is .*gold|what is phenotype|what is meta b/.test(q)) return "PRODUCT_INFORMATION";
  return "GENERAL_HAIR_EDUCATION";
}
