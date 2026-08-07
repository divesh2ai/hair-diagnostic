import { buildRuntimeFixture } from "./_runtime";

// Ravi (Ravsharan) — Male Pattern Hair Loss at Norwood III with rapid weight
// change following GLP-1 therapy. Routed through the runtime viewModel so
// every clinical-meaning, snapshot, and narrative rule the code layer
// enforces is reflected verbatim in the design preview / PDF.

export const raviFixture = buildRuntimeFixture({
  assessmentId: "fixture-ravi",
  patient: { name: "Ravi", age: 42, sex: "Male", goal: ["Reduce hair fall and improve growth"] },
  generatedAt: "04 Aug 2026",
  selections: {
    grade: "Grade 3 — Norwood III",
    duration: "3–6 months",
    count: "~50-100 strands (Noticeable)",
    hairtype: ["Hair on pillow / floor / shower"],
    scalp: ["Dandruff / itchy scalp"],
    hormonal: [],
    thyroid: [],
    immunity: ["Allergies"],
    gut: ["IBS / Crohn's"],
    deficiency: ["Pre-diabetes"],
    cause: [
      "Rapid weight loss / Crash diet",
      "Genetics / Family history",
      "Stress / Anxiety / Depression",
    ],
    lifestyle: ["Sedentary"],
    diet: ["Non-vegetarian"],
    treatment: ["GLP-1 therapy (Ozempic)"],
    goal: ["Reduce hair fall and improve growth"],
  },
  clinicalInterpretation: [
    {
      signal: "Iron / Anaemia",
      condition: "Iron deficiency hair loss",
      interpretation:
        "Low iron stores can reduce oxygen and nutrient delivery to the hair follicle and disrupt the growth cycle.",
    },
  ],
  phases: [
    {
      kitId: "RAPID WEIGHT LOSS SHIELD",
      displayName: "Rapid Weight Loss Shield",
      whySelected:
        "This kit is formulated to address the sudden calorie restriction and nutritional deficit created during weight loss which suppresses cellular metabolism.",
      supportingConditions: ["Rapid weight loss", "Nutrient deficit"],
      mechanismOfAction: [
        "Replaces commonly depleted vitamins and minerals",
        "Supports microbiome and intestinal integrity",
        "Preserves lean tissue",
        "Supports stress adaptation",
      ],
    },
    {
      kitId: "PRO FACT GI GOLD",
      displayName: "Pro Fact GI Gold",
      whySelected: "Strong gut-axis signal (IBS / Crohn's).",
      supportingConditions: ["Gut dysfunction", "IBS / Crohn's"],
      mechanismOfAction: [
        "Boosts the gut's natural defence",
        "Promotes beneficial flora",
        "Improves absorption across the gut-skin axis",
      ],
    },
    {
      kitId: "PHENOTYPE INFLAMATION",
      displayName: "Phenotype Inflammation",
      whySelected: "Scalp inflammation and oxidative-lifestyle signals.",
      supportingConditions: ["Scalp inflammation", "Oxidative stress"],
      mechanismOfAction: [
        "Reduces follicular stress signals",
        "Restores balanced immune response",
        "Prevents cellular damage",
      ],
    },
    {
      kitId: "PRO FACT META B",
      displayName: "Pro Fact Meta B",
      whySelected: "Pre-diabetic metabolic strain reported.",
      supportingConditions: ["Metabolic stress"],
      mechanismOfAction: [
        "Supports insulin sensitivity",
        "Helps improve metabolic balance",
        "Supports follicular energy supply",
      ],
    },
    {
      kitId: "PRO IMMUNE GOLD",
      displayName: "Pro Immune 5",
      whySelected: "Immune-related factors (allergies) with genetic pattern at age >= 30.",
      supportingConditions: ["Immune-related"],
      mechanismOfAction: ["Build immunity", "Reduces inflammatory stress"],
    },
  ],
  topicalRecommendations: [
    {
      name: "Minoxidil 5%",
      usage: "Apply once daily to the affected scalp area as directed by the doctor.",
      note: "Growth active for pattern thinning.",
      whySelected: "Early-grade pattern loss on a normal scalp — first-line follicle activator.",
    },
    {
      name: "Finasteride 0.25% Topical",
      usage: "Apply at night to thinning zones under doctor supervision.",
      note: "Standard local DHT block. Pair with Minoxidil for combination therapy.",
      whySelected: "Low-strength topical DHT block to pair with the Minoxidil activator.",
    },
  ],
});
