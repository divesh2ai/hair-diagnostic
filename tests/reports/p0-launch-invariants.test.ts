// P0 launch invariants for the report/cart surfaces.
//
// These pin behaviours that were each a live defect, and each of which is
// invisible to a type checker: a trigger landing on the wrong row, a channel
// quietly growing its own clinical mapping, a patient-editable prescription
// quantity, a protocol duration inferred from box count, and a doctor block
// that can render empty.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
} from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import type { ClinicalReport, TreatmentPhase } from "../../src/packages/ai-engine/report-engine/types";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

const CART_PAGE = "apps/patient-portal/src/app/cart/[assessmentId]/page.tsx";
const CART_ROUTE = "apps/patient-portal/src/app/api/cart/[assessmentId]/route.ts";

function phase(kitId: string, supporting: string[]): TreatmentPhase {
  return {
    phase: 1,
    kitId,
    displayName: kitId,
    whySelected: "",
    supportingConditions: supporting,
    keyIngredients: [],
    mechanismOfAction: [],
    formulationGroups: [],
  } as TreatmentPhase;
}

const context: OnePageReportContext = {
  assessmentId: "p0-launch-invariants",
  approval: { status: "APPROVED", approvedAt: "2026-09-10T00:00:00.000Z" },
};

function view(phases: TreatmentPhase[]) {
  const report = {
    patientSummary: {
      name: "Test Patient",
      age: 28,
      gender: "Female",
      goal: [],
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
      clinicalInterpretation: [
        {
          condition: "Trichotillomania",
          signal: "Hair pulling habit (Trichotillomania)",
          interpretation: "Compulsive hair pulling is consistent with mechanical follicular trauma.",
        },
        {
          condition: "Female pattern hair loss",
          signal: "Grade 1 — Ludwig 1",
          interpretation: "Ludwig 1 density loss is consistent with androgen-sensitive miniaturisation.",
        },
        {
          condition: "Immune and nutritional load",
          signal: "Non-vegetarian",
          interpretation: "Dietary pattern informs the micronutrient support this plan provides.",
        },
      ],
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
  const v = mapClinicalReportToPrintPresentation(report, context);
  return [...v.treatmentPlan, ...v.additionalCare];
}

describe("governed diet indicator maps to Pro Immune", () => {
  const kits = view([
    phase("HAIR FACT TTM (OCD)", ["Hair pulling habit (Trichotillomania)"]),
    phase("FPHL", ["Grade 1 — Ludwig 1"]),
    phase("PRO IMMUNE GOLD", ["Non-vegetarian"]),
  ]);

  it("the dietary answer lands on the Pro Immune row", () => {
    const proImmune = kits.find((k) => /immune/i.test(k.name))!;
    expect(`${proImmune.linkedDrivers.join(" ")} ${proImmune.selectedBecause}`).toMatch(
      /vegetarian/i,
    );
  });

  it("and on no other row", () => {
    const carrying = kits.filter((k) =>
      /vegetarian/i.test(`${k.linkedDrivers.join(" ")} ${k.selectedBecause}`),
    );
    expect(carrying).toHaveLength(1);
    expect(carrying[0]!.name).toMatch(/immune/i);
  });

  it("an unmapped kit claims no triggers at all rather than every trigger", () => {
    // Fail-closed: tagRelevantToKit used to accept everything when a kit had
    // no governed pattern, which is how unrelated answers spread across rows.
    const unknown = view([phase("SOME UNGOVERNED KIT", ["Hair pulling habit (Trichotillomania)"])]);
    const row = unknown[0]!;
    expect(row.linkedDrivers.join(" ")).not.toMatch(/pulling/i);
  });

  it("an unmatched kit shows no clinical meaning rather than borrowing one", () => {
    const unknown = view([phase("SOME UNGOVERNED KIT", [])]);
    expect(unknown[0]!.mappedInterpretation).toBeNull();
  });
});

describe("browser / PDF / share consume one clinical mapping", () => {
  const channels = [
    "apps/patient-portal/src/app/reports/[assessmentId]/one-page/page.tsx",
    "apps/patient-portal/src/app/patient/report/[token]/page.tsx",
    "apps/patient-portal/src/app/internal/render/one-pager/[token]/page.tsx",
  ];

  it("every one-pager channel renders the same component", () => {
    for (const channel of channels) {
      expect(read(channel)).toMatch(/OnePageHairReport/);
    }
  });

  it("no channel builds clinical mapping of its own", () => {
    // The mapping lives in viewModel.ts. A channel importing the copy registry
    // or re-deriving interpretations directly would be a second source of
    // truth, which is how the four surfaces drift apart.
    for (const channel of channels) {
      const src = read(channel);
      expect(src).not.toMatch(/clinicalMeaningForKit/);
      expect(src).not.toMatch(/kitTagPattern/);
    }
  });
});

describe("patient cart — prescribed quantity is read-only", () => {
  const src = read(CART_PAGE);

  it("has no quantity stepper or quantity state", () => {
    expect(src).not.toMatch(/QtyStepper/);
    expect(src).not.toMatch(/MAX_QTY/);
    expect(src).not.toMatch(/setQty/);
  });

  it("no longer warns that quantity changes are unsaved", () => {
    // The contradiction this removes: "order confirmed" beside "your changes
    // aren't saved". A patient can no longer create that state.
    expect(src).not.toMatch(/aren.t saved to your order/i);
    expect(src).not.toMatch(/changed the quantities/i);
  });

  it("renders the doctor's quantity verbatim", () => {
    expect(src).toMatch(/Qty \{li\.quantity\}/);
  });
});

describe("patient cart — protocol duration is not derived from box count", () => {
  // Comments are stripped first: the file deliberately explains which claim
  // was removed, and naming it in prose is not making it.
  const src = read(CART_PAGE)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("does not compute months from quantities", () => {
    expect(src).not.toMatch(/totalMonths/);
  });

  it("does not label the subtotal with a derived plan length", () => {
    expect(src).not.toMatch(/-month plan/);
  });

  it("the cart API never sends a duration it does not have", () => {
    // The endpoint receives approved kitIds only; inventing a duration here
    // is what produced "6-month plan" from three kits taken twice.
    expect(read(CART_ROUTE)).not.toMatch(/month/i);
  });
});

describe("patient cart — doctor identity always renders something true", () => {
  const src = read(CART_PAGE);

  it("falls back to initials when there is no photo", () => {
    expect(src).toMatch(/doctorInitials/);
    expect(src).toMatch(/cart\.doctor\.photoUrl \?/);
  });

  it("shows name and specialty when present", () => {
    expect(src).toMatch(/cart\.doctor\.name/);
    expect(src).toMatch(/cart\.doctor\.specialization/);
  });

  it("the API resolves the doctor from the approved order", () => {
    const route = read(CART_ROUTE);
    expect(route).toMatch(/doctor:\s*\{/);
    expect(route).toMatch(/avatarUrl \?\? intent\.doctor\.photoUrl \?\? null/);
  });
});
