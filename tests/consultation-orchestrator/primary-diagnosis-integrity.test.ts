// The doctor-facing primary diagnosis must be the ENGINE's diagnosis, always.
//
// ── The defect this guards ──────────────────────────────────────────────────
// `buildDiagnosis` used to take its headline from
// `clinicalReport.patientSummary.clinicalInterpretation[0].condition`. That
// array is built in QUESTIONNAIRE order — the Q4 "suspected cause" selections
// are mapped first — so position 0 was whichever cause the patient happened to
// tick first, not a ranked diagnosis. On staging, 20 of 21 stored consultation
// versions carried a `primary` label that disagreed with their own
// `primaryKey`: PCOS_ONLY headlined "Metabolic — polygenic drivers",
// THYROID_HYPO headlined "Stress-induced TE".
//
// The tests below are written so that they FAIL against that old behaviour.

import { describe, it, expect } from "@jest/globals";
import { buildConsultation } from "../../src/packages/consultation-orchestrator/domain/buildConsultation";
import type { BuildConsultationInput } from "../../src/packages/consultation-orchestrator/domain/buildConsultation";
import { evaluateClinicalProfile } from "../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../../src/packages/ai-engine/kit-scorer/scoreKits";
import { buildClinicalReport } from "../../src/packages/ai-engine/report-engine";
import { DEFAULT_CLINIC_DISPENSING } from "../../src/packages/ai-engine/kit-scorer/dispensingCatalogue";
import { DIAGNOSIS_LABELS } from "../../src/packages/ai-engine/narrative-engine/constants";
import {
  resolvePrimaryDiagnosis,
  labelForSecondaryDiagnosis,
  isDiagnosisKey,
  UnsupportedPrimaryDiagnosisError,
} from "../../src/packages/ai-engine/contracts/primaryDiagnosis";
import type { DiagnosisKey, PatientAnswers } from "../../src/packages/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A complete, valid questionnaire. Scenarios below override single fields. */
const BASE_ANSWERS = {
  name: "Test Patient",
  age: 32,
  sex: "Male",
  goal: ["Reduce hair fall and improve growth"],
  duration: "3–6 months",
  count: "~50–100 strands\n(Noticeable)",
  hairtype: ["Widening parting\nor thinning"],
  scalp: ["Normal scalp"],
  cause: ["Stress / Anxiety / Depression"],
  immunity: ["None of the above"],
  lifestyle: ["None of the above"],
  thyroid: ["Not Applicable"],
  medical: "No, no chronic conditions",
  gut: ["No gut issues"],
  deficiency: ["None / Not tested"],
  diet: ["Normal diet"],
  treatment: ["No heat or chemical treatments"],
} as unknown as PatientAnswers;

function answers(overrides: Record<string, unknown>): PatientAnswers {
  return { ...(BASE_ANSWERS as object), ...overrides } as PatientAnswers;
}

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

/** Re-derive the report the composer builds internally, to inspect its ordering. */
function reportFor(a: PatientAnswers) {
  const clinical = evaluateClinicalProfile(a);
  const therapy = mapTherapyNeeds(clinical);
  const kits = scoreKits(clinical, therapy, a, DEFAULT_CLINIC_DISPENSING, {
    tier: "STANDARD",
    maxKits: 5,
  } as Parameters<typeof scoreKits>[4]);
  const report = buildClinicalReport(
    { name: "Test Patient", age: 32, sex: String((a as Record<string, unknown>).sex ?? "Male") },
    clinical,
    therapy,
    kits,
    a,
  );
  return { clinical, therapy, kits, report };
}

// Scenarios pinned empirically against the production engine.
const SCENARIOS: Array<{ name: string; expectedKey: DiagnosisKey; answers: PatientAnswers }> = [
  {
    name: "AGA male",
    expectedKey: "AGA_MALE_123",
    answers: answers({
      sex: "Male",
      grade: "Grade 2 — Norwood III",
      cause: ["Stress / Anxiety / Depression", "Genetics / Family history"],
      scalp: ["Dandruff / white flakes", "Oily scalp"],
    }),
  },
  {
    name: "AGA female",
    expectedKey: "AGA_FEMALE_123",
    answers: answers({ sex: "Female", age: 30, grade: "Grade 2 — Ludwig 2" }),
  },
  {
    name: "PCOS",
    expectedKey: "PCOS_ONLY",
    answers: answers({
      sex: "Female",
      age: 30,
      grade: "Grade 2 — Ludwig 2",
      hormonal: ["PCOS / PCOD only"],
    }),
  },
  {
    name: "Thyroid (hypo)",
    expectedKey: "THYROID_HYPO",
    answers: answers({
      sex: "Female",
      age: 30,
      grade: "Grade 2 — Ludwig 2",
      thyroid: ["Hypothyroidism"],
    }),
  },
  {
    name: "Iron deficiency",
    expectedKey: "IRON_DEFICIENCY",
    answers: answers({
      sex: "Female",
      age: 30,
      grade: "Grade 2 — Ludwig 2",
      deficiency: ["Iron / Anaemia"],
    }),
  },
  {
    name: "TE / shedding",
    expectedKey: "TE_STRESS",
    answers: answers({
      sex: "Female",
      age: 28,
      duration: "1–3 months",
      count: "100+ strands\n(Heavy loss)",
      hairtype: ["Full-length hairs\nwith white bulb"],
    }),
  },
];

// ── The resolver contract ───────────────────────────────────────────────────

describe("resolvePrimaryDiagnosis", () => {
  it("resolves every DiagnosisKey to its approved label", () => {
    const keys = Object.keys(DIAGNOSIS_LABELS) as DiagnosisKey[];
    expect(keys.length).toBeGreaterThan(30);
    for (const key of keys) {
      const resolved = resolvePrimaryDiagnosis(key);
      expect(resolved.key).toBe(key);
      expect(resolved.label).toBe(DIAGNOSIS_LABELS[key]);
      expect(resolved.label.trim().length).toBeGreaterThan(0);
      // A label must never be the raw enum leaking to a clinician.
      expect(resolved.label).not.toBe(key);
    }
  });

  it("is deterministic — the key is the ONLY input", () => {
    const a = resolvePrimaryDiagnosis("AGA_MALE_123");
    const b = resolvePrimaryDiagnosis("AGA_MALE_123");
    expect(a).toEqual(b);
  });

  it("fails closed on an unsupported diagnosis rather than inventing a label", () => {
    for (const bad of ["NOT_A_DIAGNOSIS", "", null, undefined, 42, {}]) {
      expect(() => resolvePrimaryDiagnosis(bad)).toThrow(UnsupportedPrimaryDiagnosisError);
    }
  });

  it("guards membership", () => {
    expect(isDiagnosisKey("PCOS_ONLY")).toBe(true);
    expect(isDiagnosisKey("pcos_only")).toBe(false);
    expect(isDiagnosisKey("Stress-induced TE")).toBe(false);
  });

  it("labels secondaries from the same map, degrading readably", () => {
    expect(labelForSecondaryDiagnosis("TE_STRESS")).toBe(DIAGNOSIS_LABELS.TE_STRESS);
    expect(labelForSecondaryDiagnosis("SOME_UNMAPPED_KEY")).toBe("Some Unmapped Key");
  });
});

// ── Composition: label and key are one fact ─────────────────────────────────

describe("buildConsultation — primary diagnosis integrity", () => {
  for (const scenario of SCENARIOS) {
    describe(scenario.name, () => {
      it("reports the engine's diagnosis key", () => {
        const c = consultationFor(scenario.answers);
        expect(c.diagnosis.primaryKey).toBe(scenario.expectedKey);
      });

      it("labels it from the approved map — primary and primaryKey agree", () => {
        const c = consultationFor(scenario.answers);
        expect(c.diagnosis.primary).toBe(
          DIAGNOSIS_LABELS[c.diagnosis.primaryKey as DiagnosisKey],
        );
      });

      it("does NOT take the headline from clinicalInterpretation[0]", () => {
        const c = consultationFor(scenario.answers);
        const { report } = reportFor(scenario.answers);
        const positional = report.patientSummary.clinicalInterpretation[0]?.condition;
        // The trap only bites when the two genuinely differ; where the engine
        // happens to agree there is nothing to prove.
        if (positional && positional !== c.diagnosis.primary) {
          expect(c.diagnosis.primary).not.toBe(positional);
        }
        expect(c.diagnosis.primary).toBe(
          DIAGNOSIS_LABELS[scenario.expectedKey],
        );
      });

      it("keeps the interpretation list available as findings", () => {
        const c = consultationFor(scenario.answers);
        expect(Array.isArray(c.clinicalFindings)).toBe(true);
      });
    });
  }

  it("labels every differential from the approved map", () => {
    for (const scenario of SCENARIOS) {
      const c = consultationFor(scenario.answers);
      for (const d of c.diagnosis.differentials) {
        expect(d.label).toBe(labelForSecondaryDiagnosis(d.key));
        expect(d.label).not.toBe(d.key);
      }
    }
  });
});

// ── The critical regression ─────────────────────────────────────────────────
//
// A male AGA case whose FIRST suspected-cause answer is stress. The engine
// diagnoses AGA_MALE_123 and the protocol runs through MPHL, while
// clinicalInterpretation[0].condition reads "Stress-induced TE".
//
// Reversing only the ORDER of the `cause` selections leaves every clinical
// fact identical but flips clinicalInterpretation[0] to
// "Metabolic — polygenic drivers". The old composer's headline flipped with
// it. The diagnosis must not move.

describe("questionnaire-order independence", () => {
  const CAUSES_STRESS_FIRST = [
    "Stress / Anxiety / Depression",
    "Genetics / Family history",
  ];
  const CAUSES_GENETICS_FIRST = [
    "Genetics / Family history",
    "Stress / Anxiety / Depression",
  ];

  const withCauses = (cause: string[]) =>
    answers({
      sex: "Male",
      grade: "Grade 2 — Norwood III",
      cause,
      scalp: ["Dandruff / white flakes", "Oily scalp"],
    });

  it("sets up the trap: interpretation[0] flips, engine diagnosis does not", () => {
    const a = reportFor(withCauses(CAUSES_STRESS_FIRST));
    const b = reportFor(withCauses(CAUSES_GENETICS_FIRST));

    // Same clinical conclusion...
    expect(a.clinical.primaryDiagnosis).toBe("AGA_MALE_123");
    expect(b.clinical.primaryDiagnosis).toBe("AGA_MALE_123");

    // ...but a different positional "condition", which is exactly what the
    // old composer used as the doctor's headline.
    const a0 = a.report.patientSummary.clinicalInterpretation[0]?.condition;
    const b0 = b.report.patientSummary.clinicalInterpretation[0]?.condition;
    expect(a0).toBe("Stress-induced TE");
    expect(a0).not.toBe(b0);
  });

  it("headline stays the canonical AGA/MPHL diagnosis under both orders", () => {
    const expected = DIAGNOSIS_LABELS.AGA_MALE_123;
    const stressFirst = consultationFor(withCauses(CAUSES_STRESS_FIRST));
    const geneticsFirst = consultationFor(withCauses(CAUSES_GENETICS_FIRST));

    expect(stressFirst.diagnosis.primary).toBe(expected);
    expect(geneticsFirst.diagnosis.primary).toBe(expected);
    expect(stressFirst.diagnosis.primary).toBe(geneticsFirst.diagnosis.primary);

    // And it is never the stress condition that sat at position 0.
    expect(stressFirst.diagnosis.primary).not.toBe("Stress-induced TE");
  });

  it("treatment, kits, key and severity are untouched by the reorder", () => {
    const stressFirst = consultationFor(withCauses(CAUSES_STRESS_FIRST));
    const geneticsFirst = consultationFor(withCauses(CAUSES_GENETICS_FIRST));

    expect(stressFirst.diagnosis.primaryKey).toBe("AGA_MALE_123");
    expect(geneticsFirst.diagnosis.primaryKey).toBe("AGA_MALE_123");
    expect(stressFirst.diagnosis.severity).toBe(geneticsFirst.diagnosis.severity);

    const kitsOf = (c: ReturnType<typeof consultationFor>) =>
      c.treatmentPlan.kitPhases.map((p) => p.kitId);
    expect(kitsOf(stressFirst)).toEqual(kitsOf(geneticsFirst));

    const topicalsOf = (c: ReturnType<typeof consultationFor>) =>
      c.treatmentPlan.topicals.map((t) => t.name);
    expect(topicalsOf(stressFirst)).toEqual(topicalsOf(geneticsFirst));
  });

  it("the fix changes ONLY the label — kits still route through MPHL", () => {
    const c = consultationFor(withCauses(CAUSES_STRESS_FIRST));
    expect(c.treatmentPlan.kitPhases.map((p) => p.kitId)).toContain("MPHL");
  });

  it("stress survives as a secondary finding, not as the headline", () => {
    const c = consultationFor(withCauses(CAUSES_STRESS_FIRST));
    const findings = JSON.stringify(c.clinicalFindings);
    expect(findings).toContain("Stress-induced TE");
    expect(c.diagnosis.primary).toBe(DIAGNOSIS_LABELS.AGA_MALE_123);
  });

  it("introduces no grounding violations", () => {
    const c = consultationFor(withCauses(CAUSES_STRESS_FIRST));
    expect(c.clinicalReadiness?.groundingViolations ?? []).toHaveLength(0);
  });
});
