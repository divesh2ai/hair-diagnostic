import { describe, expect, test } from "vitest";
import { ArtifactType } from "@prisma/client";
import { validateArtifactPayload } from "../../src/packages/assessment-orchestrator/validation/validateArtifact";
import { assembleAssessmentNarratives } from "../../src/packages/assessment-orchestrator/narratives/assembleNarratives";
import { evaluateClinicalProfile } from "../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../../src/packages/ai-engine/kit-scorer/scoreKits";
import { mapPortalToPatientAnswers } from "../../src/packages/assessment-orchestrator/mapPortalAnswers";
import { OPEN_CLINIC } from "../../src/sandbox/loaders/fixtureLoader";
import { readFileSync } from "node:fs";

describe("validateArtifactPayload — NARRATIVES", () => {
  test("accepts ComposedNarrative full/short/segments shape", () => {
    const raw = JSON.parse(
      readFileSync("./tests/fixtures/patients/female_aga_regrow_fphl_01.json", "utf8")
    );
    const answers = mapPortalToPatientAnswers(raw);
    const clinical = evaluateClinicalProfile(answers);
    const therapy = mapTherapyNeeds(clinical);
    const recs = scoreKits(clinical, therapy, answers, OPEN_CLINIC, {
      tier: "STANDARD",
      maxKits: 5,
    });
    const assembled = assembleAssessmentNarratives({
      clinicalProfile: clinical,
      therapyNeeds: therapy,
      kitRecommendation: recs,
      narrativeLength: "detailed",
      patientName: "Test Patient",
    });

    expect(() =>
      validateArtifactPayload(ArtifactType.NARRATIVES, {
        doctor_narrative: assembled.doctor_narrative,
        patient_narrative: assembled.patient_narrative,
        therapy_explanation: assembled.therapy_explanation,
      })
    ).not.toThrow();
  });

  test("rejects ComposedNarrative with no usable content", () => {
    expect(() =>
      validateArtifactPayload(ArtifactType.NARRATIVES, {
        doctor_narrative: { full: "", short: "", segments: [] },
      })
    ).toThrow(/doctor_narrative missing/);
  });
});
