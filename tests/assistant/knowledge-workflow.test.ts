import { describe, expect, it } from "vitest";
import { canTransitionKnowledgeStatus, isKnowledgeRetrievable } from "../../src/packages/assistant-core/knowledgeStatus";
import { searchPilotKnowledge } from "../../src/packages/assistant-core/pilotKnowledge";

describe("knowledge approval workflow", () => {
  it("requires medical and commercial approval before any publication state", () => {
    expect(canTransitionKnowledgeStatus("DRAFT", "MEDICAL_REVIEW")).toBe(true);
    expect(canTransitionKnowledgeStatus("MEDICAL_REVIEW", "MEDICAL_APPROVED")).toBe(true);
    expect(canTransitionKnowledgeStatus("MEDICAL_APPROVED", "COMMERCIAL_APPROVED")).toBe(true);
    expect(canTransitionKnowledgeStatus("COMMERCIAL_APPROVED", "PUBLISHED_INTERNAL")).toBe(true);
    expect(canTransitionKnowledgeStatus("PUBLISHED_INTERNAL", "PUBLISHED_PATIENT")).toBe(true);
    expect(canTransitionKnowledgeStatus("DRAFT", "PUBLISHED_PATIENT")).toBe(false);
    expect(canTransitionKnowledgeStatus("MEDICAL_APPROVED", "PUBLISHED_INTERNAL")).toBe(false);
  });

  it("never exposes review-stage knowledge to patient retrieval", () => {
    expect(isKnowledgeRetrievable("MEDICAL_REVIEW", "PATIENT")).toBe(false);
    expect(isKnowledgeRetrievable("PUBLISHED_INTERNAL", "PATIENT")).toBe(false);
    expect(isKnowledgeRetrievable("PUBLISHED_PATIENT", "PATIENT")).toBe(true);
    expect(searchPilotKnowledge("hair", { audience: "PATIENT" })).toEqual([]);
  });

  it("keeps the supplied pilot chunks review-only and available only to explicit preview", () => {
    expect(searchPilotKnowledge("hair", { audience: "INTERNAL_PREVIEW" }).length).toBeGreaterThan(0);
  });
});
