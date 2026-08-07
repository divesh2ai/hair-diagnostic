import type { AssistantAction, AssistantToolResult, SafetyFlag, SourceRef } from "./types";
import type { GeneralCataloguePort } from "./generalCatalogue";
import type { HairKnowledgeTopic, KnowledgeSystem } from "./knowledgeTypes";
import type { KnowledgeRetriever, RetrievalResult } from "./hybridRetrieval";
import { understandQuestion, type GeneralIntent } from "./questionUnderstanding";
import { outOfScopeDomainMessage } from "./domainConfig";

export type GeneralAssistantInput = {
  requestId?: string;
  query: string;
  language?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  debug?: boolean;
};

export type GeneralAssistantResponse = {
  requestId: string;
  mode: "GENERAL_KNOWLEDGE";
  intent: GeneralIntent;
  action: AssistantAction;
  answer: string;
  cards: Array<
    | { type: "price"; title: string; amount: number; currency: string; status: string }
    | { type: "composition"; title: string; items: string[] }
    | { type: "comparison"; title: string; shared: string[]; leftOnly: string[]; rightOnly: string[] }
  >;
  sources: SourceRef[];
  safetyFlags: SafetyFlag[];
  toolCalls: Array<{ name: string; status: AssistantToolResult["status"]; sourceIds: string[] }>;
  detectedLanguage: string;
  usedFollowUpContext: boolean;
  selectedAuthority: "STRUCTURED_CATALOGUE" | "APPROVED_KNOWLEDGE" | "SAFETY_POLICY" | "AUTHENTICATED_PERSONAL_PLAN";
  retrieval?: { strategy: RetrievalResult["strategy"]; contradictions: RetrievalResult["contradictions"]; evidenceSufficient: boolean; insufficiencyReasons: string[] };
  debug?: {
    entityResolution?: { resolvedProduct: string; resolvedEntityId: string; confidence: number; method: string; matchedAlias: string };
    sourceIntegrity?: { checked: boolean; ingredientCount: number; ingredientNames: string[]; strengthsStatus: string; sourceRecord: string; version?: number; approvalStatus?: string; discrepancyResult: string };
  };
};

const toolCall = (result: AssistantToolResult) => ({ name: result.tool, status: result.status, sourceIds: result.sources.map((source) => source.sourceId) });
const uniqueSources = (sources: SourceRef[]) => sources.filter((source, index, all) => all.findIndex((candidate) => candidate.sourceId === source.sourceId && candidate.field === source.field) === index);
const list = (items: string[]) => items.length ? items.join(", ") : "none listed";
const canonicalFiveKitId = (name: string): string | undefined => {
  const value = name.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (value.includes("te gold")) return "KIT_TE_GOLD";
  if (value.includes("gi health gold")) return "KIT_GI_HEALTH_GOLD";
  if (value.includes("pro immune gold")) return "KIT_PRO_IMMUNE_GOLD";
  if (value.includes("inflammation phenotype") || value.includes("phenotype inflammation")) return "KIT_INFLAMMATION_PHENOTYPE";
  if (value.includes("meta b ir 5") || value.includes("metab ir5")) return "KIT_PRO_FACT_META_B_IR5";
  if (value.includes("meta b pcos")) return "KIT_PRO_FACT_META_B_PCOS";
  if (value.includes("meta b thyroid") || value.includes("meta b hypothyroid")) return "KIT_PRO_FACT_META_B_THYROID";
  if (value.includes("meta b menopause") || value.includes("meta b post m")) return "KIT_PRO_FACT_META_B_MENOPAUSE";
  if (value.includes("meta b")) return "KIT_PRO_FACT_META_B";
  return undefined;
};

function topicsFor(intent: GeneralIntent): { topics?: HairKnowledgeTopic[]; systems?: KnowledgeSystem[] } {
  switch (intent) {
    case "TOPICAL_INFORMATION": return { topics: ["TOPICAL", "INGREDIENT"], systems: ["MODERN_DERMATOLOGY"] };
    case "INGREDIENT_INFORMATION": return { topics: ["INGREDIENT", "TOPICAL", "LIFESTYLE"] };
    case "LIFESTYLE_FACTOR_IMPACT": return { topics: ["LIFESTYLE"], systems: ["NUTRITION_LIFESTYLE"] };
    case "LIFESTYLE_NUTRITION": return { topics: ["LIFESTYLE"], systems: ["NUTRITION_LIFESTYLE"] };
    case "CONDITION_EXPLANATION": return { topics: ["HAIR_CONDITION", "HAIR_BIOLOGY", "SCALP_CONDITION"], systems: ["TRICHOLOGY", "MODERN_DERMATOLOGY"] };
    case "KIT_OVERVIEW":
    case "KIT_MECHANISM": return { topics: ["HAIR_BIOLOGY", "HAIR_CONDITION", "SCALP_CONDITION"], systems: ["TRICHOLOGY"] };
    case "GENERAL_SAFETY": return { topics: ["SAFETY", "TOPICAL"], systems: ["MODERN_DERMATOLOGY"] };
    default: return { topics: ["HAIR_BIOLOGY", "HAIR_CONDITION", "SCALP_CONDITION", "SAFETY"] };
  }
}

function knowledgeSources(result: RetrievalResult): SourceRef[] {
  return result.hits.flatMap((hit) => hit.claims.map((claim) => ({
    sourceType: "KNOWLEDGE_CHUNK",
    sourceId: claim.claimId,
    label: hit.sourceLabel,
    version: Number.isFinite(Number(hit.sourceVersion)) ? Number(hit.sourceVersion) : undefined,
    effectiveFrom: hit.effectiveFrom || null,
    approvalStatus: hit.approvalStatus,
    url: hit.sourceUrl,
    knowledgeSystem: hit.knowledgeSystem,
    authorityScore: hit.authorityScore,
    claimType: claim.claimType,
    evidenceStatus: claim.evidenceStatus,
  })));
}

function citedKnowledgeAnswer(result: RetrievalResult): string {
  if (!result.evidenceSufficient) return `I could not find enough current, patient-published Hair evidence for that question. I will not fill the gap by guessing.${result.contradictions.length ? " The approved sources also contain a material contradiction." : ""} Please ask a hair clinician or try a more specific Hair question.`;
  const body = result.hits.slice(0, 3).map((hit, index) => `${hit.content} [${index + 1}]`).join("\n\n");
  return body;
}

type KitCompositionData = { kitId?: string; name: string; components: Array<{ productName: string; formulation?: string | null }> };
type KitIngredientFactsData = { kitId: string; name: string; products: Array<{ productId: string; productName: string; ingredients: Array<{ ingredientName: string; quantity: string | null; route: string | null; sourceRow: number }>; discrepancy: string | null }>; ingredientCount: number; discrepancyResult: string };

const asksForIngredients = (text: string) => /ingredient|ingredients|formulation/.test(text);
const asksForIngredientContainment = (text: string) => /\bcontain(?:s)?\s+(?:nac|n acetyl|curcumin|resveratrol|vitamin|zinc|colostrum|kelp|mushroom|beta sitosterol|ginseng|biotin|inositol|magnesium|co enzyme|coq10|selenium|copper|moringa|alpha lipoic|quercetin|lactoferrin|spirulina)/.test(text);
const ingredientLabel = (row: { ingredientName: string; quantity: string | null }) => `${row.ingredientName}${row.quantity ? ` ${row.quantity}` : ""}`;
const formatKitIngredientFacts = (data: KitIngredientFactsData) => data.products.map((product) => product.ingredients.length ? `${product.productName}: ${product.ingredients.map(ingredientLabel).join("; ")}` : `${product.productName}: no verified ingredient row in Complete formulation`).join("\n");

function requestedIngredientTerm(text: string): string | undefined {
  const match = text.match(/\bcontain(?:s)?\s+([a-z0-9][a-z0-9\s+-]{1,40})\??$/);
  return match?.[1]?.replace(/\b(ingredient|ingredients|product|products|kit)\b/g, "").trim() || undefined;
}

function normalizedIngredient(value: string): string {
  return value.toLowerCase().replace(/\bn[-\s]?a[-\s]?c\b/g, "n acetyl cysteine").replace(/\bcoq10\b/g, "co enzyme q10").replace(/[^a-z0-9]+/g, " ").trim();
}

function ingredientIntegrity(data: KitIngredientFactsData, sources: SourceRef[]) {
  const first = sources[0];
  return {
    checked: true,
    ingredientCount: data.ingredientCount,
    ingredientNames: data.products.flatMap((product) => product.ingredients.map((row) => `${product.productName}: ${ingredientLabel(row)}`)),
    strengthsStatus: "PUBLISHED_FROM_COMPLETE_FORMULATION_QTY_COLUMN",
    sourceRecord: first ? `${first.label}:${first.field ?? "formulation"}` : "NO_STRUCTURED_SOURCE",
    version: first?.version,
    approvalStatus: first?.approvalStatus,
    discrepancyResult: data.discrepancyResult,
  };
}

function sourceIntegrity(data: KitCompositionData, sources: SourceRef[]) {
  const names = data.components.map((item) => item.productName);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  const conflictingStrengths = data.components.filter((item) => item.formulation).length;
  const first = sources[0];
  return {
    checked: true,
    ingredientCount: names.length,
    ingredientNames: names,
    strengthsStatus: conflictingStrengths ? "PUBLISHED_STRENGTH_FIELDS_PRESENT" : "NOT_PUBLISHED_IN_ACTIVE_KIT_COMPONENT_RECORD",
    sourceRecord: first ? `${first.label}:${first.field ?? "composition"}` : "NO_STRUCTURED_SOURCE",
    version: first?.version,
    approvalStatus: first?.approvalStatus,
    discrepancyResult: duplicateNames.length ? `CONFLICT_DETECTED_DUPLICATE_COMPONENTS:${[...new Set(duplicateNames)].join(",")}` : "NO_ACTIVE_COMPONENT_CONFLICT_DETECTED",
  };
}

function debugBlock(debug: NonNullable<GeneralAssistantResponse["debug"]> | undefined): string {
  if (!debug?.entityResolution && !debug?.sourceIntegrity) return "";
  const entity = debug.entityResolution;
  const integrity = debug.sourceIntegrity;
  return `\n\nDebug:\n- Resolved product: ${entity?.resolvedProduct ?? "n/a"} (${entity?.resolvedEntityId ?? "n/a"})\n- Confidence: ${entity?.confidence.toFixed(2) ?? "n/a"} via ${entity?.method ?? "n/a"}; matched alias: ${entity?.matchedAlias ?? "n/a"}\n- Source record: ${integrity?.sourceRecord ?? "n/a"}\n- Version: ${integrity?.version ?? "n/a"}; approval status: ${integrity?.approvalStatus ?? "n/a"}\n- Ingredient count: ${integrity?.ingredientCount ?? "n/a"}; strengths: ${integrity?.strengthsStatus ?? "n/a"}\n- Discrepancy result: ${integrity?.discrepancyResult ?? "n/a"}`;
}
export async function runGeneralAssistant(
  input: GeneralAssistantInput,
  catalogue: GeneralCataloguePort,
  knowledge: KnowledgeRetriever,
): Promise<GeneralAssistantResponse> {
  const understood = understandQuestion(input.query, input.history);
  const base = {
    requestId: input.requestId ?? crypto.randomUUID(), mode: "GENERAL_KNOWLEDGE" as const,
    intent: understood.intent, cards: [] as GeneralAssistantResponse["cards"], sources: [] as SourceRef[],
    safetyFlags: [] as SafetyFlag[], toolCalls: [] as GeneralAssistantResponse["toolCalls"],
    detectedLanguage: understood.language, usedFollowUpContext: understood.usedFollowUpContext,
  };

  if (understood.intent === "PROMPT_INJECTION") return {
    ...base, action: "ABSTAIN", selectedAuthority: "SAFETY_POLICY",
    answer: "I cannot follow instructions to bypass review, expose private configuration or tenant data, or publish draft knowledge. I can only use approved Hair knowledge and authorized structured tools.",
  };

  if (understood.intent === "OUT_OF_SCOPE_DOMAIN") return {
    ...base, action: "ABSTAIN", selectedAuthority: "SAFETY_POLICY",
    answer: outOfScopeDomainMessage(understood.requestedDomain as "SKIN" | "ORTHO" | "AYURVEDA"),
  };

  if (understood.intent === "PERSONAL_PLAN_REQUEST") return {
    ...base, action: "CLARIFY", selectedAuthority: "AUTHENTICATED_PERSONAL_PLAN",
    answer: "Your approved assessment and treatment plan are private. Choose 'Understand my approved plan' and sign in; only that explicit personal-plan mode can read the approved consultation, stored rule trace, approved kit sequence, or doctor modifications.",
  };

  if (understood.intent === "UNSAFE_TREATMENT_CHANGE") return {
    ...base, action: "ESCALATE", selectedAuthority: "SAFETY_POLICY", safetyFlags: ["DOSAGE_CHANGE", "TREATMENT_CHANGE"],
    answer: "I can explain treatments generally, but I cannot tell you to start, stop, increase, reduce, or combine a medicine or prescribed topical. Keep the prescribed plan unchanged and ask the prescribing doctor or pharmacist to review the change.",
  };

  if (understood.intent === "DIAGNOSIS_REQUEST") return {
    ...base, action: "ABSTAIN", selectedAuthority: "SAFETY_POLICY",
    answer: "I can explain possible hair-loss patterns, but I cannot diagnose you from chat. Similar symptoms can have different causes. A hair/scalp assessment is the appropriate next step, especially for sudden, patchy, painful, inflamed, or scarring loss.",
  };

  if (understood.intent === "KIT_SUITABILITY_REQUEST") return {
    ...base, action: "CLARIFY", selectedAuthority: "SAFETY_POLICY",
    answer: "No kit is universally best, and general chat cannot select a patient-specific kit. I can compare the kits' documented contents and explain their general categories. For Meta B-family selection questions, the deterministic clinical engine or an approved patient plan remains the sole authority.",
  };

  const entities = understood.entities;
  if (understood.intent === "MIXED_KIT_INFORMATION") {
    const kit = entities.find((entity) => entity.type === "KIT");
    if (!kit) return { ...base, action: "CLARIFY", selectedAuthority: "STRUCTURED_CATALOGUE", answer: "Which kit would you like exact catalogue facts and an approved purpose explanation for?" };
    const entityDebug = { resolvedProduct: kit.value.name, resolvedEntityId: kit.value.id, confidence: kit.confidence, method: kit.method, matchedAlias: kit.matchedAlias };
    if (kit.confidence < 0.7) return { ...base, action: "CLARIFY", selectedAuthority: "STRUCTURED_CATALOGUE", answer: "Which kit should I use for that explanation? Likely options include Inflammation Phenotype, TE Gold, GI Gold, Pro Immune Gold, and Meta B.", debug: input.debug ? { entityResolution: entityDebug } : undefined };
    const wantsPrice = /price|mrp|cost|how much/.test(understood.normalized);
    const wantsIngredientFacts = !wantsPrice && asksForIngredients(understood.normalized);
    const [catalogueResult, retrieval] = await Promise.all([
      wantsPrice
        ? catalogue.getPrice({ type: "KIT", id: kit.value.id, name: kit.value.name })
        : wantsIngredientFacts
          ? catalogue.getKitIngredientFacts(kit.value.name)
          : catalogue.getKitComposition(kit.value.name),
      knowledge.search({ text: understood.retrievalQuery, rewrittenQueries: understood.rewrittenQueries, domain: "HAIR", entityId: canonicalFiveKitId(kit.value.name), topics: ["HAIR_BIOLOGY", "HAIR_CONDITION", "SAFETY"], language: understood.language === "hi" ? "hi" : "en", limit: 5 }),
    ]);
    const price = catalogueResult.data as { mrp?: number | null; currency?: string | null; status?: string } | undefined;
    const composition = catalogueResult.data as KitCompositionData | undefined;
    const ingredientFacts = catalogueResult.data as KitIngredientFactsData | undefined;
    const exactAvailable = catalogueResult.status === "ok" && (wantsPrice ? price?.mrp != null : wantsIngredientFacts ? !!ingredientFacts?.ingredientCount : !!composition?.components?.length);
    const exactName = wantsIngredientFacts ? ingredientFacts?.name : composition?.name;
    const exactText = wantsPrice
      ? (exactAvailable ? `The current published MRP for ${kit.value.name} is ${price?.currency ?? "INR"} ${price?.mrp}. [1]` : `No current approved MRP is available for ${kit.value.name}. Price records remain blocked until the governed price revision is published.`)
      : wantsIngredientFacts
        ? (exactAvailable ? `${ingredientFacts?.name ?? kit.value.name} has ${ingredientFacts?.ingredientCount ?? 0} verified product-level ingredient rows from Complete formulation.\n\n${formatKitIngredientFacts(ingredientFacts!)} [1]` : `No active approved product-formulation rows are available for ${kit.value.name}.`)
        : (exactAvailable ? `${composition?.name ?? kit.value.name} contains ${list((composition?.components ?? []).map((item) => item.productName))}. [1]` : `No approved composition is available for ${kit.value.name}.`);
    const explanation = citedKnowledgeAnswer(retrieval);
    const integrity = !wantsPrice && exactAvailable ? (wantsIngredientFacts ? ingredientIntegrity(ingredientFacts!, catalogueResult.sources) : sourceIntegrity(composition!, catalogueResult.sources)) : undefined;
    const debug = input.debug ? { entityResolution: entityDebug, sourceIntegrity: integrity } : undefined;
    const assumption = kit.confidence < 0.9 ? `Assuming you mean ${exactName ?? kit.value.name}.\n\n` : "";
    return {
      ...base,
      action: exactAvailable ? "ANSWER" : "ABSTAIN",
      selectedAuthority: exactAvailable ? "STRUCTURED_CATALOGUE" : "APPROVED_KNOWLEDGE",
      answer: `${assumption}${exactText}\n\n${explanation}${debugBlock(debug)}`,
      cards: wantsPrice && exactAvailable ? [{ type: "price", title: kit.value.name, amount: price!.mrp!, currency: price?.currency ?? "INR", status: price?.status ?? "PUBLISHED" }] : !wantsPrice && exactAvailable ? [{ type: "composition", title: wantsIngredientFacts ? `${ingredientFacts!.name} ingredients` : composition?.name ?? kit.value.name, items: wantsIngredientFacts ? ingredientFacts!.products.flatMap((product) => product.ingredients.map((row) => `${product.productName}: ${ingredientLabel(row)}`)) : (composition?.components ?? []).map((item) => item.productName) }] : [],
      sources: uniqueSources([...catalogueResult.sources, ...knowledgeSources(retrieval)]),
      toolCalls: [toolCall(catalogueResult), { name: "retrieveApprovedKnowledge", status: retrieval.hits.length ? "ok" : "not_found", sourceIds: retrieval.hits.map((hit) => hit.id) }],
      retrieval: { strategy: retrieval.strategy, contradictions: retrieval.contradictions, evidenceSufficient: retrieval.evidenceSufficient, insufficiencyReasons: retrieval.insufficiencyReasons },
      debug,
    };
  }
  if (understood.intent === "KIT_OVERVIEW" || understood.intent === "KIT_MECHANISM") {
    const kit = entities.find((entity) => entity.type === "KIT");
    if (!kit) return { ...base, action: "CLARIFY", selectedAuthority: "APPROVED_KNOWLEDGE", answer: "Which pilot kit family should I explain? Likely options include TE Gold, GI Gold, Pro Immune Gold, Inflammation Phenotype, and Meta-B." };
    const entityDebug = { resolvedProduct: kit.value.name, resolvedEntityId: kit.value.id, confidence: kit.confidence, method: kit.method, matchedAlias: kit.matchedAlias };
    if (kit.confidence < 0.7) return { ...base, action: "CLARIFY", selectedAuthority: "APPROVED_KNOWLEDGE", answer: "Which pilot kit family should I explain? Likely options include TE Gold, GI Gold, Pro Immune Gold, Inflammation Phenotype, and Meta-B.", debug: input.debug ? { entityResolution: entityDebug } : undefined };
    const asksVariants = /variant|variants|ir 5|ir5|pcos|thyroid|menopause/.test(understood.normalized);
    const contentTypes = asksVariants ? ["VARIANT", "OVERVIEW"] as const : understood.intent === "KIT_OVERVIEW" ? ["OVERVIEW", "DOCTOR_EXPLANATION", "VARIANT"] as const : ["DOCTOR_EXPLANATION", "THERAPEUTIC_PATHWAY", "FORMULATION_RATIONALE"] as const;
    const retrieval = await knowledge.search({ text: understood.retrievalQuery, rewrittenQueries: understood.rewrittenQueries, domain: "HAIR", entityId: canonicalFiveKitId(kit.value.name) ?? kit.value.id, topics: topicsFor(understood.intent).topics, systems: topicsFor(understood.intent).systems, taxonomyDomains: ["KIT", "KIT_VARIANT"], contentTypes: [...contentTypes], audience: "DOCTOR", language: understood.language === "hi" ? "hi" : "en", limit: 4 });
    const assumption = kit.confidence < 0.9 ? `Assuming you mean ${kit.value.name}.\n\n` : "";
    const debug = input.debug ? { entityResolution: entityDebug } : undefined;
    return {
      ...base,
      action: retrieval.evidenceSufficient ? "ANSWER" : "ABSTAIN",
      selectedAuthority: "APPROVED_KNOWLEDGE",
      answer: `${assumption}${citedKnowledgeAnswer(retrieval)}${debugBlock(debug)}`,
      sources: knowledgeSources(retrieval),
      toolCalls: [{ name: "retrieveApprovedKnowledge", status: retrieval.hits.length ? "ok" : "not_found", sourceIds: retrieval.hits.map((hit) => hit.id) }],
      retrieval: { strategy: retrieval.strategy, contradictions: retrieval.contradictions, evidenceSufficient: retrieval.evidenceSufficient, insufficiencyReasons: retrieval.insufficiencyReasons },
      debug,
    };
  }

  if (understood.intent === "CONDITION_EXPLANATION" || understood.intent === "LIFESTYLE_FACTOR_IMPACT") {
    const filter = topicsFor(understood.intent);
    const retrieval = await knowledge.search({ text: understood.retrievalQuery, rewrittenQueries: understood.rewrittenQueries, domain: "HAIR", topics: filter.topics, systems: filter.systems, taxonomyDomains: [understood.intent === "LIFESTYLE_FACTOR_IMPACT" ? "LIFESTYLE_FACTOR" : "CONDITION"], contentTypes: [understood.intent === "LIFESTYLE_FACTOR_IMPACT" ? "LIFESTYLE_IMPACT" : "CONDITION_EXPLANATION"], audience: "DOCTOR", language: understood.language === "hi" ? "hi" : "en", limit: 4 });
    return {
      ...base,
      action: retrieval.evidenceSufficient ? "ANSWER" : "ABSTAIN",
      selectedAuthority: "APPROVED_KNOWLEDGE",
      answer: citedKnowledgeAnswer(retrieval),
      sources: knowledgeSources(retrieval),
      toolCalls: [{ name: "retrieveApprovedKnowledge", status: retrieval.hits.length ? "ok" : "not_found", sourceIds: retrieval.hits.map((hit) => hit.id) }],
      retrieval: { strategy: retrieval.strategy, contradictions: retrieval.contradictions, evidenceSufficient: retrieval.evidenceSufficient, insufficiencyReasons: retrieval.insufficiencyReasons },
    };
  }
  if (understood.intent === "CATALOGUE_PRICE") {
    const entity = entities[0];
    if (!entity) return { ...base, action: "CLARIFY", selectedAuthority: "STRUCTURED_CATALOGUE", answer: "Which kit or product MRP would you like me to check?" };
    const ref = { type: entity.type, id: entity.value.id, name: entity.value.name };
    const result = await catalogue.getPrice(ref);
    const data = result.data as { mrp?: number | null; currency?: string | null; status?: string } | undefined;
    const available = result.status === "ok" && data?.mrp != null;
    return {
      ...base, action: available ? "ANSWER" : "ABSTAIN", selectedAuthority: "STRUCTURED_CATALOGUE",
      answer: available ? `The current published MRP for ${entity.value.name} is ${data?.currency ?? "INR"} ${data?.mrp}. [1]` : `The approved structured catalogue does not contain a current published MRP for ${entity.value.name}. I will not infer or reuse an unapproved price.`,
      cards: available ? [{ type: "price", title: entity.value.name, amount: data!.mrp!, currency: data?.currency ?? "INR", status: data?.status ?? "PUBLISHED" }] : [],
      sources: result.sources, toolCalls: [toolCall(result)],
    };
  }

  if (understood.intent === "KIT_COMPOSITION" || (understood.intent === "PRODUCT_LOOKUP" && entities[0]?.type === "KIT")) {
    const kit = entities.find((entity) => entity.type === "KIT");
    if (!kit) return { ...base, action: "CLARIFY", selectedAuthority: "STRUCTURED_CATALOGUE", answer: "Which kit composition should I look up? Likely options include Inflammation Phenotype, TE Gold, GI Gold, Pro Immune Gold, and Meta B." };
    const entityDebug = { resolvedProduct: kit.value.name, resolvedEntityId: kit.value.id, confidence: kit.confidence, method: kit.method, matchedAlias: kit.matchedAlias };
    if (kit.confidence < 0.7) return { ...base, action: "CLARIFY", selectedAuthority: "STRUCTURED_CATALOGUE", answer: "Which kit composition should I look up? Likely options include Inflammation Phenotype, TE Gold, GI Gold, Pro Immune Gold, and Meta B.", debug: input.debug ? { entityResolution: entityDebug } : undefined };
    const wantsIngredients = asksForIngredients(understood.normalized) || asksForIngredientContainment(understood.normalized);
    const result = wantsIngredients ? await catalogue.getKitIngredientFacts(kit.value.name) : await catalogue.getKitComposition(kit.value.name);
    if (wantsIngredients) {
      const data = result.data as KitIngredientFactsData | undefined;
      if (result.status !== "ok" || !data) return { ...base, action: "ABSTAIN", selectedAuthority: "STRUCTURED_CATALOGUE", answer: `INSUFFICIENT_STRUCTURED_KIT_INGREDIENTS: I could not find active approved product-formulation rows for ${kit.value.name}. I will not fall back to general hair knowledge for exact ingredients.`, sources: result.sources, toolCalls: [toolCall(result)], debug: input.debug ? { entityResolution: entityDebug } : undefined };
      const integrity = ingredientIntegrity(data, result.sources);
      const assumption = kit.confidence < 0.9 ? `Assuming you mean ${data.name}.\n\n` : "";
      const discrepancyText = integrity.discrepancyResult === "NO_ACTIVE_INGREDIENT_CONFLICT_DETECTED" ? "" : `\n\nDiscrepancy: ${integrity.discrepancyResult}. I am showing only verified rows from Complete formulation and not merging similar product names.`;
      const debug = input.debug ? { entityResolution: entityDebug, sourceIntegrity: integrity } : undefined;
      const items = data.products.flatMap((product) => product.ingredients.map((row) => `${product.productName}: ${ingredientLabel(row)}`));
      const requested = requestedIngredientTerm(understood.normalized);
      const requestedNorm = requested ? normalizedIngredient(requested) : undefined;
      const matchingRows = requestedNorm ? data.products.flatMap((product) => product.ingredients.filter((row) => normalizedIngredient(row.ingredientName).includes(requestedNorm)).map((row) => `${product.productName}: ${ingredientLabel(row)}`)) : [];
      const containmentText = requested ? (matchingRows.length ? `Yes. ${data.name} has verified product-level formulation rows containing ${requested}: ${matchingRows.join("; ")}.\n\n` : `The active Complete formulation rows for ${data.name} do not list ${requested}. I will not infer it from prose or similar product names.\n\n`) : "";
      return { ...base, action: "ANSWER", selectedAuthority: "STRUCTURED_CATALOGUE", answer: `${assumption}${containmentText}${data.name} has ${data.ingredientCount} verified product-level ingredient rows from Complete formulation.\n\n${formatKitIngredientFacts(data)} [1]${discrepancyText}${debugBlock(debug)}`, cards: [{ type: "composition", title: `${data.name} ingredients`, items }], sources: result.sources, toolCalls: [toolCall(result)], debug };
    }
    const data = result.data as KitCompositionData | undefined;
    if (result.status !== "ok" || !data) return { ...base, action: "ABSTAIN", selectedAuthority: "STRUCTURED_CATALOGUE", answer: `INSUFFICIENT_STRUCTURED_KIT_COMPOSITION: I could not find an active approved composition record for ${kit.value.name}. I will not fall back to general hair knowledge for exact kit contents.`, sources: result.sources, toolCalls: [toolCall(result)], debug: input.debug ? { entityResolution: entityDebug } : undefined };
    const items = data.components.map((item) => item.productName);
    const integrity = sourceIntegrity(data, result.sources);
    const requestedContain = understood.normalized.match(/\bcontain(?:s)?\s+([a-z0-9][a-z0-9\s+-]{1,40})\??$/);
    const requested = requestedContain?.[1]?.replace(/\b(ingredient|ingredients|product|products|kit)\b/g, "").trim();
    const exactComponentMatch = requested ? items.some((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, " ").includes(requested.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())) : false;
    const assumption = kit.confidence < 0.9 ? `Assuming you mean ${data.name}.\n\n` : "";
    const sourceText = result.sources.length ? " Source: active structured kit-product composition record [1]." : "";
    const discrepancyText = integrity.discrepancyResult === "NO_ACTIVE_COMPONENT_CONFLICT_DETECTED" ? "" : `\n\nDiscrepancy: ${integrity.discrepancyResult}. I am showing only verified active structured components.`;
    const containsText = requested ? (exactComponentMatch ? `Yes. The active structured composition record for ${data.name} includes ${requested} as a listed product component.` : `The active structured composition record for ${data.name} does not list ${requested} as a product component. Product-level active ingredient fields and strengths are not published here, so I cannot confirm ${requested} from unstructured prose.`) + "\n\n" : "";
    const debug = input.debug ? { entityResolution: entityDebug, sourceIntegrity: integrity } : undefined;
    return { ...base, action: "ANSWER", selectedAuthority: "STRUCTURED_CATALOGUE", answer: `${assumption}${containsText}${data.name} contains ${items.length} active approved product components: ${list(items)}. [1]\n\nThis is an exact structured composition lookup, not an individual recommendation.${sourceText}${discrepancyText}${debugBlock(debug)}`, cards: [{ type: "composition", title: data.name, items }], sources: result.sources, toolCalls: [toolCall(result)], debug };
  }

  if (understood.intent === "COMPARISON") {
    const kits = entities.filter((entity) => entity.type === "KIT");
    const products = entities.filter((entity) => entity.type === "PRODUCT");
    if (kits.length < 2 && products.length >= 2) {
      const result = await catalogue.compareProducts(products[0].value.name, products[1].value.name);
      const data = result.data as { left: string; right: string; leftKits: Array<string | { name: string }>; rightKits: Array<string | { name: string }>; exactFormulationAvailable: boolean } | undefined;
      if (result.status !== "ok" || !data) return { ...base, action: "ABSTAIN", selectedAuthority: "STRUCTURED_CATALOGUE", answer: "I could not find approved catalogue records for both products.", sources: result.sources, toolCalls: [toolCall(result)] };
      const names = (items: Array<string | { name: string }>) => items.map((item) => typeof item === "string" ? item : item.name);
      return { ...base, action: "ANSWER", selectedAuthority: "STRUCTURED_CATALOGUE", answer: `${data.left} appears in: ${list(names(data.leftKits))}.\n\n${data.right} appears in: ${list(names(data.rightKits))}. [1]\n\n${data.exactFormulationAvailable ? "Published formulation records were used where present." : "The workbook does not provide exact formulation fields for these products, so I am not inferring ingredient differences."}\n\nCatalogue differences do not show that one product is universally better.`, sources: uniqueSources(result.sources), toolCalls: [toolCall(result)] };
    }
    if (kits.length < 2) return { ...base, action: "CLARIFY", selectedAuthority: "STRUCTURED_CATALOGUE", answer: "Please name two kits or two products to compare. I will compare documented facts without claiming one is universally better." };
    const result = await catalogue.compareKits(kits[0].value.name, kits[1].value.name);
    const data = result.data as { left: string; right: string; shared: string[]; leftOnly: string[]; rightOnly: string[] } | undefined;
    if (result.status !== "ok" || !data) return { ...base, action: "ABSTAIN", selectedAuthority: "STRUCTURED_CATALOGUE", answer: "I could not find approved composition records for both kits.", sources: result.sources, toolCalls: [toolCall(result)] };
    return { ...base, action: "ANSWER", selectedAuthority: "STRUCTURED_CATALOGUE", answer: `${data.left} and ${data.right} share: ${list(data.shared)}.\n\nOnly in ${data.left}: ${list(data.leftOnly)}.\n\nOnly in ${data.right}: ${list(data.rightOnly)}. [1]\n\nThese are composition differences, not evidence that one kit is best for everyone.`, cards: [{ type: "comparison", title: `${data.left} vs ${data.right}`, shared: data.shared, leftOnly: data.leftOnly, rightOnly: data.rightOnly }], sources: result.sources, toolCalls: [toolCall(result)] };
  }

  if (understood.intent === "PRODUCT_LOOKUP" && entities[0]?.type === "PRODUCT") {
    const product = entities[0].value;
    const [facts, kits] = await Promise.all([catalogue.getProductFacts(product.name), catalogue.getKitsContainingProduct(product.name)]);
    const factData = facts.data as { name?: string; ingredients?: Array<{ name: string | null; quantity: number | null; unit: string | null }> } | undefined;
    const kitData = (kits.data ?? []) as Array<{ name: string }>;
    const ingredients = factData?.ingredients ?? [];
    return { ...base, action: "ANSWER", selectedAuthority: "STRUCTURED_CATALOGUE", answer: `${product.name} is a documented catalogue product. It appears in: ${list(kitData.map((kit) => kit.name))}. [1]\n\n${ingredients.length ? `Published exact ingredients: ${ingredients.map((item) => `${item.name ?? "unnamed"}${item.quantity == null ? "" : ` ${item.quantity}${item.unit ?? ""}`}`).join(", ")}.` : "The current workbook does not provide exact ingredient or formulation fields for this product, so I will not infer them."}`, sources: uniqueSources([...facts.sources, ...kits.sources]), toolCalls: [toolCall(facts), toolCall(kits)] };
  }

  if (understood.intent === "INGREDIENT_INFORMATION" && entities[0]?.type === "PRODUCT") {
    const product = entities[0].value;
    const result = await catalogue.getProductFacts(product.name);
    const data = result.data as { ingredients?: Array<{ name: string | null; quantity: number | null; unit: string | null; formulationText?: string | null }> } | undefined;
    const ingredients = data?.ingredients ?? [];
    return { ...base, action: ingredients.length ? "ANSWER" : "ABSTAIN", selectedAuthority: "STRUCTURED_CATALOGUE", answer: ingredients.length ? `${product.name} has these published exact ingredient records: ${ingredients.map((item) => `${item.name ?? "unnamed"}${item.quantity == null ? "" : ` ${item.quantity}${item.unit ?? ""}`}`).join(", ")}. [1]` : `The approved structured catalogue does not contain exact ingredient or formulation fields for ${product.name}. I will not infer them from the product name.`, sources: result.sources, toolCalls: [toolCall(result)] };
  }

  const filter = topicsFor(understood.intent);
  const retrieval = await knowledge.search({ text: understood.retrievalQuery, rewrittenQueries: understood.rewrittenQueries, domain: "HAIR", entityId: entities.find((entity) => entity.type === "KIT") ? canonicalFiveKitId(entities.find((entity) => entity.type === "KIT")!.value.name) : undefined, topics: filter.topics, systems: filter.systems, language: understood.language === "hi" ? "hi" : "en", limit: 5 });
  const urgent = understood.intent === "GENERAL_SAFETY" && /chest pain|faint|breathing|severe swelling|facial swelling/.test(understood.normalized);
  return {
    ...base, action: urgent ? "URGENT_ESCALATION" : retrieval.evidenceSufficient ? "ANSWER" : "ABSTAIN",
    selectedAuthority: urgent ? "SAFETY_POLICY" : "APPROVED_KNOWLEDGE",
    answer: urgent ? "Chest pain, fainting, trouble breathing, or severe facial swelling after a treatment can require urgent care. Stop using chat and seek emergency medical help now." : citedKnowledgeAnswer(retrieval),
    sources: urgent ? [] : knowledgeSources(retrieval), safetyFlags: urgent ? ["EMERGENCY", "ADVERSE_EVENT"] : [],
    toolCalls: [{ name: "retrieveApprovedKnowledge", status: retrieval.hits.length ? "ok" : "not_found", sourceIds: retrieval.hits.map((hit) => hit.id) }],
    retrieval: { strategy: retrieval.strategy, contradictions: retrieval.contradictions, evidenceSufficient: retrieval.evidenceSufficient, insufficiencyReasons: retrieval.insufficiencyReasons },
  };
}
