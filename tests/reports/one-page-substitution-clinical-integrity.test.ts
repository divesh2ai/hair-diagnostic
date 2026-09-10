// A governed budget substitution replaces the PRODUCT and nothing else.
//
// The one-pager resolves every clinical column from kit NAME TEXT
// (kitTagPattern, roleForKit, interpretationLookupForKit, tagRelevantToKit,
// clinicalMeaningForKit). Before this suite's fix, a substituted row carried
// the substitute's name into all of those, so "F4+" — which matches none of
// the FPHL vocabulary — silently inherited another indication's meaning:
// interpretationLookupForKit answers an unmatched pattern with the FIRST
// interpretation in the list, which on this fixture is trichotillomania.
//
// These are clinical-correctness regressions, not cosmetics: the row tells a
// patient why they are taking something.
import { describe, expect, it } from "vitest";
import {
  clinicalIdentityOf,
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
  type PrintTreatmentKit,
} from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import { clinicalMeaningForKit } from "../../apps/patient-portal/src/lib/reports/one-page/clinicalCopy";
import type {
  ClinicalReport,
  TreatmentPhase,
} from "../../src/packages/ai-engine/report-engine/types";

function phase(overrides: Partial<TreatmentPhase>): TreatmentPhase {
  return {
    phase: 1,
    kitId: "",
    displayName: "",
    whySelected: "",
    supportingConditions: [],
    keyIngredients: [],
    mechanismOfAction: [],
    formulationGroups: [],
    ...overrides,
  };
}

const TTM_PHASE = phase({
  phase: 1,
  kitId: "HAIR FACT TTM (OCD)",
  displayName: "HAIR FACT TTM (OCD)",
  supportingConditions: ["Hair pulling habit (Trichotillomania)"],
});

const FPHL_PHASE = phase({
  phase: 2,
  kitId: "FPHL",
  displayName: "FPHL",
  supportingConditions: ["Grade 1 — Ludwig 1"],
});

/**
 * The FPHL row after the doctor substituted F4+, shaped exactly as the
 * kit-substitution route persists it: the product fields are the
 * substitute's, and `meta.substitution.originalPhase` preserves the kit that
 * earned the row.
 */
const FPHL_SUBSTITUTED_PHASE = {
  ...phase({
    phase: 2,
    kitId: "F4_PLUS",
    displayName: "F4+",
    whySelected: "Doctor-selected budget alternative to FPHL, for affordability.",
    supportingConditions: ["Grade 1 — Ludwig 1"],
  }),
  meta: {
    substitution: {
      type: "BUDGET",
      reason: "BUDGET_AFFORDABILITY",
      originalKitId: "FPHL",
      originalPhase: FPHL_PHASE,
      changedBy: "doctor-1",
      changedAt: "2026-09-10T00:00:00.000Z",
      priceAtSubstitutionMinor: { canonical: 358300, alternative: 163900 },
    },
  },
} as unknown as TreatmentPhase;

const PRO_IMMUNE_PHASE = phase({
  phase: 3,
  kitId: "PRO IMMUNE GOLD",
  displayName: "PRO IMMUNE GOLD",
  supportingConditions: ["Non-vegetarian"],
});

/**
 * Real root-cause drivers, so the driver pool has more than one member and
 * the claiming logic is genuinely exercised. With an empty pool the builder
 * falls back to a single synthetic driver that every row must share, which
 * would make a uniqueness assertion vacuous.
 */
const ROOT_CAUSES = {
  primary: [
    {
      condition: "Trichotillomania",
      supportingSignals: ["Hair pulling habit (Trichotillomania)"],
      impact: "Mechanical follicular trauma",
      clinicalRelevance: "Repeated pulling damages the follicle.",
    },
    {
      condition: "Female pattern hair loss",
      supportingSignals: ["Grade 1 — Ludwig 1"],
      impact: "Androgen-sensitive miniaturisation",
      clinicalRelevance: "Ludwig 1 density loss across the midline.",
    },
  ],
  secondary: [
    {
      condition: "Immune and nutritional load",
      supportingSignals: ["Non-vegetarian"],
      impact: "Nutritional support requirement",
      clinicalRelevance: "Dietary pattern informs micronutrient support.",
    },
  ],
  amplifiers: [],
};

function makeReport(phases: TreatmentPhase[]): ClinicalReport {
  return {
    patientSummary: {
      name: "Test Patient",
      age: 28,
      gender: "Female",
      goal: ["Reduce hair fall and improve growth"],
      hairLossPattern: ["Grade 1 — Ludwig 1"],
      scalpConcerns: [],
      lifestyleFactors: [],
      medicalFactors: [],
      previousTreatments: [],
      questionnaireSelections: {
        cause: ["Hair pulling habit (Trichotillomania)"],
        grade: ["Grade 1 — Ludwig 1"],
        diet: ["Non-vegetarian"],
      },
      // Order matters: TTM is FIRST, so an unmatched pattern falls onto it.
      // That is precisely the failure this suite pins.
      clinicalInterpretation: [
        {
          condition: "Trichotillomania",
          signal: "Hair pulling habit (Trichotillomania)",
          interpretation:
            "Compulsive hair pulling is consistent with mechanical follicular trauma.",
        },
        {
          condition: "Female pattern hair loss",
          signal: "Grade 1 — Ludwig 1",
          interpretation:
            "Ludwig 1 density loss is consistent with androgen-sensitive miniaturisation.",
        },
      ],
    },
    rootCauseAnalysis: ROOT_CAUSES,
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

const context: OnePageReportContext = {
  assessmentId: "substitution-clinical-integrity",
  approval: { status: "APPROVED", approvedAt: "2026-09-10T00:00:00.000Z" },
};

function allKits(phases: TreatmentPhase[]): PrintTreatmentKit[] {
  const view = mapClinicalReportToPrintPresentation(makeReport(phases), context);
  return [...view.treatmentPlan, ...view.additionalCare];
}

const findByName = (kits: PrintTreatmentKit[], fragment: RegExp) =>
  kits.find((kit) => fragment.test(kit.name));

describe("TEST CASE 1 — substitution preserves clinical integrity", () => {
  const kits = allKits([TTM_PHASE, FPHL_SUBSTITUTED_PHASE, PRO_IMMUNE_PHASE]);
  const f4 = findByName(kits, /F4\+/);

  it("the substituted row is displayed as the supplied product", () => {
    expect(f4).toBeDefined();
    // ...and the kit it replaced is no longer offered as a product.
    expect(findByName(kits, /FPHL Pro/)).toBeUndefined();
  });

  it("its CLINICAL identity remains the kit that earned the row", () => {
    const identity = clinicalIdentityOf(f4!);
    expect(identity.name).toMatch(/FPHL/i);
    expect(identity.name).not.toMatch(/F4\+/);
  });

  it("Ludwig 1 stays mapped to the substituted row", () => {
    const text = `${f4!.linkedDrivers.join(" ")} ${f4!.selectedBecause} ${f4!.mappedCondition}`;
    expect(text).toMatch(/ludwig|pattern|fphl/i);
  });

  it("the FPHL interpretation is unchanged, and TTM's is NOT borrowed", () => {
    expect(f4!.mappedInterpretation ?? "").toMatch(/androgen|miniaturis|ludwig/i);
    expect(f4!.mappedInterpretation ?? "").not.toMatch(/pulling|trichotillomania/i);
  });

  it("no trichotillomania trigger is attached to F4+", () => {
    const bag = `${f4!.linkedDrivers.join(" ")} ${f4!.selectedBecause}`;
    expect(bag).not.toMatch(/pulling|trichotillomania|ocd/i);
  });

  it("no dietary trigger is attached to F4+", () => {
    const bag = `${f4!.linkedDrivers.join(" ")} ${f4!.selectedBecause}`;
    expect(bag).not.toMatch(/vegetarian|non-veg/i);
  });

  it("approved clinical copy resolves through the canonical identity", () => {
    const identity = clinicalIdentityOf(f4!);
    // Keyed on the substitute this returns null (no copy family for "F4+"),
    // which is what dropped the row to a wrong-meaning fallback.
    expect(
      clinicalMeaningForKit({ kitCode: "F4_PLUS", name: "F4+", triggers: [] }),
    ).toBeNull();
    expect(
      clinicalMeaningForKit({
        kitCode: identity.code,
        name: identity.name,
        triggers: f4!.linkedDrivers,
      }),
    ).toBeTruthy();
  });

  it("records the substitution for the display layer", () => {
    expect(f4!.substitution).toMatchObject({ fromKitId: "FPHL", toKitId: "F4_PLUS" });
  });
});

describe("TEST CASE 2 — TTM deduplication", () => {
  const kits = allKits([TTM_PHASE, FPHL_SUBSTITUTED_PHASE, PRO_IMMUNE_PHASE]);

  it("Hair Fact TTM appears exactly once", () => {
    expect(kits.filter((kit) => /ttm/i.test(`${kit.kitCode} ${kit.name}`))).toHaveLength(1);
  });

  it("the hair-pulling trigger appears in exactly one row", () => {
    const rowsCarryingPulling = kits.filter((kit) =>
      /pulling|trichotillomania/i.test(`${kit.linkedDrivers.join(" ")} ${kit.selectedBecause}`),
    );
    expect(rowsCarryingPulling).toHaveLength(1);
    expect(rowsCarryingPulling[0]!.name).toMatch(/ttm/i);
  });

  it("no driver is claimed by two rows", () => {
    const ids = kits.map((kit) => kit.mappedDriverId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("TEST CASE 3 — dietary indicator maps to Pro Immune, not the pattern row", () => {
  const kits = allKits([TTM_PHASE, FPHL_SUBSTITUTED_PHASE, PRO_IMMUNE_PHASE]);

  it("the dietary trigger never lands on the pattern row", () => {
    const f4 = findByName(kits, /F4\+/)!;
    expect(`${f4.linkedDrivers.join(" ")}`).not.toMatch(/vegetarian/i);
  });

  it("Pro Immune is present and carries its own clinical identity", () => {
    const proImmune = findByName(kits, /immune/i);
    expect(proImmune).toBeDefined();
    expect(clinicalIdentityOf(proImmune!).name).toMatch(/immune/i);
  });
});

describe("TEST CASE 4 — Clinical Meaning is stored, never generated", () => {
  it("the report composition layer imports no AI/LLM client", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const path = await import("node:path");
    const roots = [
      "apps/patient-portal/src/lib/reports/one-page",
      "apps/patient-portal/src/components/reports/one-page",
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      const dir = path.join(process.cwd(), root);
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const src = readFileSync(path.join(dir, entry.name), "utf8");
        if (/from\s+["'](openai|@anthropic-ai\/[^"']+|@google\/generative-ai)["']/.test(src)) {
          offenders.push(`${root}/${entry.name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Clinical Meaning comes from the stored clinicalInterpretation", () => {
    const kits = allKits([TTM_PHASE, FPHL_SUBSTITUTED_PHASE, PRO_IMMUNE_PHASE]);
    const ttm = findByName(kits, /ttm/i)!;
    // Verbatim from the report's stored interpretation — not paraphrased.
    expect(ttm.mappedInterpretation).toBe(
      "Compulsive hair pulling is consistent with mechanical follicular trauma.",
    );
  });
});

describe("substitution changes the product only — the unsubstituted control", () => {
  it("the same case without substitution maps FPHL identically", () => {
    const substituted = allKits([TTM_PHASE, FPHL_SUBSTITUTED_PHASE, PRO_IMMUNE_PHASE]);
    const original = allKits([TTM_PHASE, FPHL_PHASE, PRO_IMMUNE_PHASE]);

    const f4 = findByName(substituted, /F4\+/)!;
    // Unsubstituted, the row renders under its governed display name.
    const fphl = findByName(original, /FPHL Pro/)!;

    // Everything clinical is identical; only the product differs.
    expect(f4.mappedCondition).toBe(fphl.mappedCondition);
    expect(f4.mappedInterpretation).toBe(fphl.mappedInterpretation);
    expect(f4.role).toBe(fphl.role);
    expect(f4.linkedDrivers).toEqual(fphl.linkedDrivers);
    expect(f4.name).not.toBe(fphl.name);
  });
});
