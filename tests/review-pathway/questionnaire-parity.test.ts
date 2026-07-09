import { masterProtocol } from "../../src/packages/ai-engine/questionnaire-engine/protocol/masterProtocol";
import {
  REVIEW_PATHWAY_QUESTIONNAIRE_LABELS,
} from "../../packages/shared/review-pathway";

function allLabelsFromProtocol(): string[] {
  return masterProtocol.sections.flatMap((section) =>
    section.questions.flatMap((question) => question.options.map((option) => option.label)),
  );
}

describe("review pathway questionnaire parity", () => {
  it("covers every mapped questionnaire label present in the live protocol", () => {
    const protocolLabels = new Set(allLabelsFromProtocol());

    for (const labels of Object.values(REVIEW_PATHWAY_QUESTIONNAIRE_LABELS)) {
      for (const label of labels ?? []) {
        expect(protocolLabels.has(label)).toBe(true);
      }
    }
  });

  it("does not map any questionnaire label to a non-existent protocol option", () => {
    const protocolLabels = new Set(allLabelsFromProtocol());
    const mappedLabels = new Set(
      Object.values(REVIEW_PATHWAY_QUESTIONNAIRE_LABELS).flatMap((labels) => labels ?? []),
    );

    for (const label of mappedLabels) {
      expect(protocolLabels.has(label)).toBe(true);
    }
  });
});
