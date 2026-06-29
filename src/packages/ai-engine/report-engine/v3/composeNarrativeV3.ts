/**
 * V3 Narrative Composer.
 *
 * Takes the V4 ClinicalReport (the structured source of truth) and turns it
 * into the V3 narrative — a concise, patient-facing voice that follows the
 * chain Signals → Barriers → Strategy → Kits → Ingredients → Outlook → Lifestyle.
 *
 * Deterministic, no AI. Every line is grounded in the report's already-validated
 * data; this module only re-voices and prunes for the patient lens.
 */

import type { ClinicalReport, RootCauseCondition } from "../types";
import type { RootCause } from "../../../types";
import { brandNameFor } from "./kitBrandNames";
import {
  BARRIER_BY_ROOT_CAUSE,
  SCALP_INFLAMMATION_BARRIER,
  SHAFT_BREAKAGE_BARRIER,
  type BarrierDef,
} from "./barrierMap";
import type {
  ClinicalSummarySection,
  DietLifestyleLine,
  DietLifestyleSection,
  NarrativeReportV3,
  RecommendedKitEntry,
  RecommendedKitsSection,
  RecoveryOutlookSection,
  RecoveryStrategySection,
} from "./types";

const MAX_FACTORS = 5;
const MAX_BARRIERS = 5;
const MIN_BARRIERS = 3;
const MAX_DIET_RECS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Reverse map: V4 root-cause display name → BarrierDef.
// V4 ROOT_CAUSE_DISPLAY is the canonical source — we mirror it here so V3 can
// take a ClinicalReport alone and still resolve barriers.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT_CAUSE_DISPLAY_TO_KEY: Record<string, RootCause> = {
  "Chronic stress": "STRESS",
  "Androgen (DHT) drive": "DHT",
  "Genetic predisposition": "GENETICS",
  "Iron deficiency": "IRON_DEFICIENCY",
  "Hypothyroid axis": "HYPOTHYROID",
  "Hyperthyroid axis": "HYPERTHYROID",
  "PCOS hormonal imbalance": "PCOS",
  "Metabolic dysfunction": "METABOLIC",
  "Nutritional insufficiency": "POOR_NUTRITION",
  "Post-partum hormonal shift": "POST_PARTUM",
  "Gut malabsorption": "GUT_MALABSORPTION",
  "Oxidative stress": "OXIDATIVE_STRESS",
  "Medication-induced": "MEDICATION",
  "Post-illness recovery": "ILLNESS",
  "Rapid weight loss": "RAPID_WEIGHT_LOSS",
  "Autoimmune activity": "AUTOIMMUNE",
  "Circadian disruption": "CIRCADIAN_DISRUPTION",
  "Compulsive pulling": "TRICHOTILLOMANIA",
  "Hormonal transition": "HORMONAL_SHIFT",
};

function barrierForCondition(cond: RootCauseCondition): BarrierDef | null {
  const key = ROOT_CAUSE_DISPLAY_TO_KEY[cond.condition];
  if (key) return BARRIER_BY_ROOT_CAUSE[key];
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Clinical Summary & Barriers
// ─────────────────────────────────────────────────────────────────────────────

function buildClinicalSummary(report: ClinicalReport): ClinicalSummarySection {
  const allConditions = [
    ...report.rootCauseAnalysis.primary,
    ...report.rootCauseAnalysis.secondary,
    ...report.rootCauseAnalysis.amplifiers,
  ];

  // Identified factors = unique condition display names, primary first.
  const factorSet = new Set<string>();
  for (const c of allConditions) {
    if (factorSet.size >= MAX_FACTORS) break;
    factorSet.add(c.condition);
  }
  const identifiedFactors = Array.from(factorSet);

  // Build barriers from the same conditions, prefer Primary, dedupe by name.
  const barriers: BarrierDef[] = [];
  const seenNames = new Set<string>();
  const ordered = [
    ...report.rootCauseAnalysis.primary,
    ...report.rootCauseAnalysis.secondary,
    ...report.rootCauseAnalysis.amplifiers,
  ];
  for (const c of ordered) {
    if (barriers.length >= MAX_BARRIERS) break;
    const b = barrierForCondition(c);
    if (b && !seenNames.has(b.name)) {
      barriers.push(b);
      seenNames.add(b.name);
    }
  }

  // Add scalp inflammation if the patient summary flagged it.
  const hasScalp = report.patientSummary.scalpConcerns.length > 0;
  if (
    hasScalp &&
    barriers.length < MAX_BARRIERS &&
    !seenNames.has(SCALP_INFLAMMATION_BARRIER.name)
  ) {
    barriers.push(SCALP_INFLAMMATION_BARRIER);
    seenNames.add(SCALP_INFLAMMATION_BARRIER.name);
  }

  // Add shaft breakage if the pattern signals it.
  const hasBreakage = report.patientSummary.hairLossPattern.some((p) =>
    /breakage|broken|short/i.test(p)
  );
  if (
    hasBreakage &&
    barriers.length < MAX_BARRIERS &&
    !seenNames.has(SHAFT_BREAKAGE_BARRIER.name)
  ) {
    barriers.push(SHAFT_BREAKAGE_BARRIER);
    seenNames.add(SHAFT_BREAKAGE_BARRIER.name);
  }

  // If under-fired, soften the floor — patient still needs to see something.
  const minBarriers = Math.min(MIN_BARRIERS, barriers.length || MIN_BARRIERS);

  return {
    leadIn: "Based on your assessment, we identified the following factors affecting your hair health:",
    identifiedFactors,
    collectiveEffect:
      "Together, these factors are contributing to increased hair fall, reduced density, weaker follicles, and slower recovery.",
    barriersHeading: "What's Limiting Your Hair Recovery",
    barriers: barriers.slice(0, Math.max(minBarriers, barriers.length)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Recovery Strategy
// ─────────────────────────────────────────────────────────────────────────────

interface FocusAreaRule {
  test: (rcs: Set<string>) => boolean;
  label: string;
}

const FOCUS_AREA_RULES: FocusAreaRule[] = [
  { label: "Stopping active shedding", test: (s) => s.has("STRESS") || s.has("POST_PARTUM") || s.has("ILLNESS") || s.has("RAPID_WEIGHT_LOSS") },
  { label: "Follicular support and protection", test: (s) => s.has("DHT") || s.has("GENETICS") || s.has("AUTOIMMUNE") },
  { label: "Inflammation reduction", test: (s) => s.has("OXIDATIVE_STRESS") || s.has("AUTOIMMUNE") || s.has("METABOLIC") || s.has("GUT_MALABSORPTION") },
  { label: "Nutritional restoration", test: (s) => s.has("POOR_NUTRITION") || s.has("IRON_DEFICIENCY") || s.has("GUT_MALABSORPTION") || s.has("RAPID_WEIGHT_LOSS") },
  { label: "Hormonal balance", test: (s) => s.has("PCOS") || s.has("HYPOTHYROID") || s.has("HYPERTHYROID") || s.has("HORMONAL_SHIFT") || s.has("POST_PARTUM") },
  { label: "Metabolic optimisation", test: (s) => s.has("METABOLIC") || s.has("PCOS") },
  { label: "Stress and sleep recovery", test: (s) => s.has("STRESS") || s.has("CIRCADIAN_DISRUPTION") || s.has("OXIDATIVE_STRESS") },
  { label: "Gut and absorption support", test: (s) => s.has("GUT_MALABSORPTION") || s.has("POOR_NUTRITION") },
  { label: "Immune balance", test: (s) => s.has("AUTOIMMUNE") || s.has("ILLNESS") },
];

function buildRecoveryStrategy(report: ClinicalReport): RecoveryStrategySection {
  const causeKeys = new Set<string>();
  const all = [
    ...report.rootCauseAnalysis.primary,
    ...report.rootCauseAnalysis.secondary,
    ...report.rootCauseAnalysis.amplifiers,
  ];
  for (const c of all) {
    const k = ROOT_CAUSE_DISPLAY_TO_KEY[c.condition];
    if (k) causeKeys.add(k);
  }

  const focusAreas = FOCUS_AREA_RULES
    .filter((r) => r.test(causeKeys))
    .map((r) => r.label)
    .slice(0, 6);

  // Floor — every patient gets at least follicular support.
  if (focusAreas.length === 0) focusAreas.push("Follicular support and protection");

  return {
    heading: "How We Plan To Address These Barriers",
    intro:
      "Based on the barriers identified above, we've selected a combination of therapies designed to address the underlying biological drivers contributing to your hair concerns. This approach focuses on:",
    focusAreas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Recommended Kits
// ─────────────────────────────────────────────────────────────────────────────

function buildRecommendedKits(report: ClinicalReport): RecommendedKitsSection {
  const kits: RecommendedKitEntry[] = report.treatmentStrategy.map((phase) => {
    // V4 mechanismOfAction strings carry a "Lever → effect" structure
    // ("DHT control → reduces hormonal impact on follicles"). For V3 we
    // surface the patient-facing effect (right of arrow) where possible.
    const therapeuticFocus = phase.mechanismOfAction
      .slice(0, 6)
      .map((line) => {
        const idx = line.indexOf("→");
        return idx === -1 ? line.trim() : line.slice(idx + 1).trim();
      })
      .map((line) => line.replace(/\.$/, ""));

    // Pass through the verbatim formulation rationale from "All Kits Info".
    const formulationGroups = (phase.formulationGroups ?? []).map((g) => ({
      group: g.group,
      action: g.action,
      ingredients: [...g.ingredients],
    }));

    return {
      name: brandNameFor(phase.kitId),
      whySelected: phase.whySelected,
      therapeuticFocus: therapeuticFocus.length ? therapeuticFocus : ["Follicle support"],
      formulationGroups,
    };
  });

  return {
    heading: "Recommended Recovery Protocol",
    intro:
      "Based on your assessment and recovery goals, we selected the following kits because together they address the greatest number of biological drivers contributing to your hair concerns.",
    kits,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Recovery Outlook
// ─────────────────────────────────────────────────────────────────────────────

function buildRecoveryOutlook(_report: ClinicalReport): RecoveryOutlookSection {
  return {
    heading: "Expected Recovery Milestones",
    entries: [
      {
        period: "Month 1",
        milestones: [
          "Reduction in active shedding",
          "Improved follicular stability",
        ],
      },
      {
        period: "Months 2–3",
        milestones: [
          "Improved hair quality",
          "Reduced shedding variability",
        ],
      },
      {
        period: "Months 3–6",
        milestones: [
          "Early density improvement",
          "Visible regrowth progression",
        ],
      },
      {
        period: "Months 6–12",
        milestones: [
          "Maximum expected recovery potential with consistent adherence",
        ],
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Diet & Lifestyle (≤ 5, each mapped to a barrier)
// ─────────────────────────────────────────────────────────────────────────────

function buildDietLifestyle(report: ClinicalReport): DietLifestyleSection {
  const seenConditions = new Set<string>();
  const recommendations: DietLifestyleLine[] = [];

  for (const rec of report.dietAndLifestyle) {
    if (recommendations.length >= MAX_DIET_RECS) break;
    if (seenConditions.has(rec.condition)) continue;
    seenConditions.add(rec.condition);
    recommendations.push({
      recommendation: rec.recommendation,
      whyItMatters: rec.expectedBenefit,
      mappedBarrier: rec.condition,
    });
  }

  // Universal floor — sleep / protein / activity are always relevant.
  const universals: DietLifestyleLine[] = [
    {
      recommendation: "Anchor 7+ hours of sleep within a consistent window.",
      whyItMatters: "Supports the cortisol and melatonin rhythms that drive a healthy hair cycle.",
    },
    {
      recommendation: "Include lean protein at every main meal.",
      whyItMatters: "Provides the keratin substrate your follicles need to produce stronger strands.",
    },
    {
      recommendation: "Brisk walk or resistance train at least 5 days a week.",
      whyItMatters: "Improves metabolic and circulatory health that supports the follicle environment.",
    },
  ];

  for (const u of universals) {
    if (recommendations.length >= MAX_DIET_RECS) break;
    if (recommendations.some((r) => r.recommendation === u.recommendation)) continue;
    recommendations.push(u);
  }

  return {
    heading: "Diet & Lifestyle Recommendations",
    recommendations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function composeNarrativeV3(report: ClinicalReport): NarrativeReportV3 {
  return {
    schemaVersion: "v3-narrative",
    generatedAt: new Date().toISOString(),
    patientName: report.patientSummary.name,
    clinicalSummary: buildClinicalSummary(report),
    recoveryStrategy: buildRecoveryStrategy(report),
    recommendedKits: buildRecommendedKits(report),
    recoveryOutlook: buildRecoveryOutlook(report),
    dietAndLifestyle: buildDietLifestyle(report),
  };
}
