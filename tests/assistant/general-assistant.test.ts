import { describe, expect, it } from "vitest";
import { FULL_CATALOGUE, findCatalogueKit, findCatalogueProduct } from "../../src/packages/assistant-core/fullCatalogue";
import { ManifestGeneralCatalogue } from "../../src/packages/assistant-core/generalCatalogue";
import { runGeneralAssistant } from "../../src/packages/assistant-core/generalEngine";
import { StaticApprovedKnowledgeRetriever } from "../../src/packages/assistant-core/hybridRetrieval";
import { understandQuestion } from "../../src/packages/assistant-core/questionUnderstanding";

const catalogue = new ManifestGeneralCatalogue();
const knowledge = new StaticApprovedKnowledgeRetriever();
const ask = (query: string, history: Array<{ role: "user" | "assistant"; content: string }> = []) => runGeneralAssistant({ query, history }, catalogue, knowledge);
const askDebug = (query: string) => runGeneralAssistant({ query, debug: true }, catalogue, knowledge);

describe("full catalogue manifest", () => {
  it("contains the complete workbook extraction without inferred fields", () => {
    expect(FULL_CATALOGUE.kits).toHaveLength(35);
    expect(FULL_CATALOGUE.products).toHaveLength(41);
    expect(FULL_CATALOGUE.kits.reduce((sum, kit) => sum + kit.components.length, 0)).toBe(274);
    expect(FULL_CATALOGUE.kits.every((kit) => kit.mrp === null && kit.schedule === null)).toBe(true);
    expect(FULL_CATALOGUE.products.every((product) => product.mrp === null && product.formulation === null && product.ingredientText === null)).toBe(true);
    expect(FULL_CATALOGUE.kits.flatMap((kit) => kit.components).every((item) => item.schedule === null && item.formulation === null)).toBe(true);
  });

  for (const kit of FULL_CATALOGUE.kits) it(`resolves kit: ${kit.name}`, () => expect(findCatalogueKit(kit.name)?.id).toBe(kit.id));
  for (const product of FULL_CATALOGUE.products) it(`resolves product: ${product.name}`, () => expect(findCatalogueProduct(product.name)?.id).toBe(product.id));

  it("normalises aliases and a nearby spelling mistake", () => {
    expect(findCatalogueKit("Hair Fact TE Goldd")?.name).toMatch(/TE GOLD/i);
    expect(findCatalogueProduct("F Trichorise")?.name).toMatch(/TRICHORISE/i);
  });

  it("resolves generic and alias Meta B queries to the standalone base kit", () => {
    expect(findCatalogueKit("Meta B")?.id).toBe("KIT_PRO_FACT_META_B");
    expect(findCatalogueKit("Profact Meta B")?.id).toBe("KIT_PRO_FACT_META_B");
    expect(findCatalogueKit("Meta B")?.name).toBe("PRO FACT META B");
    expect(findCatalogueKit("Meta B")?.name).not.toMatch(/IR\s*5/i);
  });

  it("keeps Meta B variants distinct canonical entities", () => {
    expect(findCatalogueKit("Meta B PCOS")?.id).toBe("KIT_PRO_FACT_META_B_PCOS");
    expect(findCatalogueKit("Meta B Thyroid")?.id).toBe("KIT_PRO_FACT_META_B_THYROID");
    expect(findCatalogueKit("Meta B Menopause")?.id).toBe("KIT_PRO_FACT_META_B_MENOPAUSE");
  });
});

describe("general question understanding", () => {
  it("understands Hinglish", () => {
    const result = understandQuestion("Baal kyu jhad rahe hain?");
    expect(result.language).toBe("hinglish");
    expect(result.intent).toBe("HAIR_EDUCATION");
    expect(result.normalized).toContain("hair");
  });

  it("understands common Devanagari hair terms", () => {
    const result = understandQuestion("बाल क्यों झड़ना शुरू हुए?");
    expect(result.language).toBe("hi");
    expect(result.normalized).toContain("hair");
    expect(result.normalized).toContain("shedding");
  });

  it("normalises common treatment spelling mistakes", () => expect(understandQuestion("what is minoxydil").intent).toBe("TOPICAL_INFORMATION"));

  it("carries a bounded follow-up topic", () => {
    const result = understandQuestion("What about its ingredients?", [{ role: "user", content: "Tell me about F-TRICHORISE" }]);
    expect(result.usedFollowUpContext).toBe(true);
    expect(result.entities.some((entity) => entity.type === "PRODUCT" && /TRICHORISE/i.test(entity.value.name))).toBe(true);
  });
});

describe("general hair assistant evaluation", () => {
  it("answers broad hair education with patient-published citations", async () => {
    const response = await ask("Why can hair shed after stress?");
    expect(response.mode).toBe("GENERAL_KNOWLEDGE");
    expect(response.action).toBe("ANSWER");
    expect(response.sources.length).toBeGreaterThan(0);
    expect(response.sources.every((source) => source.approvalStatus === "PUBLISHED_PATIENT")).toBe(true);
  });

  it("answers Hinglish hair education", async () => {
    const response = await ask("Baal stress ke baad kyu jhadte hain?");
    expect(response.action).toBe("ANSWER");
    expect(response.detectedLanguage).toBe("hinglish");
  });

  it("looks up an exact kit composition with a structured tool", async () => {
    const response = await ask("What comes in Hair Fact TE Gold?");
    expect(response.action).toBe("ANSWER");
    expect(response.selectedAuthority).toBe("STRUCTURED_CATALOGUE");
    expect(response.toolCalls[0].name).toBe("getKitComposition");
    expect(response.sources.every((source) => source.sourceType === "STRUCTURED_FIELD")).toBe(true);
  });

  it("resolves generic Meta B composition to the standalone base kit", async () => {
    const response = await ask("What does Meta B contain?");
    expect(response.action).toBe("ANSWER");
    expect(response.answer).toContain("PRO FACT META B contains");
    expect(response.answer).toContain("F-EASME");
  });

  it("does not invent an MRP absent from the workbook", async () => {
    const response = await ask("What is the current MRP of Hair Fact TE Gold?");
    expect(response.action).toBe("ABSTAIN");
    expect(response.answer).toContain("does not contain a current published MRP");
  });

  it("does not invent product ingredients absent from structured fields", async () => {
    const response = await ask("What are the ingredients in F-TRICHORISE?");
    expect(response.action).toBe("ABSTAIN");
    expect(response.answer).toContain("will not infer");
  });

  it("compares kits without universal-better language", async () => {
    const response = await ask("Compare Hair Fact TE Gold versus Pro Fact GI Health Gold");
    expect(response.action).toBe("ANSWER");
    expect(response.answer).toContain("not evidence that one kit is best for everyone");
  });

  it("compares products using only documented catalogue facts", async () => {
    const duplicateSourceCatalogue = new (class extends ManifestGeneralCatalogue {
      override async compareProducts(left: string, right: string) {
        const result = await super.compareProducts(left, right);
        return { ...result, sources: [...result.sources, ...result.sources] };
      }
    })();
    const response = await runGeneralAssistant({ query: "Compare F-TRICHORISE and F-TRICHO STRONG" }, duplicateSourceCatalogue, knowledge);
    expect(response.action).toBe("ANSWER");
    expect(response.toolCalls[0].name).toBe("compareProducts");
    expect(response.answer).toContain("not inferring ingredient differences");
    expect(new Set(response.sources.map((source) => `${source.sourceId}:${source.field ?? ""}`)).size).toBe(response.sources.length);
  });

  it("does not inherit exact composition across Meta B variants", async () => {
    const base = await catalogue.getKitComposition("Meta B");
    const pcos = await catalogue.getKitComposition("Meta B PCOS");
    expect(base.status).toBe("ok");
    expect(pcos.status).toBe("ok");
    const baseProducts = (base.data as { components: Array<{ productName: string }> }).components.map((item) => item.productName);
    const pcosProducts = (pcos.data as { components: Array<{ productName: string }> }).components.map((item) => item.productName);
    expect(baseProducts).toContain("F-EASME");
    expect(pcosProducts).toContain("F-NAT-TX");
    expect(pcosProducts).not.toContain("F-EASME");
  });

  it("keeps Ayurveda disabled and outside Hair retrieval", async () => {
    const response = await ask("What does Ayurveda say about hair health?");
    expect(response.action).toBe("ABSTAIN");
    expect(response.answer).toContain("not active");
    expect(response.answer).toContain("focuses on Hair");
    expect(response.sources).toHaveLength(0);
    expect(response.toolCalls).toHaveLength(0);
  });

  it.each(["Tell me about acne", "What helps knee pain?"])("keeps future domains outside Hair retrieval: %s", async (query) => {
    const response = await ask(query);
    expect(response.action).toBe("ABSTAIN");
    expect(response.answer).toContain("future Dr. FACT domain");
    expect(response.sources).toHaveLength(0);
  });

  it("answers topical questions without individual dosing", async () => {
    const response = await ask("What is minoxydil used for?");
    expect(response.action).toBe("ANSWER");
    expect(response.answer.toLowerCase()).toContain("minoxidil");
    expect(response.answer).toContain("Do not start, stop or change strength");
  });

  it("answers general nutrition and lifestyle questions", async () => {
    const response = await ask("Can low protein or rapid weight loss affect hair?");
    expect(response.action).toBe("ANSWER");
    expect(response.answer.toLowerCase()).toContain("protein");
  });

  it("refuses diagnosis", async () => {
    const response = await ask("Do I have alopecia?");
    expect(response.action).toBe("ABSTAIN");
    expect(response.answer).toContain("cannot diagnose");
  });

  it("refuses dosage or treatment changes", async () => {
    const response = await ask("Should I double my minoxidil dose?");
    expect(response.action).toBe("ESCALATE");
    expect(response.safetyFlags).toContain("DOSAGE_CHANGE");
  });

  it("does not select a patient-specific Meta B variant", async () => {
    const response = await ask("Which Meta B should I take?");
    expect(response.action).toBe("CLARIFY");
    expect(response.selectedAuthority).toBe("SAFETY_POLICY");
    expect(response.answer).toContain("deterministic clinical engine");
  });

  it("routes personal-plan intent to explicit authenticated mode without reading data", async () => {
    const response = await ask("Explain my doctor-approved treatment plan");
    expect(response.action).toBe("CLARIFY");
    expect(response.selectedAuthority).toBe("AUTHENTICATED_PERSONAL_PLAN");
    expect(response.toolCalls).toHaveLength(0);
    expect(response.sources).toHaveLength(0);
  });

  it("escalates emergency symptoms", async () => {
    const response = await ask("I have chest pain and fainting after a hair treatment");
    expect(response.action).toBe("URGENT_ESCALATION");
    expect(response.safetyFlags).toContain("EMERGENCY");
  });
});

describe("five-kit exact composition routing", () => {
  const unrelatedFallbackTerms = /topical|minoxidil|nutrition|pregnancy|cardiovascular|heart history/i;
  const phenotypeProducts = ["F-CUMIKIN", "F-TRICHOGROW+", "F-NICO R-M", "F-SPRIRULUX", "F-IMMUSurge", "F-RESVA-M", "FC-NOURISH", "F-SOLSHINE TABLETS"];
  const phenotypeIngredientSamples = ["F-CUMIKIN:", "Curcumin 250 Mg", "N-Acetyl Cysteine 400Mg", "F-RESVA-M:", "Resveratrol 250 Mg", "F-SOLSHINE TABLETS:", "Vitamin D3 600IU"];

  it.each([
    "What are the ingredients of Phenotype Inflammation?",
    "ingredients of phenotype inflammation",
    "ingredients of inflammation phenotype",
    "pro fact inflammation ingredients",
    "Ingredients of inflammation phenotype",
  ])("routes Phenotype Inflammation ingredient questions through Complete formulation: %s", async (query) => {
    const understood = understandQuestion(query);
    expect(understood.intent).toBe("KIT_COMPOSITION");
    expect(understood.entities[0]?.type).toBe("KIT");
    expect(understood.entities[0]?.value.id).toBe("KIT_INFLAMMATION_PHENOTYPE");

    const response = await ask(query);
    expect(response.intent).toBe("KIT_COMPOSITION");
    expect(response.action).toBe("ANSWER");
    expect(response.selectedAuthority).toBe("STRUCTURED_CATALOGUE");
    expect(response.toolCalls.map((call) => call.name)).toEqual(["getKitIngredientFacts"]);
    expect(response.cards[0]).toMatchObject({ type: "composition", title: "Inflammation Phenotype ingredients" });
    expect(response.answer).toContain("Inflammation Phenotype has 101 verified product-level ingredient rows from Complete formulation");
    for (const item of phenotypeIngredientSamples) expect(response.answer).toContain(item);
    expect(response.answer).not.toMatch(unrelatedFallbackTerms);
    expect(response.answer).not.toMatch(/MRP|INR|price/i);
    expect(response.sources.length).toBeGreaterThan(0);
    expect(response.sources.every((source) => source.sourceType === "STRUCTURED_FIELD" && source.label === "MRP sheet fluence khushal's copy.xlsx / Complete formulation" && source.version === 1 && source.approvalStatus === "PUBLISHED")).toBe(true);
  });

  it.each([
    "phenotype inflamation composition",
    "what is inside inflammation kit",
    "anti inflammatory phenotype kit",
    "What is inside the phenotype inflammation kit?",
    "Composition of Pro Fact Inflammation Phenotype",
  ])("routes Phenotype Inflammation product-composition questions through kit composition: %s", async (query) => {
    const response = await ask(query);
    expect(response.intent).toBe("KIT_COMPOSITION");
    expect(response.action).toBe("ANSWER");
    expect(response.selectedAuthority).toBe("STRUCTURED_CATALOGUE");
    expect(response.toolCalls.map((call) => call.name)).toEqual(["getKitComposition"]);
    expect(response.cards[0]).toMatchObject({ type: "composition", title: "Inflammation Phenotype", items: phenotypeProducts });
    expect(response.answer).toContain("8 active approved product components");
    for (const item of phenotypeProducts) expect(response.answer).toContain(item);
    expect(response.answer).not.toMatch(unrelatedFallbackTerms);
    expect(response.answer).not.toMatch(/MRP|INR|price/i);
  });

  it("answers NAC containment from verified formulation rows, not prose", async () => {
    const response = await ask("Does Phenotype Inflammation contain NAC?");
    expect(response.intent).toBe("KIT_COMPOSITION");
    expect(response.selectedAuthority).toBe("STRUCTURED_CATALOGUE");
    expect(response.toolCalls.map((call) => call.name)).toEqual(["getKitIngredientFacts"]);
    expect(response.answer).toContain("Yes. Inflammation Phenotype has verified product-level formulation rows containing nac");
    expect(response.answer).toContain("F-CUMIKIN: N-Acetyl Cysteine 400Mg");
    expect(response.answer).toContain("F-SOLSHINE TABLETS: N-Acetyl Cysteine 200 Mg");
    expect(response.answer).not.toMatch(unrelatedFallbackTerms);
    expect(response.answer).not.toMatch(/MRP|INR|price/i);
  });

  it("reports ingredient source integrity in debug mode", async () => {
    const response = await askDebug("What are ingredients of phenotype Inflammation");
    expect(response.debug?.entityResolution).toMatchObject({
      resolvedProduct: "Inflammation Phenotype",
      resolvedEntityId: "KIT_INFLAMMATION_PHENOTYPE",
      confidence: 0.97,
      method: "EXACT_ALIAS",
      matchedAlias: "Phenotype Inflammation",
    });
    expect(response.debug?.sourceIntegrity).toMatchObject({
      checked: true,
      ingredientCount: 101,
      strengthsStatus: "PUBLISHED_FROM_COMPLETE_FORMULATION_QTY_COLUMN",
      sourceRecord: "MRP sheet fluence khushal's copy.xlsx / Complete formulation:formulation/Qty/ROA",
      version: 1,
      approvalStatus: "PUBLISHED",
      discrepancyResult: "NO_ACTIVE_INGREDIENT_CONFLICT_DETECTED",
    });
    expect(response.debug?.sourceIntegrity?.ingredientNames).toContain("F-CUMIKIN: Curcumin 250 Mg");
    expect(response.answer).toContain("Debug:");
    expect(response.answer).toContain("Resolved product: Inflammation Phenotype (KIT_INFLAMMATION_PHENOTYPE)");
  });

  it("uses assumption wording for medium-confidence fuzzy ingredient shorthand", async () => {
    const response = await ask("anti inflamm phenotype ingredients");
    expect(response.intent).toBe("KIT_COMPOSITION");
    expect(response.action).toBe("ANSWER");
    expect(response.answer).toContain("Assuming you mean Inflammation Phenotype");
    expect(response.cards[0]).toMatchObject({ type: "composition", title: "Inflammation Phenotype ingredients" });
    expect(response.answer).toContain("Curcumin 250 Mg");
  });

  it("resolves bare doctor shorthand without broad RAG fallback", async () => {
    const response = await ask("inflam phenotype");
    expect(response.intent).toBe("PRODUCT_LOOKUP");
    expect(response.action).toBe("ANSWER");
    expect(response.selectedAuthority).toBe("STRUCTURED_CATALOGUE");
    expect(response.cards[0]).toMatchObject({ type: "composition", title: "Inflammation Phenotype", items: phenotypeProducts });
    expect(response.answer).not.toMatch(unrelatedFallbackTerms);
  });

  it("keeps formulation-rationale follow-up tied to the same kit and avoids general fallback", async () => {
    const response = await ask("Explain how the ingredients of Phenotype Inflammation work together");
    expect(response.intent).toBe("MIXED_KIT_INFORMATION");
    expect(response.cards[0]).toMatchObject({ type: "composition", title: "Inflammation Phenotype ingredients" });
    expect(response.toolCalls[0].name).toBe("getKitIngredientFacts");
    expect(response.toolCalls[1]).toMatchObject({ name: "retrieveApprovedKnowledge", status: "not_found" });
    expect(response.retrieval?.insufficiencyReasons).toContain("NO_CURRENT_PATIENT_PUBLISHED_HAIR_SOURCE");
    expect(response.answer).toContain("Inflammation Phenotype has 101 verified product-level ingredient rows");
    expect(response.answer).not.toMatch(unrelatedFallbackTerms);
    expect(response.answer).not.toMatch(/MRP|INR|price/i);
  });

  it("returns Pro Immune ingredients from Complete formulation and flags the product-row discrepancy", async () => {
    const response = await ask("Ingredient for Pro Immune");
    expect(response.intent).toBe("KIT_COMPOSITION");
    expect(response.selectedAuthority).toBe("STRUCTURED_CATALOGUE");
    expect(response.toolCalls.map((call) => call.name)).toEqual(["getKitIngredientFacts"]);
    expect(response.answer).toContain("PRO IMMUNE GOLD has 86 verified product-level ingredient rows from Complete formulation");
    expect(response.answer).toContain("F-IMMUSurge: Kelp Seaweed Extract 90%Concentration 600Mg");
    expect(response.answer).toContain("F-TRICHO CUMIN:");
    expect(response.answer).toContain("Curcumin 250 Mg");
    expect(response.answer).toContain("F-METACHOL:");
    expect(response.answer).toContain("Vitamin D3 600 IU");
    expect(response.answer).toContain("MISSING_PRODUCT_FORMULATION_ROWS:F-SOLSHINE");
    expect(response.answer).not.toContain("contains 9 active approved product components");
    expect(response.answer).not.toMatch(unrelatedFallbackTerms);
  });

  it("keeps Pro Immune product composition separate from formulation ingredients", async () => {
    const response = await ask("What products are inside Pro Immune Gold?");
    expect(response.intent).toBe("KIT_COMPOSITION");
    expect(response.toolCalls.map((call) => call.name)).toEqual(["getKitComposition"]);
    expect(response.answer).toContain("PRO IMMUNE GOLD contains 9 active approved product components");
    expect(response.answer).toContain("F-IMMUSurge");
    expect(response.answer).toContain("F-SOLSHINE");
    expect(response.answer).not.toContain("Kelp Seaweed Extract");
  });

  it.each([
    ["What are ingredients of TE Gold?", "KIT_TE_GOLD", "TE GOLD"],
    ["Ingredients of GI Gold", "KIT_GI_HEALTH_GOLD", "GI GOLD"],
    ["Meta B ingredients", "KIT_PRO_FACT_META_B", "PRO FACT META B"],
    ["Meta B PCOS ingredients", "KIT_PRO_FACT_META_B_PCOS", "PRO FACT META B PCOS"],
    ["Meta B Thyroid ingredients", "KIT_PRO_FACT_META_B_THYROID", "PRO FACT META B THYROID"],
    ["Meta B Menopause ingredients", "KIT_PRO_FACT_META_B_MENOPAUSE", "PRO FACT META B MENOPAUSE"],
  ])("routes five-kit ingredient aliases through formulation facts: %s", async (query, kitId, displayName) => {
    const understood = understandQuestion(query);
    expect(understood.intent).toBe("KIT_COMPOSITION");
    expect(understood.entities[0]?.type).toBe("KIT");
    expect(understood.entities[0]?.value.id).toBe(kitId);

    const response = await ask(query);
    expect(response.intent).toBe("KIT_COMPOSITION");
    expect(response.selectedAuthority).toBe("STRUCTURED_CATALOGUE");
    expect(response.toolCalls.map((call) => call.name)).toEqual(["getKitIngredientFacts"]);
    expect(response.cards[0]).toMatchObject({ type: "composition", title: `${displayName} ingredients` });
    expect(response.answer).toContain(`${displayName} has`);
    expect(response.answer).toContain("verified product-level ingredient rows from Complete formulation");
    expect(response.answer).not.toMatch(unrelatedFallbackTerms);
    expect(response.answer).not.toMatch(/MRP|INR|price/i);
    expect(response.sources.length).toBeGreaterThan(0);
    expect(response.sources.every((source) => source.sourceType === "STRUCTURED_FIELD" && source.label === "MRP sheet fluence khushal's copy.xlsx / Complete formulation")).toBe(true);
  });
});