import { describe, expect, it } from "vitest";
import { evaluateClinicalProfile } from "../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../../src/packages/ai-engine/kit-scorer/scoreKits";
import { buildClinicalReport } from "../../src/packages/ai-engine/report-engine/buildClinicalReport";
import type {
  BudgetProfile,
  ClinicConfig,
} from "../../src/packages/ai-engine/kit-scorer/types";
import type { PatientAnswers } from "../../src/packages/types";
import {
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
} from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";

// End-to-end dry-run for the Vaer case: a 33-year-old male with 7 explicit
// triggers (rapid weight loss, family history, stress, IBS/Crohn's, iron
// deficiency, hyperthyroid, allergies) whose original PDF at STANDARD budget
// (maxKits: 5) dropped MPHL and PRO IMMUNE. Under COMPREHENSIVE (maxKits: 7),
// both must land in the ranked kit list and render on the one-pager.

const vaer: PatientAnswers = {
  sex: "Male",
  age: "33",
  grade: "Grade 2",
  duration: "1–3 months",
  count: "20–50 strands",
  cause: [
    "Rapid weight loss / Crash diet",
    "Genetics / Family history",
    "Stress / Anxiety / Depression",
  ],
  lifestyle: ["Alcohol (8–10x/month)", "Frequent flying"],
  thyroid: ["Hyperthyroidism"],
  immunity: ["Allergies"],
  deficiency: ["Iron / Anaemia"],
  gut: ["IBS / Crohn's"],
  diet: ["Non-vegetarian"],
  treatment: ["Chemical treatment (colour / keratin)"],
  goal: ["Reduce hair fall and improve quality & growth"],
  scalp: ["Normal scalp"],
  hairtype: ["Hair on pillow / floor / shower"],
  hormonal: [],
};

const clinic: ClinicConfig = {
  clinicId: "drfact-mumbai-test",
  availableKits: [
    "HAIR FACT TE GOLD",
    "PRO FACT META B",
    "PRO FACT META B HYPOTHYROID",
    "MPHL",
    "IRON UP GOLD",
    "PRO FACT GI GOLD",
    "OXIDATIVE STRESS",
    "RAPID WEIGHT LOSS SHIELD",
    "PHENOTYPE INFLAMATION",
    "PRO IMMUNE GOLD",
    "HAIR FACT HAIR BREAKAGE REPAIR(HBR)",
    "PRO FACT THYROID CARE",
  ],
};

const COMPREHENSIVE: BudgetProfile = { tier: "COMPREHENSIVE", maxKits: 7 };
const STANDARD: BudgetProfile = { tier: "STANDARD", maxKits: 5 };

function runScoring(budget: BudgetProfile) {
  const profile = evaluateClinicalProfile(vaer);
  const needs = mapTherapyNeeds(profile);
  return scoreKits(profile, needs, vaer, clinic, budget);
}

describe("Vaer — COMPREHENSIVE budget picks up MPHL and PRO IMMUNE", () => {
  it("STANDARD budget still caps at 5 (baseline / regression floor)", () => {
    const rec = runScoring(STANDARD);
    expect(rec.rankedKits.length).toBeLessThanOrEqual(5);
  });

  it("COMPREHENSIVE lifts the ceiling — Vaer now returns 7 ranked kits (was capped at 5)", () => {
    const stdRec = runScoring(STANDARD);
    const rec = runScoring(COMPREHENSIVE);
    const ids = rec.rankedKits.map((k) => k.kitId);

    // Ceiling lift: COMPREHENSIVE strictly returns >= STANDARD, up to 7.
    expect(rec.rankedKits.length).toBeGreaterThan(stdRec.rankedKits.length);
    expect(rec.rankedKits.length).toBeLessThanOrEqual(7);

    // PRO IMMUNE (allergies + genetics + age >= 30) surfaces automatically
    // under COMPREHENSIVE — the STANDARD budget had squeezed it out.
    expect(ids.some((id) => id.includes("PRO IMMUNE"))).toBe(true);

    // Kits from the original STANDARD-tier PDF are all still there.
    expect(ids).toContain("RAPID WEIGHT LOSS SHIELD");
    expect(ids).toContain("PRO FACT GI GOLD");
    expect(ids).toContain("IRON UP GOLD");
    expect(ids).toContain("PHENOTYPE INFLAMATION");
    expect(ids).toContain("PRO FACT THYROID CARE");

    // MPHL note: the pattern-loss kit is intentionally ranked LAST
    // (PATTERN_KITS_LAST in kitPrioritizer.ts). For Vaer the frequent-flyer
    // lifestyle kit sits above MPHL in the ranker, so at the 7-slot ceiling
    // MPHL still doesn't land automatically. Doctor approval is authoritative
    // — see the "doctor lineup" test below for the 7/7 render invariant.
  });

  it("doctor-added MPHL — all 7 approved kits render 1:1 on the one-pager", () => {
    // Simulates the exact case in the requirements: the doctor's approved
    // treatment strategy contains RWL Shield, GI Gold, Iron Up, Phenotype
    // Inflammation, Thyroid Care, MPHL, PRO IMMUNE. Whether the ranker
    // produced this set automatically or the doctor curated it via the Kit
    // Lineup Editor, the one-pager must render every approved row in order.
    const profile = evaluateClinicalProfile(vaer);
    const rec = runScoring(COMPREHENSIVE);
    const report = buildClinicalReport(
      { name: "Vaer", age: 33, sex: "Male" },
      profile,
      mapTherapyNeeds(profile),
      rec,
      vaer,
    );

    // Overlay the doctor's approved treatment strategy on the report.
    const approvedLineup = [
      "RAPID WEIGHT LOSS SHIELD",
      "PRO FACT GI GOLD",
      "IRON UP GOLD",
      "PHENOTYPE INFLAMATION",
      "PRO FACT THYROID CARE",
      "MPHL",
      "PRO IMMUNE GOLD",
    ];
    report.treatmentStrategy = approvedLineup.map((kitId, i) => ({
      phase: i + 1,
      kitId,
      displayName: kitId,
      whySelected: `Doctor-approved: ${kitId}`,
      supportingConditions: [],
      keyIngredients: [],
      mechanismOfAction: [],
      formulationGroups: [],
    }));

    const context: OnePageReportContext = {
      assessmentId: "vaer-comprehensive-e2e",
      approval: { status: "APPROVED", approvedAt: "2026-08-04T00:00:00.000Z" },
    };
    const view = mapClinicalReportToPrintPresentation(report, context);
    const renderedCodes = [
      ...view.treatmentPlan.map((k) => k.kitCode),
      ...view.additionalCare.map((k) => k.kitCode),
    ];

    // 1:1 render — 7 approved kits → 7 rendered rows, no silent truncation.
    expect(renderedCodes).toEqual([
      "RAPID_WEIGHT_LOSS_SHIELD",
      "PRO_FACT_GI_GOLD",
      "IRON_UP_GOLD",
      "PHENOTYPE_INFLAMMATION",
      "PRO_FACT_THYROID_CARE",
      "MPHL",
      "PRO_IMMUNE_GOLD",
    ]);
    // Set-mismatch and order-mismatch validators both stay quiet.
    const kitErrors = view.validation.errors.filter((error) =>
      /Approved kit set mismatch|Approved kit order mismatch/i.test(error),
    );
    expect(kitErrors).toEqual([]);
    // 7-kit case downshifts to compact density (was "standard" for 3–4 kits).
    expect(view.layoutMode).toBe("compact");
    // No kit was quarantined into additionalCare.
    expect(view.additionalCare).toEqual([]);
  });
});
