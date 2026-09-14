import type { SourceRef } from "./types";
import type { AnswerDepth, GeneralIntent, UnderstoodQuestion } from "./questionUnderstanding";

export type ResponseCard =
  | { type: "DirectAnswerCard"; answer: string; entity?: string; tone?: "neutral" | "positive" | "caution" }
  | { type: "KitSummaryCard"; title: string; items: string[]; detailItems?: string[]; interpretation?: string }
  | { type: "IngredientListCard"; title: string; items: string[]; detailItems?: string[]; totalItems?: number; primaryAction?: string }
  | { type: "MechanismCard"; title: string; items: string[]; detailItems?: string[] }
  | { type: "ClinicalRelevanceCard"; title: string; interpretation: string }
  | { type: "KitVariantCard"; title: string; items: string[]; detailItems?: string[] }
  | { type: "ComparisonCard"; title: string; shared: string[]; leftOnly: string[]; rightOnly: string[]; detailItems?: string[] }
  | { type: "LifestyleImpactCard"; title: string; items: string[]; detailItems?: string[]; interpretation?: string }
  | { type: "ConditionSummaryCard"; title: string; items: string[]; detailItems?: string[]; interpretation?: string }
  | { type: "EvidenceCard"; title: string; summary: string; strength?: string }
  | { type: "SourceDrawer"; sourceCount: number };

export type ResponseAction = { id: "MORE_DETAIL" | "EXPLAIN_MECHANISM" | "FULL_FORMULATION" | "COMPARE" | "SHOW_VARIANTS" | "SOURCES"; label: string; prompt?: string };

export type ResponsePlan = {
  intent: GeneralIntent;
  entity?: { id: string; name: string; type: "KIT" | "PRODUCT"; confidence: number };
  depth: AnswerDepth;
  evidenceLimit: number;
  visibleBulletLimit: 5;
  primaryCard: ResponseCard["type"];
  wordRange: { min: number; max: number };
};

export type ResponseValidation = { passed: boolean; regenerated: boolean; issues: string[] };

export type ResponsePresentation = {
  depth: AnswerDepth;
  directAnswer: string;
  cards: ResponseCard[];
  actions: ResponseAction[];
  validation: ResponseValidation;
};

type LegacyCard =
  | { type: "price"; title: string; amount: number; currency: string; status: string }
  | { type: "composition"; title: string; items: string[] }
  | { type: "comparison"; title: string; shared: string[]; leftOnly: string[]; rightOnly: string[] };

type PresentableResponse = { answer: string; action: string; cards: LegacyCard[]; sources: SourceRef[] };

const wordLimitFor = (depth: AnswerDepth) => depth === "QUICK" ? { min: 40, max: 100 } : depth === "EXPLAIN" ? { min: 100, max: 200 } : { min: 0, max: 800 };

function primaryCardFor(intent: GeneralIntent, normalized: string): ResponseCard["type"] {
  if (intent === "KIT_COMPOSITION" && /ingredient|formulation/.test(normalized)) return "IngredientListCard";
  if (intent === "KIT_COMPOSITION" || intent === "PRODUCT_LOOKUP" || intent === "KIT_OVERVIEW") return /variant/.test(normalized) ? "KitVariantCard" : "KitSummaryCard";
  if (intent === "KIT_MECHANISM" || intent === "MIXED_KIT_INFORMATION") return "MechanismCard";
  if (intent === "COMPARISON") return "ComparisonCard";
  if (intent === "LIFESTYLE_FACTOR_IMPACT") return "LifestyleImpactCard";
  if (intent === "CONDITION_EXPLANATION") return "ConditionSummaryCard";
  return "DirectAnswerCard";
}

export function planGeneralResponse(understood: UnderstoodQuestion): ResponsePlan {
  const entity = understood.entities[0];
  return {
    intent: understood.intent,
    entity: entity ? { id: entity.value.id, name: entity.value.name, type: entity.type, confidence: entity.confidence } : undefined,
    depth: understood.depth,
    evidenceLimit: understood.depth === "QUICK" ? 2 : understood.depth === "EXPLAIN" ? 4 : 7,
    visibleBulletLimit: 5,
    primaryCard: primaryCardFor(understood.intent, understood.normalized),
    wordRange: wordLimitFor(understood.depth),
  };
}

const withoutCitations = (value: string) => value.replace(/\s*\[\d+\]/g, "").replace(/\s+/g, " ").trim();
const words = (value: string) => value.trim().split(/\s+/).filter(Boolean);
const clampWords = (value: string, max: number) => {
  const tokens = words(value);
  return tokens.length <= max ? value.trim() : `${tokens.slice(0, max).join(" ").replace(/[,:;]$/, "")}.`;
};

function answerSections(answer: string) {
  const clean = answer.replace(/\n\nDebug:[\s\S]*$/, "").trim();
  const paragraphs = clean.split(/\n{2,}/).map(withoutCitations).filter(Boolean);
  const sentences = paragraphs.flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/)).map((item) => item.trim()).filter(Boolean);
  return { paragraphs, sentences };
}

function directAnswerFor(raw: PresentableResponse, plan: ResponsePlan): string {
  const { paragraphs, sentences } = answerSections(raw.answer);
  const entity = plan.entity?.name;
  if (raw.action !== "ANSWER") return clampWords(paragraphs[0] ?? raw.answer, plan.wordRange.max);
  if (plan.intent === "CATALOGUE_PRICE") return sentences[0] ?? raw.answer;
  if (plan.primaryCard === "IngredientListCard") {
    const total = raw.cards.find((card): card is Extract<LegacyCard, { type: "composition" }> => card.type === "composition")?.items.length;
    return `${entity ?? "This kit"} — ${total ? `${total} verified ingredient records are available.` : "verified formulation details are available."}`;
  }
  if (plan.intent === "LIFESTYLE_FACTOR_IMPACT") {
    const first = clampWords(sentences[0] ?? paragraphs[0] ?? raw.answer, 24);
    return first.toLowerCase().startsWith("yes") ? first : `YES — ${first.charAt(0).toLowerCase()}${first.slice(1)}`;
  }
  return clampWords(sentences[0] ?? paragraphs[0] ?? raw.answer, plan.depth === "QUICK" ? 32 : 55);
}

function sentenceItems(raw: PresentableResponse, directAnswer: string, limit: number, depth: AnswerDepth) {
  const { sentences, paragraphs } = answerSections(raw.answer);
  const relevantSentences = depth === "QUICK" && paragraphs[0]
    ? paragraphs[0].split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean)
    : sentences;
  const directNormalized = withoutCitations(directAnswer).toLowerCase();
  return relevantSentences.filter((sentence) => !directNormalized.includes(withoutCitations(sentence).toLowerCase())).slice(0, limit);
}

function clinicalInterpretation(items: string[]): { items: string[]; interpretation?: string } {
  const index = items.findIndex((item) => /should (?:not|be)|not automatically|aggravating factor|clinical relevance/i.test(item));
  if (index < 0) return { items };
  return { items: items.filter((_, itemIndex) => itemIndex !== index), interpretation: items[index] };
}

function actionsFor(plan: ResponsePlan, hasSources: boolean): ResponseAction[] {
  const actions: ResponseAction[] = [];
  if (plan.depth === "QUICK") actions.push({ id: "MORE_DETAIL", label: "More detail", prompt: "Explain this in more detail" });
  if (["KIT_OVERVIEW", "KIT_COMPOSITION", "MIXED_KIT_INFORMATION"].includes(plan.intent)) actions.push({ id: "EXPLAIN_MECHANISM", label: "Explain mechanism", prompt: `Explain how ${plan.entity?.name ?? "this"} works` });
  if (plan.primaryCard === "IngredientListCard") actions.push({ id: "FULL_FORMULATION", label: "Full formulation" });
  if (["KIT_OVERVIEW", "KIT_COMPOSITION", "PRODUCT_LOOKUP"].includes(plan.intent)) actions.push({ id: "COMPARE", label: "Compare", prompt: `Compare ${plan.entity?.name ?? "this"} with ` });
  if (plan.intent === "KIT_OVERVIEW") actions.push({ id: "SHOW_VARIANTS", label: "Show variants", prompt: `Show variants of ${plan.entity?.name ?? "this kit"}` });
  if (hasSources) actions.push({ id: "SOURCES", label: "Sources" });
  return actions.slice(0, 4);
}

function buildCards(raw: PresentableResponse, plan: ResponsePlan, directAnswer: string): ResponseCard[] {
  const cards: ResponseCard[] = [{ type: "DirectAnswerCard", answer: directAnswer, entity: plan.entity?.name, tone: raw.action === "ANSWER" ? "neutral" : "caution" }];
  const legacy = raw.cards[0];
  if (legacy?.type === "composition") {
    const visible = legacy.items.slice(0, plan.visibleBulletLimit);
    const detailItems = legacy.items.slice(plan.visibleBulletLimit);
    if (plan.primaryCard === "IngredientListCard") cards.push({ type: "IngredientListCard", title: legacy.title, items: visible, detailItems, totalItems: legacy.items.length });
    else if (plan.primaryCard === "KitVariantCard") cards.push({ type: "KitVariantCard", title: legacy.title, items: visible, detailItems });
    else if (plan.primaryCard === "MechanismCard") cards.push({ type: "MechanismCard", title: legacy.title, items: visible, detailItems });
    else cards.push({ type: "KitSummaryCard", title: legacy.title, items: visible, detailItems });
  } else if (legacy?.type === "comparison") {
    let remaining = plan.visibleBulletLimit;
    const visible = (items: string[]) => { const selected = items.slice(0, remaining); remaining -= selected.length; return selected; };
    const shared = visible(legacy.shared);
    const leftOnly = visible(legacy.leftOnly);
    const rightOnly = visible(legacy.rightOnly);
    cards.push({ type: "ComparisonCard", title: legacy.title, shared, leftOnly, rightOnly, detailItems: [...legacy.shared.slice(shared.length), ...legacy.leftOnly.slice(leftOnly.length), ...legacy.rightOnly.slice(rightOnly.length)] });
  } else if (!["DirectAnswerCard"].includes(plan.primaryCard)) {
    const itemWordLimit = plan.depth === "QUICK" ? 13 : plan.depth === "EXPLAIN" ? 26 : 60;
    const sentenceList = sentenceItems(raw, directAnswer, plan.depth === "QUICK" ? 5 : 7, plan.depth).map((item) => clampWords(item, itemWordLimit));
    const interpreted = clinicalInterpretation(sentenceList);
    const items = interpreted.items;
    const interpretation = interpreted.interpretation ? clampWords(interpreted.interpretation, plan.depth === "QUICK" ? 20 : 40) : undefined;
    const title = plan.entity?.name ?? (plan.intent === "LIFESTYLE_FACTOR_IMPACT" ? "Clinical impact" : "Clinical reference");
    if (plan.primaryCard === "KitSummaryCard") cards.push({ type: "KitSummaryCard", title, items: items.slice(0, 5), detailItems: items.slice(5), interpretation });
    if (plan.primaryCard === "KitVariantCard") cards.push({ type: "KitVariantCard", title, items: items.slice(0, 5), detailItems: items.slice(5) });
    if (plan.primaryCard === "MechanismCard") cards.push({ type: "MechanismCard", title, items: items.slice(0, 5), detailItems: items.slice(5) });
    if (plan.primaryCard === "LifestyleImpactCard") cards.push({ type: "LifestyleImpactCard", title, items: items.slice(0, 5), detailItems: items.slice(5), interpretation });
    if (plan.primaryCard === "ConditionSummaryCard") cards.push({ type: "ConditionSummaryCard", title, items: items.slice(0, 5), detailItems: items.slice(5), interpretation });
  }
  if (raw.sources.length) cards.push({ type: "SourceDrawer", sourceCount: raw.sources.length });
  return cards;
}

function validate(plan: ResponsePlan, raw: PresentableResponse, directAnswer: string, cards: ResponseCard[]): ResponseValidation {
  const issues: string[] = [];
  if (!directAnswer.trim()) issues.push("DIRECT_ANSWER_MISSING");
  if (words(directAnswer).length > plan.wordRange.max) issues.push("DIRECT_ANSWER_TOO_LONG");
  const visibleLists = cards.flatMap((card) => "items" in card && Array.isArray(card.items) ? [card.items] : []);
  if (visibleLists.reduce((total, items) => total + items.length, 0) > plan.visibleBulletLimit) issues.push("VISIBLE_BULLET_LIMIT_EXCEEDED");
  const visibleText = cards.flatMap((card) => {
    if (card.type === "DirectAnswerCard") return [card.answer];
    if (card.type === "ComparisonCard") return [...card.shared, ...card.leftOnly, ...card.rightOnly];
    if (card.type === "ClinicalRelevanceCard") return [card.interpretation];
    if (card.type === "EvidenceCard") return [card.summary];
    if ("items" in card) {
      // `interpretation` is present on KitSummaryCard but not on every card
      // that has `items`; test for it rather than assuming the union.
      const interpretation = "interpretation" in card ? card.interpretation : undefined;
      return [...card.items, ...(interpretation ? [interpretation] : [])];
    }
    return [];
  }).join(" ");
  if (plan.depth !== "DEEP_DIVE" && words(visibleText).length > plan.wordRange.max) issues.push("VISIBLE_RESPONSE_TOO_LONG");
  if (["KIT_COMPOSITION", "KIT_OVERVIEW", "KIT_MECHANISM", "MIXED_KIT_INFORMATION"].includes(plan.intent) && !plan.entity) issues.push("RESOLVED_ENTITY_MISSING");
  if (raw.action === "ANSWER" && !raw.sources.length && !["GENERAL_SAFETY"].includes(plan.intent)) issues.push("ANSWER_SOURCE_MISSING");
  return { passed: issues.length === 0, regenerated: issues.some((issue) => ["DIRECT_ANSWER_TOO_LONG", "VISIBLE_BULLET_LIMIT_EXCEEDED", "VISIBLE_RESPONSE_TOO_LONG"].includes(issue)), issues };
}

export function presentGeneralResponse(raw: PresentableResponse, understood: UnderstoodQuestion): { plan: ResponsePlan; presentation: ResponsePresentation } {
  const plan = planGeneralResponse(understood);
  const directAnswer = directAnswerFor(raw, plan);
  const cards = buildCards(raw, plan, directAnswer);
  return { plan, presentation: { depth: plan.depth, directAnswer, cards, actions: actionsFor(plan, raw.sources.length > 0), validation: validate(plan, raw, directAnswer, cards) } };
}
