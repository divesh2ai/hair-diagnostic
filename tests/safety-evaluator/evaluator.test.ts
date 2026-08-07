// W7 — canonical safety / eligibility evaluator.
//
// Every scenario below anchors to a rule that already existed in either the
// live topical engine, the live kit-interaction resolver, or the previously-
// dead contraindications module. No new medical rules are asserted here.

import { describe, it, expect } from "@jest/globals";
import { evaluateSafety } from "../../src/packages/ai-engine/safety-evaluator";
import type { PatientAnswers } from "../../src/packages/types";

const patient = (over: Partial<{ age: number; sex: string }> = {}) => ({
  age: 34,
  sex: "female",
  ...over,
});

function baseAnswers(over: Partial<PatientAnswers> = {}): PatientAnswers {
  return { hormonal: [], cause: [], scalp: [], goal: [], ...over } as PatientAnswers;
}

describe("evaluateSafety — pregnancy", () => {
  it("BLOCKS all standard topicals when patient is pregnant", () => {
    const result = evaluateSafety({
      answers: baseAnswers({ is_pregnant: true }),
      patient: patient(),
      proposedKits: ["Minoxidil 5%", "Finasteride 0.25% Topical", "F-Emugrow MCRD"],
    });
    expect(result.hasBlock).toBe(true);
    const ids = result.findings.map((f) => f.ruleId);
    expect(ids).toContain("SAFETY_PREGNANCY_KIT_LOCK");
    expect(ids).toContain("SAFETY_PREGNANCY_TOPICAL_BLOCK");
    expect(result.blockedTopicals).toEqual(
      expect.arrayContaining(["Minoxidil 5%", "F-Emugrow MCRD", "Finasteride 0.25% Topical"]),
    );
    expect(result.patientView.messages.some((m) => /pregnant/i.test(m))).toBe(true);
    // Patient message must never leak internal rule ids.
    for (const m of result.patientView.messages) {
      expect(m).not.toMatch(/SAFETY_|BLOCK|CAUTION|SR_|AC_/);
    }
    expect(result.patientView.awaitsDoctorConfirmation).toBe(true);
  });

  it("detects pregnancy from hormonal free-text (no structured flag)", () => {
    const result = evaluateSafety({
      answers: baseAnswers({ hormonal: ["Currently pregnant"] }),
      patient: patient(),
      proposedKits: [],
    });
    expect(result.findings.some((f) => f.ruleId === "SAFETY_PREGNANCY_KIT_LOCK")).toBe(true);
  });

  it("BLOCKS teratogenic topicals when planning pregnancy (no current pregnancy)", () => {
    const result = evaluateSafety({
      answers: baseAnswers({ planning_pregnancy: true }),
      patient: patient(),
      proposedKits: ["Minoxidil 5%", "F-Emugrow MCRD"],
    });
    const ids = result.findings.map((f) => f.ruleId);
    expect(ids).toContain("SAFETY_PLANNING_PREGNANCY_TOPICAL_BLOCK");
    expect(ids).not.toContain("SAFETY_PREGNANCY_KIT_LOCK");
    expect(result.blockedTopicals).toEqual(expect.arrayContaining(["Minoxidil 5%", "F-Emugrow MCRD"]));
    // Safe alternatives surface an existing non-hormonal option.
    const planning = result.findings.find((f) => f.ruleId === "SAFETY_PLANNING_PREGNANCY_TOPICAL_BLOCK")!;
    expect(planning.safeAlternatives).toEqual(expect.arrayContaining(["Trichogain Serum"]));
  });
});

describe("evaluateSafety — hypertension + minoxidil", () => {
  it("BLOCKS all Minoxidil products when hypertension is structured", () => {
    const result = evaluateSafety({
      answers: baseAnswers({ hasHypertension: true }),
      patient: patient({ age: 40 }),
      proposedKits: ["Minoxidil 5%", "F-Emugrow MCRD", "Oral Minoxidil 1.25mg"],
    });
    expect(result.hasBlock).toBe(true);
    expect(result.blockedTopicals).toEqual(
      expect.arrayContaining(["Minoxidil 5%", "Oral Minoxidil 1.25mg"]),
    );
    // F-Emugrow MCRD is a safe alternative here — must NOT be blocked.
    expect(result.blockedTopicals).not.toContain("F-Emugrow MCRD");
    const block = result.findings.find((f) => f.ruleId === "SAFETY_HYPERTENSION_MINOXIDIL_BLOCK")!;
    expect(block.safeAlternatives).toEqual(expect.arrayContaining(["F-Emugrow MCRD"]));
  });

  it("BLOCKS Minoxidil and flags free-text detection when only regex-detected", () => {
    const result = evaluateSafety({
      answers: baseAnswers({ medical_detail: "patient on antihypertensive medication" }),
      patient: patient({ age: 40 }),
      proposedKits: ["Minoxidil 2% Topical"],
    });
    const ids = result.findings.map((f) => f.ruleId);
    expect(ids).toContain("SAFETY_HYPERTENSION_MINOXIDIL_BLOCK");
    expect(ids).toContain("SAFETY_INPUT_HYPERTENSION_FREE_TEXT_ONLY");
    expect(result.hasUnresolvedSafetyCheck).toBe(true);
  });
});

describe("evaluateSafety — finasteride eligibility boundary", () => {
  it("BLOCKS finasteride topicals for male aged 17 (under-18 gate)", () => {
    const result = evaluateSafety({
      answers: baseAnswers({}),
      patient: patient({ age: 17, sex: "male" }),
      proposedKits: ["Finasteride 0.25% Topical", "Minoxidil 2% + Finasteride 0.25% Topical"],
    });
    expect(result.blockedTopicals).toEqual(
      expect.arrayContaining([
        "Finasteride 0.25% Topical",
        "Minoxidil 2% + Finasteride 0.25% Topical",
      ]),
    );
  });

  it("does NOT block finasteride for male aged 18 (boundary)", () => {
    const result = evaluateSafety({
      answers: baseAnswers({}),
      patient: patient({ age: 18, sex: "male" }),
      proposedKits: ["Finasteride 0.25% Topical"],
    });
    expect(result.blockedTopicals).not.toContain("Finasteride 0.25% Topical");
  });

  it("CAUTIONS on finasteride/dutasteride when female of reproductive age (18-50)", () => {
    const result = evaluateSafety({
      answers: baseAnswers({ is_pregnant: false }),
      patient: patient({ age: 34, sex: "female" }),
      proposedKits: ["Finasteride 0.25% Topical", "F-Emugrow MCRD"],
    });
    const finding = result.findings.find(
      (f) => f.ruleId === "SAFETY_FINASTERIDE_FEMALE_PREGNANCY_POTENTIAL",
    );
    expect(finding?.severity).toBe("CAUTION");
    // Caution does not block — kit list is unaffected.
    expect(result.blockedTopicals).not.toContain("Finasteride 0.25% Topical");
  });
});

describe("evaluateSafety — PCOS + Hypothyroid pathway (kit interaction reporting)", () => {
  it("passes kitInteractionAudit through as INFO findings without inventing new rules", () => {
    const audit = [
      "PCOS_HYPO_UNIFY: PCOS + Hypothyroid → single plain PRO FACT META B (3-axis kit).",
      "PCOS_HYPO_UNIFY: PCOS META B variant collapsed to plain PRO FACT META B.",
    ];
    const result = evaluateSafety({
      answers: baseAnswers({ hormonal: ["PCOS"], thyroid: ["Hypothyroidism"] }),
      patient: patient({ age: 32, sex: "female" }),
      proposedKits: ["PRO FACT META B"],
      kitInteractionAudit: audit,
    });
    const info = result.findings.filter((f) => f.ruleId === "SAFETY_KIT_COMBINATION_UNIFIED");
    expect(info).toHaveLength(audit.length);
    expect(info.every((f) => f.severity === "INFO")).toBe(true);
    expect(info.map((f) => f.doctorRationale)).toEqual(audit);
  });
});

describe("evaluateSafety — conflicting / incomplete data", () => {
  it("emits MISSING_INPUT when a female of reproductive age has no pregnancy answer", () => {
    const result = evaluateSafety({
      answers: baseAnswers({}), // no is_pregnant, no planning_pregnancy
      patient: patient({ age: 32, sex: "female" }),
      proposedKits: [],
    });
    expect(result.hasUnresolvedSafetyCheck).toBe(true);
    const finding = result.findings.find(
      (f) => f.ruleId === "SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE",
    );
    expect(finding?.severity).toBe("MISSING_INPUT");
  });

  it("does not emit pregnancy MISSING_INPUT when is_pregnant is explicitly false", () => {
    const result = evaluateSafety({
      answers: baseAnswers({ is_pregnant: false }),
      patient: patient({ age: 32, sex: "female" }),
      proposedKits: [],
    });
    expect(
      result.findings.some(
        (f) => f.ruleId === "SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE",
      ),
    ).toBe(false);
  });
});

describe("evaluateSafety — kit combination exclusions (upstream audit passthrough)", () => {
  it("reports every applied interaction rule as an INFO finding, ordered after BLOCKs", () => {
    const result = evaluateSafety({
      answers: baseAnswers({ is_pregnant: true }),
      patient: patient(),
      proposedKits: ["Minoxidil 5%"],
      kitInteractionAudit: ["PREGNANCY_LOCK: pregnancy is exclusive — all other kits suppressed."],
    });
    const idx = (id: string) => result.findings.findIndex((f) => f.ruleId === id);
    expect(idx("SAFETY_PREGNANCY_KIT_LOCK")).toBeLessThan(idx("SAFETY_KIT_COMBINATION_UNIFIED"));
    expect(idx("SAFETY_KIT_COMBINATION_UNIFIED")).toBeLessThan(idx("SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED"));
  });
});

describe("evaluateSafety — no contraindication case", () => {
  it("returns no BLOCK findings for a healthy adult male with no risk factors", () => {
    const result = evaluateSafety({
      answers: baseAnswers({}),
      patient: patient({ age: 30, sex: "male" }),
      proposedKits: ["Minoxidil 5%", "Finasteride 0.25% Topical"],
    });
    expect(result.hasBlock).toBe(false);
    expect(result.blockedKits).toEqual([]);
    expect(result.blockedTopicals).toEqual([]);
    // The drug-interactions-not-evaluated finding is always present.
    expect(
      result.findings.some((f) => f.ruleId === "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED"),
    ).toBe(true);
    // Patient view is not gated on doctor confirmation.
    expect(result.patientView.awaitsDoctorConfirmation).toBe(false);
  });
});

describe("evaluateSafety — drug-drug interactions", () => {
  it("ALWAYS emits SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED with severity NOT_EVALUATED", () => {
    const result = evaluateSafety({
      answers: baseAnswers({}),
      patient: patient({ age: 25, sex: "male" }),
      proposedKits: [],
    });
    const finding = result.findings.find(
      (f) => f.ruleId === "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED",
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("NOT_EVALUATED");
    // It must NOT be counted as a block or as an unresolved input.
    expect(result.hasBlock).toBe(false);
    expect(result.hasUnresolvedSafetyCheck).toBe(false);
    // Patient message must be present, cautious, and free of engine terms.
    expect(finding?.patientMessage).toMatch(/medic/i);
    expect(finding?.patientMessage).not.toMatch(/SAFETY_|NOT_EVALUATED/);
  });

  it("is present in doctorView.notEvaluated even for a healthy patient", () => {
    const result = evaluateSafety({
      answers: baseAnswers({}),
      patient: patient({ age: 25, sex: "male" }),
      proposedKits: [],
    });
    expect(result.doctorView.notEvaluated.length).toBeGreaterThan(0);
    expect(
      result.doctorView.notEvaluated.some((f) => f.ruleId === "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED"),
    ).toBe(true);
  });
});

describe("evaluateSafety — patient-facing output hygiene", () => {
  it("patient messages never contain kit ids, rule ids, or engine terminology", () => {
    const result = evaluateSafety({
      answers: baseAnswers({ is_pregnant: true, hasHypertension: true }),
      patient: patient({ age: 45 }),
      proposedKits: ["Minoxidil 5%", "F-Emugrow MCRD"],
    });
    const forbidden = [
      /SAFETY_/,
      /HAIR FACT/,
      /PRO FACT/,
      /rule[_\s-]?id/i,
      /BLOCK\b/,
      /MISSING_INPUT/,
      /NOT_EVALUATED/,
    ];
    for (const m of result.patientView.messages) {
      for (const re of forbidden) {
        expect(m).not.toMatch(re);
      }
    }
  });
});
