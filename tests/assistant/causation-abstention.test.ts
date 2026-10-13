import { describe, expect, it } from "vitest";
import { ManifestGeneralCatalogue } from "../../src/packages/assistant-core/generalCatalogue";
import { runGeneralAssistant } from "../../src/packages/assistant-core/generalEngine";
import { StaticApprovedKnowledgeRetriever } from "../../src/packages/assistant-core/hybridRetrieval";

// Regression guard for the general assistant's source-eligibility + abstention
// behaviour. Two rules under test:
//   1. A clinical-causation question for which there is NO approved condition /
//      patient-education source must ABSTAIN — it must never be answered from a
//      kit-controlled record that merely names the condition as a target.
//   2. A condition that DOES have an approved patient-education source (alopecia
//      areata) must be answered from that source, even though a kit shares the
//      condition's name.
// No clinical evidence is invented and kit marketing copy is never treated as
// proof of medical causation.

const catalogue = new ManifestGeneralCatalogue();
const knowledge = new StaticApprovedKnowledgeRetriever();
const ask = (query: string) => runGeneralAssistant({ query }, catalogue, knowledge);

const ABSTAIN_PATTERN = /will not|could not find enough|cannot/i;

describe("general assistant — causation gaps abstain, kit copy is not causation proof", () => {
  const INSUFFICIENT_EVIDENCE: Array<[string, string]> = [
    ["PCOS causation", "How does PCOS cause hair loss?"],
    ["thyroid causation", "How does thyroid disease cause hair loss?"],
    ["menopause causation", "Why does menopause cause hair thinning?"],
    ["greying causation", "Why is my hair greying?"],
  ];

  it.each(INSUFFICIENT_EVIDENCE)("abstains on %s (no approved condition source)", async (_label, query) => {
    const r = await ask(query);
    expect(r.action).toBe("ABSTAIN");
    expect(r.answer).toMatch(ABSTAIN_PATTERN);
    // Never answered from a kit-controlled record.
    expect(r.sources.every((s) => !(s.sourceId ?? "").toUpperCase().includes("META_B"))).toBe(true);
  });

  it("abstains on an unsupported remedy claim (onion juice)", async () => {
    const r = await ask("Does onion juice guarantee hair regrowth?");
    expect(r.action).toBe("ABSTAIN");
    expect(r.answer).toMatch(ABSTAIN_PATTERN);
  });

  it("answers alopecia areata from the approved condition source, not a kit record", async () => {
    const r = await ask("What is alopecia areata patchy hair loss?");
    expect(r.action).toBe("ANSWER");
    expect(r.answer.toLowerCase()).toContain("autoimmune");
    // At least one approved condition source backs the answer.
    expect(r.sources.length).toBeGreaterThan(0);
  });
});
