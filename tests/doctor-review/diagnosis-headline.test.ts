// The doctor review workspace must headline the SAME diagnosis the queue does.
//
// The Clinical Conclusion headline used to be `story.drivers[0].label`. Those
// drivers are genuinely ranked (tier, then weight), so this was not an
// array-position accident — but a driver is a contributing MECHANISM, not a
// diagnosis, and the two disagree routinely. An AGA_MALE_123 case running an
// MPHL protocol headlined "Stress-Related Shedding" in the review workspace
// while the queue card for the same patient read "Male pattern hair loss ·
// early stage", because the queue labels the engine key directly.
//
// One patient must not have two answers to "what is this?".

import { describe, it, expect } from "@jest/globals";
import { buildClinicalSummary } from "@/lib/doctor/clinicalSummary";
import { labelForDiagnosis } from "@/lib/labels/diagnosisLabels";
import { buildConsultation } from "@hairos/packages/consultation-orchestrator/domain/buildConsultation";
import type { BuildConsultationInput } from "@hairos/packages/consultation-orchestrator/domain/buildConsultation";
import { DIAGNOSIS_LABELS } from "@hairos/packages/ai-engine/narrative-engine/constants";
import type { DiagnosisKey, PatientAnswers } from "@hairos/packages/types";

const BASE = {
  name: "Test Patient",
  age: 32,
  sex: "Male",
  goal: ["Reduce hair fall and improve growth"],
  duration: "3–6 months",
  count: "~50–100 strands\n(Noticeable)",
  hairtype: ["Widening parting\nor thinning"],
  scalp: ["Dandruff / white flakes", "Oily scalp"],
  // Stress first — the ordering that used to drive the headline.
  cause: ["Stress / Anxiety / Depression", "Genetics / Family history"],
  immunity: ["None of the above"],
  lifestyle: ["None of the above"],
  thyroid: ["Not Applicable"],
  medical: "No, no chronic conditions",
  gut: ["No gut issues"],
  deficiency: ["None / Not tested"],
  diet: ["Normal diet"],
  treatment: ["No heat or chemical treatments"],
  grade: "Grade 2 — Norwood III",
} as unknown as PatientAnswers;

function consultationFor(a: PatientAnswers) {
  const input: BuildConsultationInput = {
    patient: {
      id: "pat_test",
      name: "Test Patient",
      age: 32,
      sex: String((a as Record<string, unknown>).sex ?? "Male"),
    } as BuildConsultationInput["patient"],
    assessment: {
      id: "asm_test",
      submittedAt: new Date("2026-09-03T00:00:00.000Z").toISOString(),
    } as BuildConsultationInput["assessment"],
    answers: a,
    actorId: "doc_test",
  };
  return buildConsultation(input);
}

describe("review workspace headline", () => {
  it("is the engine's primary diagnosis, not the leading driver", () => {
    const consultation = consultationFor(BASE);
    const vm = buildClinicalSummary(consultation);

    expect(consultation.diagnosis.primaryKey).toBe("AGA_MALE_123");
    // The workspace renders the queue-toned label for the same key, so the
    // two surfaces are one expression of one field.
    expect(vm.headline).toBe(labelForDiagnosis("AGA_MALE_123"));
    expect(vm.headline).toMatch(/male pattern/i);
    expect(vm.headline).not.toMatch(/stress/i);
    // The persisted payload carries the domain label for the same key.
    expect(consultation.diagnosis.primary).toBe(DIAGNOSIS_LABELS.AGA_MALE_123);
  });

  it("agrees with the label the queue and patient deck render", () => {
    const consultation = consultationFor(BASE);
    const vm = buildClinicalSummary(consultation);

    // The queue renders labelForDiagnosis(SEVERITY_ANALYSIS.primaryDiagnosis).
    // Both surfaces must name the same condition for the same patient.
    const queueLabel = labelForDiagnosis(consultation.diagnosis.primaryKey);
    expect(queueLabel).toMatch(/male pattern/i);
    expect(vm.headline).toMatch(/androgenetic|male/i);

    // Neither surface may fall back to a contributing driver.
    expect(queueLabel).not.toMatch(/stress/i);
    expect(vm.headline).not.toMatch(/stress/i);
  });

  it("keeps the leading driver visible, with its own label", () => {
    const vm = buildClinicalSummary(consultationFor(BASE));

    // The driver is not lost — it is demoted from headline to driver, and it
    // now carries its label because the headline no longer supplies one.
    expect(vm.primaryDriver).not.toBeNull();
    expect(vm.primaryDriver?.label.length ?? 0).toBeGreaterThan(0);
  });

  it("does not change when the questionnaire answer order changes", () => {
    const reordered = {
      ...(BASE as object),
      cause: ["Genetics / Family history", "Stress / Anxiety / Depression"],
    } as PatientAnswers;

    const a = buildClinicalSummary(consultationFor(BASE));
    const b = buildClinicalSummary(consultationFor(reordered));

    expect(a.headline).toBe(b.headline);
    expect(a.headline).toBe(labelForDiagnosis("AGA_MALE_123"));
  });

  it("labels every diagnosis key the domain map knows about", () => {
    // The app-side map is a surface-toned mirror of the domain map: shorter
    // wording for a queue row, same condition. If a key is missing from the
    // mirror, labelForDiagnosis falls through to title-casing the raw enum and
    // a doctor sees "Aga Male 123" on the queue. Guard the whole union.
    for (const key of Object.keys(DIAGNOSIS_LABELS) as DiagnosisKey[]) {
      const uiLabel = labelForDiagnosis(key);
      expect(uiLabel).not.toBe(key);
      expect(uiLabel.trim().length).toBeGreaterThan(0);
      // The title-cased fallback for AGA_MALE_123 would be "Aga Male 123".
      const fallback = key
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      expect(uiLabel).not.toBe(fallback);
    }
  });
});
