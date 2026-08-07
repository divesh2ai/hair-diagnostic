import { describe, expect, it } from "vitest";
import { ManifestGeneralCatalogue } from "../../src/packages/assistant-core/generalCatalogue";
import { runGeneralAssistant } from "../../src/packages/assistant-core/generalEngine";
import { StaticApprovedKnowledgeRetriever } from "../../src/packages/assistant-core/hybridRetrieval";

const catalogue = new ManifestGeneralCatalogue();
const knowledge = new StaticApprovedKnowledgeRetriever();
const ask = (query: string) => runGeneralAssistant({ query, debug: true }, catalogue, knowledge);
const unrelated = /topical|minoxidil|pregnancy|cardiovascular|heart history|onion juice/i;

describe("controlled five-kit RAG required scenarios", () => {
  it("answers Inflammation Phenotype ingredients from structured formulation records", async () => {
    const response = await ask("What are the ingredients of Inflammation Phenotype?");
    expect(response.intent).toBe("KIT_COMPOSITION");
    expect(response.toolCalls[0]).toMatchObject({ name: "getKitIngredientFacts", status: "ok" });
    expect(response.answer).toContain("Inflammation Phenotype has 101 verified product-level ingredient rows from Complete formulation");
    expect(response.answer).toContain("Curcumin 250 Mg");
    expect(response.sources.every((source) => source.label === "MRP sheet fluence khushal's copy.xlsx / Complete formulation")).toBe(true);
    expect(response.answer).not.toMatch(unrelated);
    expect(response.answer).not.toMatch(/INR|₹|current published MRP|price records|selling price|doctor price/i);
  });

  it("answers inside/composition questions from kit-product composition records", async () => {
    const response = await ask("What is inside phenotype inflammation?");
    expect(response.intent).toBe("KIT_COMPOSITION");
    expect(response.toolCalls[0]).toMatchObject({ name: "getKitComposition", status: "ok" });
    expect(response.answer).toContain("Inflammation Phenotype contains 8 active approved product components");
    expect(response.answer).toContain("F-CUMIKIN");
    expect(response.sources.every((source) => source.label === "Kits & Product.xlsx / Sheet2.composition")).toBe(true);
    expect(response.answer).not.toMatch(unrelated);
  });

  it("answers kit mechanism questions with scoped kit knowledge", async () => {
    const response = await ask("Explain how Inflammation Phenotype works.");
    expect(response.intent).toBe("KIT_MECHANISM");
    expect(response.action).toBe("ANSWER");
    expect(response.toolCalls[0]).toMatchObject({ name: "retrieveApprovedKnowledge", status: "ok" });
    expect(response.answer).toContain("Inflammation Phenotype is the five-kit pilot family");
    expect(response.answer).toContain("exact ingredient answers must use the structured formulation workbook");
    expect(response.sources[0]?.label).toContain("PHENOTYPE INFLAMMATION");
    expect(response.answer).not.toMatch(unrelated);
  });

  it("resolves base Meta-B identity without resolving to IR 5", async () => {
    const response = await ask("What is Meta-B?");
    expect(response.intent).toBe("KIT_OVERVIEW");
    expect(response.debug?.entityResolution?.resolvedEntityId).toBe("KIT_PRO_FACT_META_B");
    expect(response.answer).toContain("official standalone base kit");
    expect(response.answer).toContain("not to IR 5");
    expect(response.sources.some((source) => source.label.includes("Canonical Meta B identity decision"))).toBe(true);
  });

  it("lists Meta-B variants including IR 5 without inheriting composition", async () => {
    const response = await ask("What variants are under Meta-B?");
    expect(response.intent).toBe("KIT_OVERVIEW");
    expect(response.answer).toContain("PRO FACT META B PCOS");
    expect(response.answer).toContain("PRO FACT META B THYROID");
    expect(response.answer).toContain("PRO FACT META B MENOPAUSE");
    expect(response.answer).toContain("Meta-B IR 5");
    expect(response.answer).toContain("does not currently contain an active structured composition record for Meta-B IR 5");
  });

  it("explains Meta-B IR 5 as a distinct variant identity", async () => {
    const response = await ask("Explain Meta-B IR 5.");
    expect(response.intent).toBe("KIT_MECHANISM");
    expect(response.debug?.entityResolution?.resolvedEntityId).toBe("KIT_PRO_FACT_META_B_IR5");
    expect(response.answer).toContain("Meta-B IR 5 is handled as a Meta-B-family variant identity");
    expect(response.answer).toContain("must not be inherited from PRO FACT META B");
    expect(response.sources[0]?.label).toContain("Meta-B IR 5 variant identity");
  });

  it.each([
    ["Does smoking affect hair?", "LIFESTYLE_FACTOR_IMPACT", "Smoking or heavy tobacco exposure", "Smoking and hair"],
    ["Patient smokes heavily; what should I assess?", "LIFESTYLE_FACTOR_IMPACT", "The doctor should assess exposure level", "Smoking and hair"],
    ["Can alcohol worsen hair fall?", "LIFESTYLE_FACTOR_IMPACT", "Heavy or frequent alcohol intake", "Alcohol and hair"],
    ["What is telogen effluvium?", "CONDITION_EXPLANATION", "Telogen effluvium is a shedding-pattern concept", "Telogen effluvium"],
    ["How does gut health affect hair?", "CONDITION_EXPLANATION", "Gut-health signals can be relevant", "Gut health and hair"],
  ])("answers controlled topic scenario: %s", async (query, intent, expectedText, sourceSection) => {
    const response = await ask(query);
    expect(response.intent).toBe(intent);
    expect(response.action).toBe("ANSWER");
    expect(response.toolCalls[0]).toMatchObject({ name: "retrieveApprovedKnowledge", status: "ok" });
    expect(response.answer).toContain(expectedText);
    expect(response.sources.some((source) => source.label.includes(sourceSection))).toBe(true);
    expect(response.answer).not.toMatch(unrelated);
    expect(response.answer).not.toMatch(/INR|₹|current published MRP|price records|selling price|doctor price/i);
  });

  it("compares Pro Immune Gold and Inflammation Phenotype using structured kit records", async () => {
    const response = await ask("Compare Pro Immune Gold and Inflammation Phenotype.");
    expect(response.intent).toBe("COMPARISON");
    expect(response.action).toBe("ANSWER");
    expect(response.toolCalls[0]).toMatchObject({ name: "compareKits", status: "ok" });
    expect(response.answer).toContain("PRO IMMUNE GOLD");
    expect(response.answer).toContain("Inflammation Phenotype");
    expect(response.answer).toContain("not evidence that one kit is best for everyone");
    expect(response.answer).not.toMatch(unrelated);
    expect(response.answer).not.toMatch(/INR|₹|current published MRP|price records|selling price|doctor price/i);
  });
});