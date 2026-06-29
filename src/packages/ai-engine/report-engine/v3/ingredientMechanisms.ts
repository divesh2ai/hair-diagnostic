/**
 * Ingredient → patient-facing one-line mechanism.
 *
 * Drives §4 (How These Ingredients Help) of the V3 narrative.
 *
 * Hard rules from the spec:
 *  - Each entry is exactly ONE sentence.
 *  - No biochemical pathway names. No academic register.
 *  - Connect the ingredient to what the patient cares about (shedding,
 *    growth, scalp, energy).
 *
 * Lookup is normalised: the kit knowledge base sometimes writes ingredients
 * with parentheticals or alternate names ("Vitamin D3", "Vitamin D",
 * "Essential amino acids (Leucine, Isoleucine, Lysine)"). We strip the
 * parenthetical and match on the leading head, case-insensitive.
 */

interface MechanismEntry {
  /** Regex tested against the normalised ingredient string. */
  match: RegExp;
  /** Display label preferred for the patient report. */
  display: string;
  /** Single-sentence mechanism. */
  mechanism: string;
}

const ENTRIES: MechanismEntry[] = [
  // ── Anti-inflammatory / antioxidant ────────────────────────────────────
  { match: /^curcumin/i, display: "Curcumin", mechanism: "Helps cool the inflammatory signalling that interferes with healthy follicular activity." },
  { match: /^resveratrol/i, display: "Resveratrol", mechanism: "Protects follicle cells from oxidative wear and supports a calmer scalp environment." },
  { match: /^quercetin/i, display: "Quercetin", mechanism: "Supports growth signalling at the hair matrix and reduces low-grade inflammation around the follicle." },
  { match: /^green tea/i, display: "Green Tea Extract", mechanism: "Provides antioxidants that protect follicles from daily oxidative stress." },
  { match: /^pine bark/i, display: "Pine Bark Extract", mechanism: "Improves microcirculation in the scalp so follicles receive a steadier nutrient supply." },
  { match: /^moringa leaf/i, display: "Moringa Leaf Extract", mechanism: "Helps regulate cortisol and protects follicle integrity through phytosterol activity." },
  { match: /^moringa/i, display: "Moringa", mechanism: "A broad-spectrum antioxidant blend that supports overall follicle resilience." },
  { match: /^kelp/i, display: "Kelp Seaweed Extract", mechanism: "Supports balanced immune activity and supplies trace minerals the follicle needs." },
  { match: /^mushroom/i, display: "Mushroom Extracts", mechanism: "Support balanced immune signalling and help calm chronic inflammation." },
  { match: /^coq10|^co\s*q\s*10/i, display: "CoQ10", mechanism: "Boosts cellular energy in the follicle so growth can proceed efficiently." },
  { match: /^n[-\s]?a[-\s]?c|^nac\b/i, display: "NAC", mechanism: "Replenishes the body's natural antioxidant defences and supports follicular recovery." },
  { match: /^nmn/i, display: "NMN", mechanism: "Supports the cellular energy machinery that drives healthy hair-cycle progression." },

  // ── Hormonal / DHT modulators ─────────────────────────────────────────
  { match: /^beta[-\s]?sitosterol/i, display: "Beta-sitosterol", mechanism: "Helps reduce androgen pressure on susceptible follicles, slowing miniaturisation." },
  { match: /^msm/i, display: "MSM", mechanism: "Supports hair shaft strength and helps modulate androgen activity at the follicle." },
  { match: /^stinging nettle|^nettle/i, display: "Stinging Nettle", mechanism: "Helps temper androgen-driven follicle stress." },
  { match: /^ginseng/i, display: "Ginseng", mechanism: "Supports scalp circulation and a healthier follicle environment." },
  { match: /^milk thistle/i, display: "Milk Thistle", mechanism: "Provides gentle hormonal balancing during transitions like peri-menopause." },
  { match: /^mulberry/i, display: "Mulberry Extract", mechanism: "Helps cool stress-related inflammation that pushes follicles out of growth phase." },

  // ── Nutritional substrate ─────────────────────────────────────────────
  { match: /^essential amino acids|^amino acids|^leucine/i, display: "Essential Amino Acids", mechanism: "Supply the building blocks for keratin so strands grow stronger and thicker." },
  { match: /^l[-\s]?theanine/i, display: "L-Theanine", mechanism: "Helps lower anxiety-driven cortisol without sedation, easing stress-related shedding." },
  { match: /^l[-\s]?tyrosine/i, display: "L-Tyrosine", mechanism: "Supports thyroid and neurotransmitter balance — both of which influence hair-cycle quality." },
  { match: /^lactoferrin/i, display: "Lactoferrin", mechanism: "Improves iron absorption so follicles can use the iron they receive." },
  { match: /^colostrum/i, display: "Colostrum", mechanism: "Delivers growth factors and immune support that aid follicle repair and recovery." },
  { match: /^iron\b/i, display: "Iron", mechanism: "Restores the substrate follicles need for protein synthesis and oxygen delivery." },
  { match: /^vitamin d3?\b|^vitamin d/i, display: "Vitamin D3", mechanism: "Supports follicle differentiation and helps the immune system stay balanced around the root." },
  { match: /^vitamin c/i, display: "Vitamin C", mechanism: "Boosts iron absorption and supports collagen for stronger hair structure." },
  { match: /^vitamin e/i, display: "Vitamin E", mechanism: "Protects follicle cells from free-radical damage and helps preserve scalp health." },
  { match: /^vitamin b6|^b6\b/i, display: "Vitamin B6", mechanism: "Supports the enzymes that convert nutrients into the materials hair needs to grow." },
  { match: /^vitamin b12|^b12\b/i, display: "Vitamin B12", mechanism: "Supports cellular metabolism so follicles can use the nutrients reaching them." },
  { match: /^folic acid|^folate/i, display: "Folic Acid", mechanism: "Supports the cell division that keeps the hair matrix renewing healthy strands." },
  { match: /^zinc/i, display: "Zinc", mechanism: "Supports follicle repair and helps modulate the oil glands that affect scalp health." },
  { match: /^selenium/i, display: "Selenium", mechanism: "Helps the body manage oxidative stress that would otherwise wear follicles down." },
  { match: /^magnesium/i, display: "Magnesium", mechanism: "Eases stress, supports sleep, and helps the body manage cortisol-driven shedding." },
  { match: /^omega[\s-]?3|^omega3/i, display: "Omega-3", mechanism: "Reduces low-grade inflammation around the follicle and improves strand quality." },
  { match: /^brewer'?s yeast/i, display: "Brewer's Yeast", mechanism: "Supplies B-vitamins and trace minerals that strengthen the hair shaft." },
  { match: /^nem\b/i, display: "NEM", mechanism: "Supports the connective tissue around the follicle for stronger, more resilient strands." },
  { match: /^horsetail/i, display: "Horsetail Extract", mechanism: "Provides silica that strengthens the structure of growing strands." },

  // ── Stress / sleep / adaptogens ───────────────────────────────────────
  { match: /^ashwagandha/i, display: "Ashwagandha", mechanism: "Helps regulate the cortisol response that contributes to stress-related hair fall." },
  { match: /^melatonin/i, display: "Melatonin", mechanism: "Supports sleep quality and helps protect follicles during their overnight repair cycle." },
  { match: /^chamomile/i, display: "Chamomile", mechanism: "Calms anxiety signalling that can otherwise drive shedding." },
  { match: /^valerian/i, display: "Valerian Root", mechanism: "Supports deeper sleep so the body can spend more time repairing follicles." },

  // ── Gut / absorption ──────────────────────────────────────────────────
  { match: /^probiotics?|^lactobacillus/i, display: "Probiotics", mechanism: "Restore microbiome balance so the gut absorbs nutrients efficiently." },
  { match: /^bioperine|^black pepper/i, display: "Bioperine", mechanism: "Improves absorption of the active ingredients so the formula works harder." },
  { match: /^digestive enzymes/i, display: "Digestive Enzymes", mechanism: "Help break down food so nutrients actually reach the follicle." },
  { match: /^amla/i, display: "Amla", mechanism: "Supplies vitamin C and antioxidants that support iron uptake and scalp health." },
];

/** Normalise an ingredient string for matching (strip parentheticals etc.). */
function normalise(raw: string): string {
  return raw.split("(")[0].trim();
}

export interface IngredientMechanism {
  display: string;
  mechanism: string;
}

/** Resolve a single ingredient string to a one-line mechanism. */
export function mechanismFor(rawIngredient: string): IngredientMechanism {
  const head = normalise(rawIngredient);
  const match = ENTRIES.find((e) => e.match.test(head));
  if (match) return { display: match.display, mechanism: match.mechanism };
  // Fallback — keep the ingredient visible but mark mechanism generically.
  return {
    display: head,
    mechanism: "Supports follicle health and complements the rest of the formulation.",
  };
}
