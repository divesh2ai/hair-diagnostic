import { buildRuntimeFixture } from "./_runtime";

// Ruchi — Female Pattern Hair Loss at Ludwig 2 with endometriosis-linked
// hormonal inflammation and hypothyroidism. Routed through the runtime
// viewModel so every clinical-meaning, snapshot, and narrative rule the
// code layer enforces is reflected verbatim in the design preview / PDF.

export const ruchiRuntimeFixture = buildRuntimeFixture({
  assessmentId: "fixture-ruchi",
  patient: { name: "Ruchi", age: 34, sex: "Female", goal: ["Reduce hair fall and support quality growth"] },
  generatedAt: "04 Aug 2026",
  selections: {
    grade: "Grade 2 — Ludwig 2",
    duration: "3–6 months",
    count: "~50-100 strands (Noticeable)",
    hairtype: ["Widening parting"],
    scalp: ["Redness or irritation", "Recurrent Acne / Acne-prone skin"],
    hormonal: ["Endometriosis"],
    thyroid: ["Hypothyroidism"],
    immunity: [],
    gut: ["Indigestion"],
    deficiency: [],
    cause: ["Stress / Anxiety / Depression", "Genetics / Family history"],
    lifestyle: ["Smoking / Vaping", "Bodybuilding / Heavy gym"],
    diet: ["High protein diet"],
    treatment: ["Chemical treatment (colour / keratin)"],
    goal: ["Reduce hair fall and support quality growth"],
  },
  clinicalInterpretation: [
    {
      signal: "Endometriosis",
      condition: "Endometriosis-linked hormonal load",
      interpretation:
        "Endometriosis-linked hormonal pressure can shorten the active hair-growth phase and add to shedding.",
    },
  ],
  phases: [
    {
      kitId: "FH WELL 3",
      displayName: "FH Well 3",
      whySelected: "Endometriosis signal reported — foundational hormonal and inflammatory support.",
      supportingConditions: ["Endometriosis"],
      mechanismOfAction: [
        "Supports foundational hormonal balance",
        "Helps calm inflammatory burden",
        "Prepares the follicle environment for recovery",
      ],
    },
    {
      kitId: "PHENOTYPE INFLAMATION",
      displayName: "Phenotype Inflammation",
      whySelected: "Scalp redness, recurrent acne and oxidative-lifestyle signals.",
      supportingConditions: ["Scalp inflammation", "Oxidative stress"],
      mechanismOfAction: [
        "Reduces follicular stress signals",
        "Restores balanced immune response",
        "Prevents cellular damage",
      ],
    },
    {
      kitId: "PRO FACT META B HYPOTHYROID",
      displayName: "Pro Fact Meta B Hypothyroid",
      whySelected: "Hypothyroidism reported — metabolic slowing plus stress-amplified shedding pressure.",
      supportingConditions: ["Hypothyroidism"],
      mechanismOfAction: [
        "Supports metabolic activity",
        "Helps improve follicular energy supply",
        "Stabilises hair-cycle drive",
      ],
    },
    {
      kitId: "PRO IMMUNE GOLD",
      displayName: "Pro Immune 5",
      whySelected: "Broader immune-hygiene support alongside the endometriosis-linked inflammatory picture.",
      supportingConditions: ["Immune-related"],
      mechanismOfAction: [
        "Supports balanced immune function",
        "Helps reduce inflammatory pressure on the follicle environment",
      ],
    },
    {
      kitId: "FPHL",
      displayName: "FPHL Pro",
      whySelected: "Ludwig 2 pattern — protect vulnerable follicles and support hair calibre.",
      supportingConditions: ["Female pattern hair loss"],
      mechanismOfAction: [
        "Protects pattern-sensitive follicles",
        "Supports hair calibre and follicular resilience",
      ],
    },
  ],
  topicalRecommendations: [
    {
      name: "F-Emugrow MCRD",
      usage: "Apply once daily as prescribed. Massage gently. Do not rinse.",
      note: "For pattern thinning and responsive scalp areas.",
      whySelected: "Pattern-thinning support paired with the inflammation control kit.",
    },
  ],
});
