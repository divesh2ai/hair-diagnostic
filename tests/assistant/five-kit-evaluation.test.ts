import { describe, expect, it } from "vitest";
import { ManifestGeneralCatalogue } from "../../src/packages/assistant-core/generalCatalogue";
import { runGeneralAssistant } from "../../src/packages/assistant-core/generalEngine";
import { StaticApprovedKnowledgeRetriever } from "../../src/packages/assistant-core/hybridRetrieval";
import { understandQuestion } from "../../src/packages/assistant-core/questionUnderstanding";
import { FIVE_KIT_EVALUATION, FIVE_KIT_EVALUATION_DISTRIBUTION } from "./fixtures/fiveKitEvaluation";

const catalogue = new ManifestGeneralCatalogue();
const knowledge = new StaticApprovedKnowledgeRetriever();

describe("five-kit 150-case governed evaluation", () => {
  it("contains the required 150 cases and exact category distribution", () => {
    expect(FIVE_KIT_EVALUATION).toHaveLength(150);
    expect(new Set(FIVE_KIT_EVALUATION.map((item) => item.id)).size).toBe(150);
    for (const [category, count] of Object.entries(FIVE_KIT_EVALUATION_DISTRIBUTION)) expect(FIVE_KIT_EVALUATION.filter((item) => item.category === category)).toHaveLength(count);
  });

  it.each(FIVE_KIT_EVALUATION)("$id classifies $category", (item) => {
    expect(understandQuestion(item.query).intent).toBe(item.expectedIntent);
  });

  it.each(FIVE_KIT_EVALUATION.filter((item) => item.category === "security" || item.category === "refusal"))("$id enforces refusal boundary", async (item) => {
    const response = await runGeneralAssistant({ query: item.query }, catalogue, knowledge);
    expect(response.action).not.toBe("ANSWER");
    expect(response.selectedAuthority).toBe("SAFETY_POLICY");
  });

  it("answers five-kit purpose only from controlled published records", async () => {
    const response = await runGeneralAssistant({ query: "What is the documented purpose of Hair Fact TE GOLD?" }, catalogue, knowledge);
    expect(response.action).toBe("ANSWER");
    expect(response.intent).toBe("KIT_OVERVIEW");
    expect(response.selectedAuthority).toBe("APPROVED_KNOWLEDGE");
    expect(response.sources.some((source) => source.sourceId.startsWith("FIVEKIT_") && source.url?.includes("fiveKitKnowledge.ts"))).toBe(true);
    expect(response.answer).not.toMatch(/MRP|current price|selling price|doctor price/i);
  });

  it("routes an exact-plus-explanation question through both authorities without guessing", async () => {
    const response = await runGeneralAssistant({ query: "What is the MRP of Hair Fact TE GOLD and why is it used?" }, catalogue, knowledge);
    expect(response.intent).toBe("MIXED_KIT_INFORMATION");
    expect(response.toolCalls.map((call) => call.name)).toContain("retrieveApprovedKnowledge");
    expect(response.action).toBe("ABSTAIN");
  });
});