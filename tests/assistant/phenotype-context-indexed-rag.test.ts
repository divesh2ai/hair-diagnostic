import { describe, expect, it } from "vitest";
import { GeneralConversationStore } from "../../src/packages/assistant-core/conversationContext";
import { runGeneralAssistant } from "../../src/packages/assistant-core/generalEngine";
import { ManifestGeneralCatalogue } from "../../src/packages/assistant-core/generalCatalogue";
import { InflammationPhenotypeIndexedRetriever } from "../../src/packages/assistant-core/hybridRetrieval";
import { FIVE_KIT_CONTROLLED_KNOWLEDGE } from "../../src/packages/assistant-core/fiveKitKnowledge";
import { findCatalogueKit } from "../../src/packages/assistant-core/fullCatalogue";
import { getKitIngredientFacts } from "../../src/packages/assistant-core/productFormulations";

describe("Inflammation Phenotype continuous indexed conversation", () => {
  it("governs every verified ingredient without inventing missing rationale", () => {
    const kit = findCatalogueKit("Inflammation Phenotype");
    expect(kit).toBeDefined();
    const verified = new Set(getKitIngredientFacts(kit!).products.flatMap((product) => product.ingredients.map((row) => row.ingredientName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())));
    const records = FIVE_KIT_CONTROLLED_KNOWLEDGE.filter((entry) => entry.metadata?.canonicalEntity === "KIT_INFLAMMATION_PHENOTYPE" && entry.metadata?.taxonomyDomain === "INGREDIENT");
    const recorded = new Set(records.map((entry) => entry.metadata?.ingredient?.toLowerCase().replaceAll("_", " ")));
    for (const ingredient of verified) expect(recorded.has(ingredient) || (ingredient.includes("n acetyl") && recorded.has("nac")), ingredient).toBe(true);
    for (const record of records.filter((entry) => entry.metadata?.contentType === "INGREDIENT_LIST")) {
      expect(record.metadata?.role).toBe("NOT_DOCUMENTED");
      expect(record.metadata?.pathway).toBe("NOT_DOCUMENTED");
      expect(record.metadata?.kitSpecificRationale).toBe("NOT_DOCUMENTED");
    }
  });

  it("inherits server-owned context across the required ten turns", async () => {
    const catalogue = new ManifestGeneralCatalogue();
    const knowledge = new InflammationPhenotypeIndexedRetriever();
    const store = new GeneralConversationStore();
    const conversationId = crypto.randomUUID();
    const questions = [
      "What is Inflammation Phenotype?",
      "Why is NAC included?",
      "What other ingredients support oxidative stress control?",
      "What pathways does this kit target?",
      "Patient smokes heavily — is that relevant to this phenotype?",
      "What clinical factors should I assess?",
      "Explain the kit in 5 bullets.",
      "Give me the complete formulation rationale.",
      "What source are you using?",
      "What is the current price?",
    ];
    const expectedIntents = ["KIT_OVERVIEW", "INGREDIENT_RATIONALE", "INGREDIENT_RATIONALE", "KIT_PATHWAYS", "LIFESTYLE_FACTOR_IMPACT", "KIT_CLINICAL_RELEVANCE", "KIT_SUMMARY", "FORMULATION_RATIONALE", "SOURCE_INSPECTION", "CATALOGUE_PRICE"];
    const responses = [];

    for (const question of questions) {
      const context = store.get(conversationId);
      const response = await runGeneralAssistant({ query: question, context }, catalogue, knowledge);
      store.set(conversationId, {
        ...context,
        activeProductFamily: response.resolvedEntity ?? context.activeProductFamily,
        activeIngredient: response.resolvedIngredient ?? context.activeIngredient,
        activeLifestyleFactor: response.resolvedLifestyleFactor ?? context.activeLifestyleFactor,
        previousSources: response.intent === "SOURCE_INSPECTION" ? context.previousSources : response.sources,
        updatedAt: Date.now(),
      });
      responses.push(response);
    }

    expect(responses.map((response) => response.intent)).toEqual(expectedIntents);
    expect(store.get(conversationId).activeProductFamily).toBe("KIT_INFLAMMATION_PHENOTYPE");
    for (const [index, response] of responses.entries()) {
      expect(response.resolvedEntity, `turn ${index + 1}`).toBe("KIT_INFLAMMATION_PHENOTYPE");
      if (index > 0) expect(response.inheritedContext, `turn ${index + 1}`).toBe(true);
    }
    for (const index of [0, 1, 2, 3, 4, 5, 6, 7]) expect(responses[index].retrieval?.strategy, `turn ${index + 1}`).toBe("INDEXED_RAG");
    expect(responses[1].resolvedIngredient).toBe("NAC");
    expect(responses[1].answer).toMatch(/oxidative protection/i);
    expect(responses[2].answer).toMatch(/Curcumin|Resveratrol/i);
    expect(responses[3].answer).toMatch(/cytokine control/i);
    expect(responses[4].resolvedLifestyleFactor).toBe("SMOKING");
    expect(responses[4].answer).toMatch(/does not automatically select|does not automatically trigger/i);
    expect(responses[4].sources.length).toBeGreaterThanOrEqual(2);
    expect(responses[6].answer.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(5);
    expect(responses[7].answer).toMatch(/does not assign a complete individual mechanism|does not provide a more specific/i);
    expect(responses[8].toolCalls).toHaveLength(0);
    expect(responses[8].sources).toEqual(responses[7].sources);
    expect(responses[9].action).toBe("ABSTAIN");
    expect(responses[9].answer).toMatch(/does not contain a current published MRP|will not infer/i);
  });
});
