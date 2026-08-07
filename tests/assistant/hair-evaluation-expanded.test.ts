import { describe, expect, it } from "vitest";
import { ManifestGeneralCatalogue } from "../../src/packages/assistant-core/generalCatalogue";
import { runGeneralAssistant } from "../../src/packages/assistant-core/generalEngine";
import { StaticApprovedKnowledgeRetriever } from "../../src/packages/assistant-core/hybridRetrieval";

const catalogue = new ManifestGeneralCatalogue();
const knowledge = new StaticApprovedKnowledgeRetriever();
const evaluate = (query: string) => runGeneralAssistant({ query }, catalogue, knowledge);

const HAIR_EVALUATION = [
  ["TE", "What is TE telogen effluvium shedding?", "ANSWER"],
  ["MPHL", "Explain MPHL", "ANSWER"],
  ["FPHL", "Explain FPHL", "ANSWER"],
  ["ALOPECIA_AREATA", "What is alopecia areata patchy hair loss?", "ANSWER"],
  ["PCOS_GAP", "How does PCOS cause hair loss?", "ABSTAIN"],
  ["THYROID_GAP", "How does thyroid disease cause hair loss?", "ABSTAIN"],
  ["MENOPAUSE_GAP", "Why does menopause cause hair thinning?", "ABSTAIN"],
  ["POSTPARTUM", "Why can postpartum childbirth cause shedding?", "ANSWER"],
  ["IRON_DEFICIENCY", "Can iron deficiency affect hair shedding?", "ANSWER"],
  ["BREAKAGE", "What hair care reduces heat breakage?", "ANSWER"],
  ["GREYING_GAP", "Why is my hair greying?", "ABSTAIN"],
  ["SCALP_RED_FLAGS", "When should dandruff itching seek medical advice?", "ANSWER"],
  ["TOPICAL", "What is minoxidil used for?", "ANSWER"],
  ["MRP_MISSING", "What is the MRP of Hair Fact TE Gold?", "ABSTAIN"],
  ["COMPARISON", "Compare Hair Fact TE Gold versus Pro Fact GI Health Gold", "ANSWER"],
  ["HINGLISH", "Baal stress ke baad kyu jhadte hain?", "ANSWER"],
  ["TYPO", "What is minoxydil?", "ANSWER"],
  ["UNSUPPORTED_CLAIM", "Does onion juice guarantee hair regrowth?", "ABSTAIN"],
] as const;

describe("expanded Hair evaluation", () => {
  it.each(HAIR_EVALUATION)("%s", async (_name, query, action) => {
    const response = await evaluate(query);
    expect(response.action).toBe(action);
    if (action === "ABSTAIN" && !/MRP/.test(_name)) expect(response.answer).toMatch(/will not|could not find enough|cannot/i);
  });
});
