import { describe, expect, it } from "vitest";
import { runAssistant } from "../../src/packages/assistant-core/engine";
import type { ClinicalAuthorityPort } from "../../src/packages/assistant-core/clinicalAuthority";
import { GOLDEN_QUESTIONS } from "./fixtures/goldenQuestions";

const clinical: ClinicalAuthorityPort = {
  async getApprovedContext() {
    return {
      approvalStatus: "APPROVED",
      planVersionId: "approved-plan-v3",
      kitSequence: ["Phenotype Inflammation", "TE GOLD"],
      ruleTrace: [
        { kitId: "KIT_TE_GOLD", action: "SELECTED", reason: "TE GOLD was selected from the recorded patient drivers." },
        { kitId: "KIT_INFLAMMATION_PHENOTYPE", action: "PRIORITIZED", reason: "Severe inflammation priority was confirmed by the deterministic trace." },
        { kitId: "KIT_GI_GOLD", action: "SUPPRESSED", reason: "Minor symptoms alone do not trigger GI GOLD." },
      ],
      doctorNote: "Approved without substitution.",
      sources: [{ sourceType: "CLINICAL_RECORD", sourceId: "approved-plan-v3", label: "Doctor-approved consultation v3", version: 3, approvalStatus: "APPROVED" }],
    };
  },
};

describe("Stage 1 supplied golden questions", () => {
  it("contains the complete 50-question supplied fixture", () => expect(GOLDEN_QUESTIONS).toHaveLength(50));
  for (const golden of GOLDEN_QUESTIONS) {
    it(`${golden.id}: ${golden.question}`, async () => {
      const response = await runAssistant({ query: golden.question, role: "DOCTOR", clinicId: "clinic-1", userId: "doctor-1", patientId: "patient-1", assessmentId: "assessment-1", internalProvisionalMode: true }, clinical);
      expect(golden.actions, response.answer).toContain(response.action);
      for (const expected of golden.includes ?? []) expect(response.answer.toLowerCase()).toContain(expected.toLowerCase());
      if (golden.sourceRequired) expect(response.sources.length, response.answer).toBeGreaterThan(0);
    });
  }
});

describe("clinical authority boundary", () => {
  it("does not infer a plan when no approved plan and rule trace are available", async () => {
    const response = await runAssistant({ query: "Which kit should I start first?", role: "PATIENT", clinicId: "clinic-1", userId: "patient-user", patientId: "patient-1" });
    expect(response.action).toBe("ESCALATE");
    expect(response.answer).toContain("will not infer");
  });
  it("does not expose pending explanatory knowledge to patient mode", async () => {
    const response = await runAssistant({ query: "What is TE GOLD?", role: "PATIENT", clinicId: "clinic-1", userId: "patient-user" });
    expect(response.action).toBe("ABSTAIN");
    expect(response.answer).toContain("pending medical review");
  });
});

describe("hair-first scope", () => {
  for (const question of [
    "Why does hair shedding happen after stress?",
    "How does the hair growth cycle work?",
    "Can scalp inflammation affect follicles?",
    "Is pattern hair loss only related to DHT?",
    "What is telogen effluvium?",
  ]) {
    it(`answers hair education: ${question}`, async () => {
      const response = await runAssistant({ query: question, role: "DOCTOR", clinicId: "clinic-1", userId: "doctor-1", internalProvisionalMode: true }, clinical);
      expect(response.action).toBe("ANSWER");
      expect(response.answer).toContain("not a diagnosis");
    });
  }
  it.each(["How do I treat dry skin?"])("defers later-stage scope: %s", async (question) => {
    const response = await runAssistant({ query: question, role: "DOCTOR", clinicId: "clinic-1", userId: "doctor-1", internalProvisionalMode: true }, clinical);
    expect(response.action).toBe("ABSTAIN");
    expect(response.answer).toContain("future domain");
  });
});