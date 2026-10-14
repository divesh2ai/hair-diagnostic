// PCOS + perimenopause coexistence — clinical correction regression (2026-10).
//
// Authoritative case: Rohini (staging assessment cmv6h7jlg000kfqcu2wuorm24) —
// Female, 39, Acube; reported BOTH "PCOS / PCOD only" and "Peri-menopause".
//
// The defect: the age-only MENO_PCOS_MUTEX in resolveKitInteractions discarded
// one condition purely by age (age < 40 → peri-menopause dropped; 40–49 → PCOS
// dropped), so the kit, diagnosis and PDF contradicted the recognised
// conditions.
//
// The corrected policy (requires clinical sign-off before deploy):
//   • never discard PCOS or a menopause-continuum state on age alone,
//   • recognise both reported conditions,
//   • assess the hormonal-axis overlap and route co-prescription to the doctor,
//   • auto-dispense only a non-binding default primary; HOLD the other kit,
//   • never auto-dispense both without doctor approval.
//
// These tests lock that behaviour across the age matrix 36/39/42/45/52.

import { describe, it, expect } from "@jest/globals";
import { resolveKitInteractions } from "../../src/packages/ai-engine/kit-scorer/resolution/resolveKitInteractions";
import { assessHormonalAxisOverlap } from "../../src/packages/ai-engine/kit-scorer/resolution/assessHormonalAxisOverlap";
import type { ConditionId } from "../../src/packages/ai-engine/kit-scorer/registry/conditionKitRegistry";
import type { ClinicalFlags } from "../../src/packages/ai-engine/clinical-engine/types";

function flagsAtAge(age: number): ClinicalFlags {
  return {
    isRegrowGoal: false,
    hasGreyGoal: false,
    hasHairGoal: true,
    isVeg: false,
    isMale: false,
    isPregnant: false,
    isGrade45: false,
    isGrade123: true,
    hasActiveShedding: false,
    hasNoVisibleFall: false,
    hasGLP1Early: false,
    hasGLP1Late: false,
    hasCrashDiet: false,
    age,
    goal: "Reduce hair fall and improve growth",
    grade: "Grade 3 — Ludwig I-1",
    count: "~50–100 strands",
    duration: "6–12 months",
  };
}

const AGES = [36, 39, 42, 45, 52];

describe("PCOS + peri-menopause coexistence — resolveKitInteractions", () => {
  for (const age of AGES) {
    it(`age ${age}: both conditions are RETAINED (no age-only discard)`, () => {
      const detected = new Set<ConditionId>(["PCOS", "PERI_MENOPAUSE", "AGA_PATTERN_FEMALE"]);
      const res = resolveKitInteractions(detected, flagsAtAge(age));
      expect(res.conditions).toEqual(expect.arrayContaining(["PCOS", "PERI_MENOPAUSE"]));
    });

    it(`age ${age}: records exactly one hormonal-axis overlap requiring doctor review`, () => {
      const detected = new Set<ConditionId>(["PCOS", "PERI_MENOPAUSE", "AGA_PATTERN_FEMALE"]);
      const res = resolveKitInteractions(detected, flagsAtAge(age));
      expect(res.overlaps).toHaveLength(1);
      expect(res.overlaps[0].verdict).toBe("REQUIRES_DOCTOR_REVIEW");
      expect(res.overlaps[0].conditions).toEqual(["PCOS", "PERI_MENOPAUSE"]);
      // The old mutex audit string must be gone; the new one present.
      expect(res.applied.join(" ")).not.toContain("MENO_PCOS_MUTEX");
      expect(res.applied.join(" ")).toContain("HORMONAL_AXIS_OVERLAP");
    });
  }

  it("age < 40 defaults PCOS primary; peri held for review (Rohini, 39)", () => {
    const res = resolveKitInteractions(
      new Set<ConditionId>(["PCOS", "PERI_MENOPAUSE", "AGA_PATTERN_FEMALE", "SCALP_INFLAMMATION"]),
      flagsAtAge(39),
    );
    const o = res.overlaps[0];
    expect(o.primaryCondition).toBe("PCOS");
    expect(o.heldCondition).toBe("PERI_MENOPAUSE");
    // Both still recognised for the diagnosis / PDF.
    expect(res.conditions).toEqual(expect.arrayContaining(["PCOS", "PERI_MENOPAUSE"]));
  });

  it("age 40–49 defaults peri-menopause primary; PCOS held for review", () => {
    const res = resolveKitInteractions(
      new Set<ConditionId>(["PCOS", "PERI_MENOPAUSE", "AGA_PATTERN_FEMALE"]),
      flagsAtAge(45),
    );
    const o = res.overlaps[0];
    expect(o.primaryCondition).toBe("PERI_MENOPAUSE");
    expect(o.heldCondition).toBe("PCOS");
  });

  it("PCOS + POST-menopause at 52: post supersedes peri, post is primary, PCOS held", () => {
    const res = resolveKitInteractions(
      new Set<ConditionId>(["PCOS", "PERI_MENOPAUSE", "POST_MENOPAUSE"]),
      flagsAtAge(52),
    );
    // Continuum stage rule still collapses peri into post.
    expect(res.conditions).not.toContain("PERI_MENOPAUSE");
    expect(res.conditions).toEqual(expect.arrayContaining(["PCOS", "POST_MENOPAUSE"]));
    const o = res.overlaps[0];
    expect(o.conditions).toEqual(["PCOS", "POST_MENOPAUSE"]);
    expect(o.primaryCondition).toBe("POST_MENOPAUSE");
    expect(o.heldCondition).toBe("PCOS");
  });

  it("PCOS alone (no menopause signal) records no overlap and is unchanged", () => {
    const res = resolveKitInteractions(new Set<ConditionId>(["PCOS", "AGA_PATTERN_FEMALE"]), flagsAtAge(39));
    expect(res.overlaps).toHaveLength(0);
    expect(res.conditions).toEqual(expect.arrayContaining(["PCOS"]));
  });
});

describe("assessHormonalAxisOverlap — traceable eligibility", () => {
  for (const age of AGES) {
    it(`age ${age}: verdict is doctor-review, both kits named, shared axis traced`, () => {
      const o = assessHormonalAxisOverlap("PCOS", "PERI_MENOPAUSE", flagsAtAge(age));
      expect(o.verdict).toBe("REQUIRES_DOCTOR_REVIEW");
      expect(o.kits).toEqual(["PRO FACT META B PCOS", "HAIR FACT PERI MENOPAUSE"]);
      expect(o.sharedAxes).toContain("androgen");
      expect(o.reasons.length).toBeGreaterThan(0);
      expect(o.primaryCondition).toBe(age >= 40 ? "PERI_MENOPAUSE" : "PCOS");
    });
  }
});

// ── Rohini corrected-draft lock (staging cmv6h7jlg000kfqcu2wuorm24) ──────────
// Her exact submitted answers, run through the live detection + resolution
// path. Pre-patch this produced PCOS-only (peri discarded at age 39). The
// corrected draft keeps BOTH conditions and holds the peri kit for approval.
import { detectConditions } from "../../src/packages/ai-engine/kit-scorer/registry/detectConditions";
import type { PatientAnswers } from "../../src/packages/types";

const ROHINI: PatientAnswers = {
  age: 39,
  sex: "Female",
  name: "Rohini",
  hormonal: ["PCOS / PCOD only", "Peri-menopause"],
  thyroid: ["Pre diabetes"],
  scalp: ["Dandruff + Itching + White flakes", "Dry scalp"],
  cause: ["Genetics / Family history", "Stress / Anxiety / Depression"],
  grade: "Grade 3 — Ludwig I-1",
  gut: ["No gut issues"],
  diet: ["Normal diet"],
  goal: ["Reduce hair fall and improve growth"],
  count: "~50–100 strands\n(Noticeable)",
  duration: "6–12 months",
  hairtype: ["Hair on pillow /\nfloor / shower"],
  immunity: ["Allergies"],
  lifestyle: ["Smoking / Vaping"],
  treatment: ["Heat styling (straightener etc.)"],
  deficiency: ["None / Not tested"],
  medical: "No, no chronic conditions",
} as unknown as PatientAnswers;

describe("Rohini (39, PCOS + peri-menopause) — corrected draft", () => {
  const flags = flagsAtAge(39);
  it("detects BOTH PCOS and peri-menopause from her answers", () => {
    const detected = detectConditions(ROHINI, flags);
    expect(detected.has("PCOS")).toBe(true);
    expect(detected.has("PERI_MENOPAUSE")).toBe(true);
  });

  it("resolution keeps both; PCOS auto-dispensed, peri held for doctor approval; no age discard", () => {
    const detected = detectConditions(ROHINI, flags);
    const res = resolveKitInteractions(detected, flags);
    expect(res.conditions).toEqual(expect.arrayContaining(["PCOS", "PERI_MENOPAUSE"]));
    expect(res.overlaps).toHaveLength(1);
    expect(res.overlaps[0].primaryCondition).toBe("PCOS");
    expect(res.overlaps[0].heldCondition).toBe("PERI_MENOPAUSE");
    expect(res.applied.join(" ")).not.toContain("MENO_PCOS_MUTEX");
  });
});

// ── holdOverlappingKits — BOTH hormonal kits held; other kits preserved ─────
import { holdOverlappingKits } from "../../src/packages/ai-engine/kit-scorer/resolution/holdOverlappingKits";

describe("holdOverlappingKits — kit decision deferred to doctor", () => {
  const overlap = assessHormonalAxisOverlap("PCOS", "PERI_MENOPAUSE", flagsAtAge(39));
  const conditionKits = [
    { condition: "PCOS" as ConditionId, kit: "PRO FACT META B PCOS" as const },
    { condition: "PERI_MENOPAUSE" as ConditionId, kit: "HAIR FACT PERI MENOPAUSE" as const },
    { condition: "AGA_PATTERN_FEMALE" as ConditionId, kit: "FPHL" as const },
    { condition: "SCALP_INFLAMMATION" as ConditionId, kit: "PHENOTYPE INFLAMATION" as const },
  ];

  it("holds BOTH hormonal-axis kits (neither auto-dispensed)", () => {
    const { heldKits } = holdOverlappingKits(conditionKits, [overlap]);
    expect(heldKits).toEqual(
      expect.arrayContaining(["PRO FACT META B PCOS", "HAIR FACT PERI MENOPAUSE"]),
    );
    expect(heldKits).toHaveLength(2);
  });

  it("preserves every other safely-supported kit (FPHL, scalp)", () => {
    const { retained } = holdOverlappingKits(conditionKits, [overlap]);
    const retainedKits = retained.map((r) => r.kit);
    expect(retainedKits).toEqual(expect.arrayContaining(["FPHL", "PHENOTYPE INFLAMATION"]));
    expect(retainedKits).not.toContain("PRO FACT META B PCOS");
    expect(retainedKits).not.toContain("HAIR FACT PERI MENOPAUSE");
  });

  it("never withholds a hormonal kit an independent condition also needs", () => {
    // Contrived: METABOLIC (not in the overlap) also maps to the PCOS kit.
    const withIndependent = [
      ...conditionKits,
      { condition: "METABOLIC" as ConditionId, kit: "PRO FACT META B PCOS" as const },
    ];
    const { heldKits } = holdOverlappingKits(withIndependent, [overlap]);
    expect(heldKits).not.toContain("PRO FACT META B PCOS");
    expect(heldKits).toContain("HAIR FACT PERI MENOPAUSE");
  });

  it("no overlap → nothing held, everything retained", () => {
    const { heldKits, retained } = holdOverlappingKits(conditionKits, []);
    expect(heldKits).toHaveLength(0);
    expect(retained).toHaveLength(conditionKits.length);
  });
});
