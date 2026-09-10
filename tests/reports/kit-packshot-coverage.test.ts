// Every kit a doctor can put in front of a patient must resolve a packshot.
//
// A missing mapping is not cosmetic: the one-pager renders the carton beside
// a price, and an empty white box next to "₹1,655" asks someone to buy a
// product the page cannot show them.
//
// Resolution is asserted through the REPORT PATH (kitAssetCode ->
// getProductAsset), not by probing the asset registry directly: the registry
// is keyed by display codes ("HAIR_FACT_ALOPECIA_AREATA") while commerce
// speaks canonical ids ("ALOPECIA_AREATA"), and only the report path performs
// that translation. Probing the registry would report false gaps for kits
// that in fact render correctly.
import { describe, expect, it } from "vitest";
import { mapClinicalReportToPrintPresentation, type OnePageReportContext } from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import { APPROVED_SUBSTITUTIONS } from "../../apps/patient-portal/src/lib/commerce/budgetSubstitution";
import type { ClinicalReport, TreatmentPhase } from "../../src/packages/ai-engine/report-engine/types";

/**
 * Governed alternative SKUs with no packshot anywhere in the repository.
 *
 * Awaiting product photography from the clinic. Do NOT resolve these by
 * pointing them at the canonical kit's image: the substitute is a different
 * product, and showing the original's carton would misrepresent what the
 * patient actually receives. The list must SHRINK; a kit added in future
 * without an asset fails this suite immediately rather than joining an
 * invisible backlog.
 */
const AWAITING_PRODUCT_PHOTOGRAPHY = [
  "F4_PLUS",
  "GI_HEALTH_1",
  "HYPOTHYROID_2",
  "IRON_UP_1",
  "M4_PLUS",
  "PRO_IMMUNE_1",
  "SHED_CONTROL",
  "STRESS_BUST_3",
];

const context: OnePageReportContext = {
  assessmentId: "packshot-coverage",
  approval: { status: "APPROVED", approvedAt: "2026-09-10T00:00:00.000Z" },
};

/** Renders one kit through the real report path and returns its packshot. */
function packshotFor(kitId: string): { src: string } | null {
  const phase: TreatmentPhase = {
    phase: 1,
    kitId,
    displayName: kitId,
    whySelected: "",
    supportingConditions: [],
    keyIngredients: [],
    mechanismOfAction: [],
    formulationGroups: [],
  } as TreatmentPhase;

  const report = {
    patientSummary: {
      name: "Asset Probe",
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
    treatmentStrategy: [phase],
    topicalRecommendations: [],
    topicalCautions: [],
    recoveryRoadmap: [],
    recoveryMilestones: [],
    dietAndLifestyle: [],
    generatedAt: "2026-09-10T00:00:00.000Z",
    schemaVersion: "v4",
  } as unknown as ClinicalReport;

  const view = mapClinicalReportToPrintPresentation(report, context);
  const kit = [...view.treatmentPlan, ...view.additionalCare][0];
  return kit?.asset ?? null;
}

// The raw clinical spellings the kit-scorer actually emits for each canonical
// kit that carries an approved alternative — this is what reaches the report.
const CANONICAL_AS_ENGINE_EMITS_IT: Record<string, string> = {
  PHENOTYPE_INFLAMMATION: "PHENOTYPE INFLAMATION",
  MPHL: "MPHL",
  FPHL: "FPHL",
  META_B_HYPOTHYROID: "PRO FACT META B HYPOTHYROID",
  TE_GOLD: "HAIR FACT TE GOLD",
  IRON_UP_GOLD: "IRON UP GOLD",
  GI_GOLD: "PRO FACT GI GOLD",
  PRO_IMMUNE_GOLD: "PRO IMMUNE GOLD",
  RWL_SHIELD: "RAPID WEIGHT LOSS SHIELD",
  NIGHT_SHIFT: "HAIR FACT NIGHT SHIFT",
  FREQUENT_FLYERS: "HAIR FACT FREQUENT FLYERS",
  TTM_SUPPORT: "HAIR FACT TTM (OCD)",
};

describe("TEST CASE 9 — packshot coverage", () => {
  it("every canonical kit that can be substituted renders its own packshot", () => {
    const missing = Object.entries(CANONICAL_AS_ENGINE_EMITS_IT)
      .filter(([, spelling]) => packshotFor(spelling) === null)
      .map(([canonical]) => canonical);
    expect(missing).toEqual([]);
  });

  it("the alternative-SKU packshot gap is exactly the known list", () => {
    const alternatives = [
      ...new Set(APPROVED_SUBSTITUTIONS.map((s) => s.alternativeKitId as string)),
    ];
    const missing = alternatives.filter((kitId) => packshotFor(kitId) === null).sort();
    expect(missing).toEqual([...AWAITING_PRODUCT_PHOTOGRAPHY].sort());
  });

  it("the awaiting-photography list contains only real alternative SKUs", () => {
    const alternatives = APPROVED_SUBSTITUTIONS.map((s) => s.alternativeKitId as string);
    for (const kitId of AWAITING_PRODUCT_PHOTOGRAPHY) {
      expect(alternatives).toContain(kitId);
    }
  });

  it("an alternative must never borrow its canonical kit's packshot", () => {
    // If the gap above is ever "fixed" by aliasing, this catches it: the
    // substitute and the original are different products.
    for (const pair of APPROVED_SUBSTITUTIONS) {
      const alt = packshotFor(pair.alternativeKitId as string);
      if (!alt) continue;
      const canonical = packshotFor(CANONICAL_AS_ENGINE_EMITS_IT[pair.canonicalKitId] ?? pair.canonicalKitId);
      if (!canonical) continue;
      expect(alt.src).not.toBe(canonical.src);
    }
  });
});
