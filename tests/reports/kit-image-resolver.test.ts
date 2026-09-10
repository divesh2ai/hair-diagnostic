// resolveKitImage (lib/kits/kitImage.ts) is what Doctor Review and the
// patient cart actually call for a packshot — a separate path from the
// one-pager's kitAssetCode, and one that had no test coverage before this
// reconciliation.
//
// It carries a fuzzy alias table for the long clinical spellings
// ("HAIR FACT TE GOLD" -> HAIR_FACT_TE_GOLD). That table is unsafe for the
// governed budget alternatives specifically: "HYPOTHYROID_2" contains
// "THYROID", and without a guard it resolved to PRO_FACT_THYROID_CARE's
// carton — a live defect confirmed before this suite's fix, on a kit a
// doctor can actually substitute a patient onto today.
import { describe, expect, it } from "vitest";
import { resolveKitImage } from "../../apps/patient-portal/src/lib/kits/kitImage";
import { APPROVED_SUBSTITUTIONS } from "../../apps/patient-portal/src/lib/commerce/budgetSubstitution";
import {
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
} from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import type { ClinicalReport, TreatmentPhase } from "../../src/packages/ai-engine/report-engine/types";

function phase(kitId: string, displayName: string): TreatmentPhase {
  return {
    phase: 1,
    kitId,
    displayName,
    whySelected: "",
    supportingConditions: [],
    keyIngredients: [],
    mechanismOfAction: [],
    formulationGroups: [],
  } as TreatmentPhase;
}

const context: OnePageReportContext = {
  assessmentId: "kit-image-resolver-test",
  approval: { status: "APPROVED", approvedAt: "2026-09-10T00:00:00.000Z" },
};

function report(phases: TreatmentPhase[]): ClinicalReport {
  return {
    patientSummary: {
      name: "P",
      age: 30,
      gender: "Female",
      goal: [],
      hairLossPattern: [],
      scalpConcerns: [],
      lifestyleFactors: [],
      medicalFactors: [],
      previousTreatments: [],
      questionnaireSelections: {},
      clinicalInterpretation: [],
    },
    rootCauseAnalysis: { primary: [], secondary: [], amplifiers: [] },
    treatmentStrategy: phases,
    topicalRecommendations: [],
    topicalCautions: [],
    recoveryRoadmap: [],
    recoveryMilestones: [],
    dietAndLifestyle: [],
    generatedAt: "2026-09-10T00:00:00.000Z",
    schemaVersion: "v4",
  } as unknown as ClinicalReport;
}

const WIRED_ALTERNATIVES = [
  "M4_PLUS",
  "F4_PLUS",
  "PRO_IMMUNE_1",
  "SHED_CONTROL",
  "IRON_UP_1",
  "GI_HEALTH_1",
  "STRESS_BUST_3",
  "HYPOTHYROID_2",
];

describe("resolveKitImage — governed alternatives never fall through to fuzzy matching", () => {
  it("every wired alternative resolves its own asset, keyed by its own code", () => {
    for (const kitId of WIRED_ALTERNATIVES) {
      const resolved = resolveKitImage(kitId);
      expect(resolved).not.toBeNull();
      expect(resolved!.code).toBe(kitId);
    }
  });

  it("HYPOTHYROID_2 resolves its own carton, never Thyroid Care's", () => {
    // This is the exact regression: /THYROID CARE|THYROID/ in KIT_ALIASES
    // caught "HYPOTHYROID_2" before this guard existed, and returned
    // PRO_FACT_THYROID_CARE's asset — a different product at a different
    // price. Photography landed 2026-09-10; the guard stays regardless,
    // since it is what makes a FUTURE alternative with no asset yet fail
    // safe instead of borrowing whatever fuzzy rule matches its substring.
    const resolved = resolveKitImage("HYPOTHYROID_2");
    expect(resolved).not.toBeNull();
    expect(resolved!.code).toBe("HYPOTHYROID_2");
    expect(resolved!.code).not.toBe("PRO_FACT_THYROID_CARE");
  });

  it("no alternative SKU can ever resolve a DIFFERENT product's carton", () => {
    // General form of the same guard: every approved alternative id either
    // resolves to its own asset or to nothing — never to another kit's code.
    for (const pair of APPROVED_SUBSTITUTIONS) {
      const alt = pair.alternativeKitId as string;
      const resolved = resolveKitImage(alt);
      if (resolved) expect(resolved.code).toBe(alt);
    }
  });

  it("the canonical kits these alternatives replace are unaffected", () => {
    // Sanity: the guard must not have broken ordinary resolution for the
    // kits that were always fine.
    expect(resolveKitImage("HAIR FACT TE GOLD")?.code).toBe("HAIR_FACT_TE_GOLD");
    expect(resolveKitImage("PRO FACT META B HYPOTHYROID")?.code).toBe(
      "PRO_FACT_META_B_HYPOTHYROID",
    );
    expect(resolveKitImage("PRO FACT THYROID CARE")?.code).toBe("PRO_FACT_THYROID_CARE");
  });
});

describe("mapKitNameForDisplay — governed alternatives keep their own name", () => {
  // A parallel bug to the packshot one, found while verifying Case D live:
  // "PRO_IMMUNE_1" contains "PRO IMMUNE" and "IRON_UP_1" contains "IRON UP",
  // so both matched fuzzy display-name rules meant for PRO_IMMUNE_GOLD /
  // IRON_UP_GOLD and rendered the CANONICAL kit's name on a row that was
  // dispensing the cheaper alternative — confirmed live: a substituted
  // PRO_IMMUNE_1 phase printed "Pro Immune 5" beside its own correct
  // packshot, a name/product mismatch on a real patient's report.
  const CASES: [kitId: string, displayName: string, mustNotBe: string][] = [
    ["PRO_IMMUNE_1", "PRO IMMUNE 1", "Pro Immune 5"],
    ["IRON_UP_1", "IRON UP 1", "Iron Up Gold"],
  ];

  for (const [kitId, displayName, mustNotBe] of CASES) {
    it(`${kitId} renders "${displayName}", never "${mustNotBe}"`, () => {
      const view = mapClinicalReportToPrintPresentation(
        report([phase(kitId, displayName)]),
        context,
      );
      const kit = [...view.treatmentPlan, ...view.additionalCare][0]!;
      expect(kit.name).not.toBe(mustNotBe);
      expect(kit.name).toContain(displayName.split(" ")[0]);
    });
  }
});
