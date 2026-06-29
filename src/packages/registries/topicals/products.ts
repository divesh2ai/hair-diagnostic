/**
 * Topical Product Database.
 *
 * Source of truth: topical-engine.schema.json (PART3_TOPICAL_RECOMMENDATION_ENGINE).
 * 14 products with matching tags, scalp compatibility, gender, contraindications
 * and clinical mechanism data.
 *
 * Consumed by recommendTopicals() to surface a per-patient topical plan in the
 * clinical report.
 */

export interface TopicalProduct {
  /** Product display name — used by the report. */
  name: string;
  /** Indication tags used in scoring (hairfall, thinning, dandruff, pcos, etc.). */
  tags: string[];
  /** Scalp states this product is appropriate for. */
  scalpMatch: string[];
  /** Genders this product is licensed / preferred for. */
  gender: Array<"male" | "female">;
  /** Hard contraindications — e.g. pregnancy. */
  contraindications: string[];
  /** Whether the product is safe across the hormonal axis (no hormonal mech). */
  hormonalSafe: boolean;
  /** True for products with harsh actives (alcohol vehicle, minoxidil, etc.). */
  harsh: boolean;
  /** Form factor — null when not specified, otherwise oil / serum / shampoo. */
  category: "oil" | "serum" | "shampoo" | null;
  /** Patient-facing application instructions. */
  usage: string;
  /** One-line clinical note about when this product fits. */
  note: string;
  /** Active ingredients — present only for products where the source listed them. */
  ingredients?: string;
  /** Mechanism of action — present only for products where the source listed it. */
  mechanism?: string;
}

export const TOPICAL_PRODUCTS: TopicalProduct[] = [
  {
    name: "Minoxidil 5%",
    tags: ["hairfall", "thinning", "alopecia", "androgenetic"],
    scalpMatch: ["normal", "oily"],
    gender: ["male", "female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: true,
    category: null,
    usage: "Apply once daily to the affected scalp area as directed by the doctor.",
    note: "Growth active for pattern thinning. Avoid for female patients during pregnancy or conception planning.",
  },
  {
    name: "Minoxidil 2% + Finasteride 0.25% Topical",
    tags: ["hairfall", "thinning", "alopecia", "pcos", "androgenetic"],
    scalpMatch: ["normal", "oily"],
    gender: ["male", "female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: true,
    category: null,
    usage: "Apply at night on thinning zones only under doctor supervision.",
    note: "Doctor-choice topical for androgen-sensitive thinning. Avoid in pregnancy or conception planning.",
  },
  {
    name: "Minoxidil + Spironolactone Topical",
    tags: ["hairfall", "thinning", "pcos", "hormonal"],
    scalpMatch: ["normal", "oily"],
    gender: ["female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: true,
    category: null,
    usage: "Use only if prescribed for PCOS or androgen-linked female thinning.",
    note: "Avoid during pregnancy or conception planning.",
  },
  {
    name: "Ketoconazole Lotion / Shampoo",
    tags: ["dandruff", "fungal", "itching"],
    scalpMatch: ["dandruff", "oily", "fungal"],
    gender: ["male", "female"],
    contraindications: [],
    hormonalSafe: true,
    harsh: false,
    category: null,
    usage: "Use twice weekly; keep contact for 3–5 minutes before rinsing unless advised otherwise.",
    note: "Effective for Malassezia-driven dandruff, itching and oily-scalp inflammation.",
  },
  {
    name: "Ketoconazole + Growth Serum Combo",
    tags: ["dandruff", "fungal", "hairfall", "thinning"],
    scalpMatch: ["dandruff", "oily", "fungal"],
    gender: ["male", "female"],
    contraindications: [],
    hormonalSafe: true,
    harsh: false,
    category: null,
    usage: "Use ketoconazole twice weekly and a non-irritating growth serum on alternate nights.",
    note: "Best fit when dandruff and hair fall are both active.",
  },
  {
    name: "F-Emugrow MCRD",
    tags: ["hairfall", "thinning", "alopecia", "androgenetic", "pattern", "dht", "transplant", "sensitive"],
    scalpMatch: ["normal", "dry", "sensitive", "inflammation", "dandruff"],
    gender: ["male", "female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: false,
    category: "oil",
    usage: "Apply to the affected scalp area as directed by the doctor. Massage gently for 2–3 minutes. Do not rinse. Use once daily or as prescribed.",
    note: "Suitable for pattern hair loss, thinning, and post-hair-transplant care. Avoid in pregnancy or planning to conceive.",
    ingredients: "Emu Oil · Redensyl 3% · Dutasteride 0.5% · Clove Oil · Caffeine · Zinc Oxide · Copper Tripeptide · Magnesium Oxide · Melatonin",
    mechanism:
      "Dutasteride (0.5%) inhibits both Type I and Type II 5-alpha reductase — blocking DHT conversion more completely than Finasteride alone. Redensyl (3%) activates hair follicle stem cells and dermal papilla cell proliferation (anagen re-entry). Emu Oil improves dermal penetration of all co-delivered actives. Copper Tripeptide + Caffeine stimulate follicle microcirculation. Melatonin prolongs the anagen growth phase.",
  },
  {
    name: "F-Emugrow MCR",
    tags: ["hairfall", "thinning", "alopecia", "sensitive", "pattern", "young female"],
    scalpMatch: ["normal", "dry", "sensitive", "inflammation", "dandruff"],
    gender: ["female"],
    contraindications: ["pregnancy"],
    hormonalSafe: true,
    harsh: false,
    category: "oil",
    usage: "Apply to the affected scalp area as directed by the doctor. Massage gently for 2–3 minutes. Do not rinse. Use once daily or as prescribed.",
    note: "MCR variant of Emugrow for females under 30 — non-irritant peptide vehicle without Dutasteride. Avoid in pregnancy.",
  },
  {
    name: "Trichogain Serum",
    tags: ["hairfall", "thinning", "sensitive"],
    scalpMatch: ["normal", "dry", "sensitive"],
    gender: ["male", "female"],
    contraindications: [],
    hormonalSafe: true,
    harsh: false,
    category: null,
    usage: "Apply once daily or on alternate nights to thinning areas as tolerated.",
    note: "Non-minoxidil option for sensitive or dry scalp.",
  },
  {
    name: "CR Serum",
    tags: ["hairfall", "thinning", "sensitive"],
    scalpMatch: ["dry", "sensitive", "normal"],
    gender: ["male", "female"],
    contraindications: [],
    hormonalSafe: true,
    harsh: false,
    category: null,
    usage: "Apply on alternate nights unless the doctor changes frequency.",
    note: "Gentler topical support when harsh actives are not preferred.",
  },
  {
    name: "F-Trichosure Pro",
    tags: ["menopause"],
    scalpMatch: ["normal", "dry", "sensitive"],
    gender: ["female"],
    contraindications: [],
    hormonalSafe: true,
    harsh: false,
    category: null,
    usage: "Apply as prescribed for female hormonal thinning support.",
    note: "Useful in peri-menopause, menopause or post-menopause related thinning.",
  },
  {
    name: "Premature Greying Topical Support",
    tags: ["grey hair"],
    scalpMatch: ["normal", "dry", "sensitive"],
    gender: ["male", "female"],
    contraindications: [],
    hormonalSafe: true,
    harsh: false,
    category: null,
    usage: "Use as directed on scalp or hair roots; pair with the prescribed greying kit.",
    note: "Topical support for early greying concerns.",
  },
  {
    name: "F-Trichosilk D&F (Without Treatment)",
    tags: ["frizzy", "dry hair", "hair texture", "frizz", "dryness"],
    scalpMatch: ["dry", "normal"],
    gender: ["male", "female"],
    contraindications: [],
    hormonalSafe: true,
    harsh: false,
    category: "serum",
    usage: "Apply a small amount to damp or dry hair from mid-length to ends. Do not rinse. Use daily or as recommended by the doctor.",
    note: "Leave-in serum for dry and frizzy hair. Keeps frizz in check, prevents knots and tangles, hydrates the hair. Light, non-greasy. Recommended for everyday use.",
    ingredients: "Light leave-in serum complex; moisture-protective, anti-frizz, shine-enhancing. Non-greasy formula for dry / frizzy hair without heat or chemical-treatment history.",
    mechanism: "Hydrates and coats the hair shaft. Anti-frizz, moisture-protection and shine-enhancing. No active pharmaceutical ingredient.",
  },
  {
    name: "F-Trichosilk D&F (With Treatment)",
    tags: ["frizzy", "dry hair", "heat styling", "chemical treatment", "damaged hair", "hair texture"],
    scalpMatch: ["dry", "normal", "sensitive"],
    gender: ["male", "female"],
    contraindications: [],
    hormonalSafe: true,
    harsh: false,
    category: "serum",
    usage: "Apply a small amount to damp or dry hair from mid-length to ends. Do not rinse. Use daily as a heat protectant before styling or as a finishing serum.",
    note: "Leave-in serum for treated and damaged hair. Boosts moisture and repairs hair fibres. Prevents dryness and frizz. Heat protectant.",
    ingredients: "Leave-in serum with heat-protectant complex; moisture-boosting, fibre-repair, anti-frizz, shine and bounce enhancing. For chemically treated or heat-damaged hair.",
    mechanism: "Heat-protectant shield. Fibre repair, moisture retention, anti-frizz. No active pharmaceutical ingredient.",
  },
  {
    name: "F-Biwash+ Anti-Dandruff Shampoo",
    tags: ["dandruff", "itching", "fungal", "inflammation", "psoriasis", "seborrheic"],
    scalpMatch: ["dandruff", "itching", "oily", "fungal", "sensitive", "inflammation", "psoriasis"],
    gender: ["male", "female"],
    contraindications: [],
    hormonalSafe: true,
    harsh: false,
    category: "shampoo",
    usage: "Use 2–3 times per week on wash days. Apply to wet scalp, lather gently for 3–5 minutes, then rinse thoroughly. Doctor to confirm frequency based on severity.",
    note: "Medicated anti-dandruff shampoo — reduces visible flakes, relieves itching and improves scalp hygiene. Effective in dandruff and seborrheic dermatitis.",
    ingredients: "Medicated anti-dandruff complex; formulated to manage dandruff, scalp flaking, and itching. Gently cleanses while controlling dandruff-causing factors.",
    mechanism: "Antimicrobial and antifungal scalp cleansing. Controls Malassezia-driven dandruff and seborrheic dermatitis.",
  },
  {
    name: "Trichonourish EVA / FHA-Andro+",
    tags: ["facial hair", "hirsutism", "pcos", "androgenetic"],
    scalpMatch: [],
    gender: ["female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: false,
    category: null,
    usage: "Apply as directed by the doctor to affected facial areas.",
    note: "Anti-androgen topical formulation targeting androgen-sensitive facial follicles — reduces unwanted facial hair growth driven by PCOS androgen excess. Avoid in pregnancy or planning to conceive.",
  },
  // ── Standalone Minoxidil / Finasteride strengths used by the protocol table
  {
    name: "Minoxidil 2% Topical",
    tags: ["hairfall", "thinning", "alopecia"],
    scalpMatch: ["normal", "oily"],
    gender: ["male", "female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: true,
    category: null,
    usage: "Apply once daily to the affected scalp area as directed by the doctor.",
    note: "Lower-strength Minoxidil — preferred starting strength for females under 30 and for hormonal female patients over 30.",
  },
  {
    name: "Finasteride 0.25% Topical",
    tags: ["hairfall", "thinning", "alopecia", "androgenetic", "dht"],
    scalpMatch: ["normal", "oily", "dry", "sensitive"],
    gender: ["male", "female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: false,
    category: null,
    usage: "Apply at night to thinning zones under doctor supervision.",
    note: "Standard local DHT block. Pair with Minoxidil for combination therapy. Avoid in pregnancy or planning to conceive.",
  },
  {
    name: "Finasteride 2.5% Topical",
    tags: ["hairfall", "thinning", "alopecia", "androgenetic", "dht", "gym"],
    scalpMatch: ["normal", "oily"],
    gender: ["male"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: false,
    category: null,
    usage: "Apply at night to thinning zones for 3–4 months, then taper to 0.25% under doctor supervision.",
    note: "High-strength initial block for advanced grade or high-androgen lifestyle (gymmers). Taper to 0.25% once DHT pressure is controlled. Male protocol.",
  },
  {
    name: "Finasteride 0.1% Gel",
    tags: ["hairfall", "thinning", "alopecia"],
    scalpMatch: ["normal", "oily", "sensitive"],
    gender: ["female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: false,
    category: null,
    usage: "Apply at night to thinning zones under doctor supervision.",
    note: "Gentler topical DHT block for non-hormonal female pattern thinning. Doctor-choice alternative to 0.25%.",
  },
  // ── Oral options surfaced as cautions / doctor-decision adjuncts
  {
    name: "Oral Minoxidil 1.25mg",
    tags: ["hairfall", "thinning", "alopecia"],
    scalpMatch: [],
    gender: ["male", "female"],
    contraindications: ["pregnancy", "hypertension"],
    hormonalSafe: true,
    harsh: true,
    category: null,
    usage: "Start at 1.25mg once daily under doctor supervision.",
    note: "Use when topical Minoxidil is not tolerated or scalp is dry/dandruff/inflamed. Mandatory cardiac evaluation in patients over 60. Hypertension is a contraindication.",
  },
  {
    name: "Oral Minoxidil 2.5mg",
    tags: ["hairfall", "thinning", "alopecia"],
    scalpMatch: [],
    gender: ["male", "female"],
    contraindications: ["pregnancy", "hypertension"],
    hormonalSafe: true,
    harsh: true,
    category: null,
    usage: "Escalate to 2.5mg only if the patient plateaus at 1.25mg, under doctor supervision.",
    note: "Plateau escalation. Mandatory cardiac evaluation in patients over 60. Hypertension is a contraindication.",
  },
  {
    name: "Oral Minoxidil + Spironolactone",
    tags: ["pcos", "hormonal", "androgenetic", "thinning"],
    scalpMatch: [],
    gender: ["female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: true,
    category: null,
    usage: "Use only if prescribed for PCOS, hormonal, or menopausal female thinning.",
    note: "Combined systemic Minoxidil + anti-androgen (Spironolactone). Standard option for PCOS, peri-menopausal and post-menopausal hair loss. Avoid in pregnancy.",
  },
  {
    name: "Oral Minoxidil + Bicalutamide",
    tags: ["pcos", "hormonal", "androgenetic", "thinning"],
    scalpMatch: [],
    gender: ["female"],
    contraindications: ["pregnancy"],
    hormonalSafe: false,
    harsh: true,
    category: null,
    usage: "Use only if prescribed for PCOS or androgen-dominant female thinning.",
    note: "Doctor-choice alternative to Spironolactone for PCOS-driven thinning. Avoid in pregnancy.",
  },
];

/** Look up a product by exact name. Returns null if not in the database. */
export function getTopicalProduct(name: string): TopicalProduct | null {
  return TOPICAL_PRODUCTS.find((p) => p.name === name) ?? null;
}
