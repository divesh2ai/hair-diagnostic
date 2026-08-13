import { describe, expect, it } from "vitest";
import { ManifestGeneralCatalogue } from "../../src/packages/assistant-core/generalCatalogue";
import { runGeneralAssistant } from "../../src/packages/assistant-core/generalEngine";
import { StaticApprovedKnowledgeRetriever } from "../../src/packages/assistant-core/hybridRetrieval";
import { understandQuestion } from "../../src/packages/assistant-core/questionUnderstanding";

const catalogue = new ManifestGeneralCatalogue();
const knowledge = new StaticApprovedKnowledgeRetriever();

describe("doctor response planning", () => {
  it.each([
    ["Ingredients of Phenotype Inflammation", "QUICK"],
    ["Explain why smoking can affect hair", "EXPLAIN"],
    ["Give me a deep dive with the full formulation", "DEEP_DIVE"],
  ] as const)("infers depth before retrieval: %s", (query, depth) => {
    expect(understandQuestion(query).depth).toBe(depth);
  });

  it("keeps formulation detail behind progressive disclosure", async () => {
    const response = await runGeneralAssistant({ query: "Ingredients of Phenotype Inflammation" }, catalogue, knowledge);
    expect(response.responsePlan).toMatchObject({ depth: "QUICK", primaryCard: "IngredientListCard", evidenceLimit: 2, visibleBulletLimit: 5 });
    expect(response.presentation?.cards[0]).toMatchObject({ type: "DirectAnswerCard" });
    const ingredients = response.presentation?.cards.find((card) => card.type === "IngredientListCard");
    expect(ingredients?.type).toBe("IngredientListCard");
    if (ingredients?.type !== "IngredientListCard") throw new Error("IngredientListCard missing");
    expect(ingredients.items).toHaveLength(5);
    expect(ingredients.detailItems?.length).toBeGreaterThan(5);
    expect(response.presentation?.actions.map((action) => action.id)).toContain("FULL_FORMULATION");
    expect(response.presentation?.validation).toEqual({ passed: true, regenerated: false, issues: [] });
  });

  it("uses an intent-specific lifestyle card and attaches sources", async () => {
    const response = await runGeneralAssistant({ query: "Patient smokes heavily, will it impact hair?" }, catalogue, knowledge);
    expect(response.intent).toBe("LIFESTYLE_FACTOR_IMPACT");
    expect(response.presentation?.depth).toBe("QUICK");
    expect(response.presentation?.cards.some((card) => card.type === "LifestyleImpactCard")).toBe(true);
    expect(response.presentation?.cards.at(-1)).toMatchObject({ type: "SourceDrawer" });
    expect(response.presentation?.cards.flatMap((card) => "items" in card ? card.items : []).length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(response.presentation)).not.toMatch(/alcohol|drinking/i);
    expect(response.presentation?.directAnswer).toMatch(/^YES —/);
  });

  it("caps comparison bullets across the whole default card", async () => {
    const response = await runGeneralAssistant({ query: "Compare Pro Immune Gold and Inflammation Phenotype" }, catalogue, knowledge);
    const comparison = response.presentation?.cards.find((card) => card.type === "ComparisonCard");
    if (comparison?.type !== "ComparisonCard") throw new Error("ComparisonCard missing");
    expect(comparison.shared.length + comparison.leftOnly.length + comparison.rightOnly.length).toBeLessThanOrEqual(5);
    expect(response.presentation?.validation.passed).toBe(true);
  });

  it("selects summary and mechanism cards for kit intents", async () => {
    const summary = await runGeneralAssistant({ query: "What is Inflammation Phenotype?" }, catalogue, knowledge);
    const mechanism = await runGeneralAssistant({ query: "Explain how Inflammation Phenotype works" }, catalogue, knowledge);
    expect(summary.presentation?.cards.some((card) => card.type === "KitSummaryCard")).toBe(true);
    expect(mechanism.presentation?.cards.some((card) => card.type === "MechanismCard")).toBe(true);
  });
});
