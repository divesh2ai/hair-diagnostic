/**
 * Barrier registry — RootCause → patient-friendly "Hair Growth Barrier" copy.
 *
 * Drives §1 (Clinical Summary & Barriers) of the V3 narrative.
 *
 * Each entry is intentionally short:
 *  - name                    → 2–4 word patient-friendly noun phrase
 *  - clinicalInterpretation  → 1–2 sentences, dermatologist tone, second person
 *  - impactOnHair            → 2–4 short bullets, scannable
 *
 * If a barrier doesn't fire for the patient (no signal evidence in V4 root
 * cause analysis) it is not rendered.
 */

import type { RootCause } from "../../../types";

export interface BarrierDef {
  name: string;
  clinicalInterpretation: string;
  impactOnHair: string[];
}

export const BARRIER_BY_ROOT_CAUSE: Record<RootCause, BarrierDef> = {
  DHT: {
    name: "Follicular Miniaturisation",
    clinicalInterpretation:
      "Your assessment suggests increased follicular sensitivity to androgens, causing roots to gradually produce thinner and weaker hair strands.",
    impactOnHair: [
      "Progressive thinning at the crown and parting",
      "Reduced density over time",
      "Shorter growth cycles",
      "Slower regrowth response",
    ],
  },
  GENETICS: {
    name: "Inherited Follicle Sensitivity",
    clinicalInterpretation:
      "A genetic predisposition sets how your follicles respond to hormonal and metabolic stressors — and shapes the upper limit of recovery without consistent support.",
    impactOnHair: [
      "Earlier onset of thinning",
      "Higher follicle vulnerability",
      "Slower spontaneous recovery",
    ],
  },
  PCOS: {
    name: "PCOS-Driven Hormonal Imbalance",
    clinicalInterpretation:
      "Insulin–androgen cross-talk in PCOS amplifies the hormonal pressure on your follicles and contributes to ongoing shedding.",
    impactOnHair: [
      "Diffuse thinning at the parting",
      "Oily scalp and increased shedding",
      "Slower recovery between cycles",
    ],
  },
  HYPOTHYROID: {
    name: "Hypothyroid Slowdown",
    clinicalInterpretation:
      "Lower thyroid hormone activity slows the metabolic engine that drives hair-cycle progression, so follicles linger in resting phase.",
    impactOnHair: [
      "Dry, brittle strands",
      "Diffuse thinning across the scalp",
      "Slower regrowth",
    ],
  },
  HYPERTHYROID: {
    name: "Hyperthyroid Acceleration",
    clinicalInterpretation:
      "Elevated thyroid activity pushes follicles into the resting phase prematurely, producing diffuse shedding.",
    impactOnHair: [
      "Sudden, diffuse hair fall",
      "Finer-feeling strands",
      "Unstable growth cycles",
    ],
  },
  AUTOIMMUNE: {
    name: "Autoimmune Follicle Targeting",
    clinicalInterpretation:
      "Your immune system is mistakenly targeting healthy follicles, disrupting normal growth around the affected zones.",
    impactOnHair: [
      "Patchy or sudden loss",
      "Spreading bald spots",
      "Slow regrowth from affected areas",
    ],
  },
  POST_PARTUM: {
    name: "Post-Partum Hormonal Shift",
    clinicalInterpretation:
      "After delivery, a synchronised swing of follicles into the resting phase causes a temporary spike in shedding.",
    impactOnHair: [
      "Heavy, diffuse shedding",
      "Reduced overall density",
      "Improves with nutritional restoration",
    ],
  },
  HORMONAL_SHIFT: {
    name: "Hormonal Transition",
    clinicalInterpretation:
      "An ongoing endocrine transition (peri-menopause, menopause, or post-menopause) is unmasking follicle vulnerability and accelerating thinning.",
    impactOnHair: [
      "Widening parting",
      "Dryer, more fragile strands",
      "Slower regrowth response",
    ],
  },
  TRICHOTILLOMANIA: {
    name: "Compulsive Pulling",
    clinicalInterpretation:
      "Repeated mechanical pulling damages follicles directly and disrupts the surrounding growth environment.",
    impactOnHair: [
      "Patchy, irregular loss",
      "Broken strands of uneven length",
      "Localised follicle damage",
    ],
  },

  IRON_DEFICIENCY: {
    name: "Iron Deficiency",
    clinicalInterpretation:
      "Low iron limits the substrate your roots need for protein synthesis and oxygen delivery — without correction, no other therapy reaches full effect.",
    impactOnHair: [
      "Increased shedding",
      "Weaker, finer strands",
      "Slower regrowth",
      "Fatigue and brittle nails",
    ],
  },
  POOR_NUTRITION: {
    name: "Nutritional Deficiency Pattern",
    clinicalInterpretation:
      "Gaps in protein, vitamins, and minerals starve the follicle of the building blocks required for healthy growth.",
    impactOnHair: [
      "Diffuse shedding",
      "Loss of shine and strength",
      "Slow regrowth",
    ],
  },
  GUT_MALABSORPTION: {
    name: "Gut Absorption Issues",
    clinicalInterpretation:
      "Gut dysfunction limits how much of your nutrition actually reaches the follicle, capping recovery before therapy can take hold.",
    impactOnHair: [
      "Persistent low-grade shedding",
      "Slower response to supplementation",
      "Dull, weakened strands",
    ],
  },
  METABOLIC: {
    name: "Metabolic Imbalance",
    clinicalInterpretation:
      "Disrupted insulin and energy signalling reduces follicular energy supply, slowing growth and amplifying hormonal pressure.",
    impactOnHair: [
      "Diffuse thinning",
      "Oily scalp",
      "Reduced recovery between cycles",
    ],
  },
  ILLNESS: {
    name: "Post-Illness Recovery Phase",
    clinicalInterpretation:
      "A recent illness or surgery diverted nutrients toward repair and triggered a synchronised wave of shedding.",
    impactOnHair: [
      "Sudden diffuse hair fall",
      "Reduced strand quality",
      "Recovers with restoration",
    ],
  },
  MEDICATION: {
    name: "Medication-Related Shedding",
    clinicalInterpretation:
      "Certain medications interfere with the hair cycle and can produce diffuse shedding while in use.",
    impactOnHair: [
      "Diffuse hair fall",
      "Weaker strands",
      "Improves with timing and substrate support",
    ],
  },
  RAPID_WEIGHT_LOSS: {
    name: "Rapid Weight-Loss Shedding",
    clinicalInterpretation:
      "An acute drop in caloric and nutritional intake triggered diffuse shedding several weeks after the change.",
    impactOnHair: [
      "Heavy, diffuse hair fall",
      "Recovers with nutritional restoration",
      "Slower regrowth in the interim",
    ],
  },

  STRESS: {
    name: "Stress-Related Shedding",
    clinicalInterpretation:
      "Sustained stress raises cortisol and shifts follicles out of the growth phase early, increasing daily hair fall.",
    impactOnHair: [
      "Increased daily shedding",
      "Reduced scalp coverage",
      "Slower regrowth",
    ],
  },
  OXIDATIVE_STRESS: {
    name: "Oxidative Stress Load",
    clinicalInterpretation:
      "Smoking, alcohol, pollution and poor sleep generate free-radical damage that wears down follicle stem cells.",
    impactOnHair: [
      "Brittle, dry strands",
      "Premature greying",
      "Slower recovery response",
    ],
  },
  CIRCADIAN_DISRUPTION: {
    name: "Circadian Disruption",
    clinicalInterpretation:
      "Irregular sleep and shift work desynchronise cortisol and melatonin rhythms — and your hair cycle runs on the same clock.",
    impactOnHair: [
      "Persistent shedding",
      "Slower hair-cycle progression",
      "Reduced regrowth quality",
    ],
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Scalp inflammation barrier — derived from V4 scalp signals, not RootCause.
// ────────────────────────────────────────────────────────────────────────────

export const SCALP_INFLAMMATION_BARRIER: BarrierDef = {
  name: "Chronic Scalp Inflammation",
  clinicalInterpretation:
    "Ongoing scalp irritation — dandruff, redness, oily or itchy patches — keeps follicles in an inflammatory environment that weakens new growth.",
  impactOnHair: [
    "Weaker, finer regrowth",
    "Increased shedding around inflamed zones",
    "Persistent scalp discomfort",
    "Higher breakage at the root",
  ],
};

export const SHAFT_BREAKAGE_BARRIER: BarrierDef = {
  name: "Hair Shaft Damage",
  clinicalInterpretation:
    "The mid-shaft of the hair has lost structural integrity — usually from heat, chemical, or mechanical stress — so strands snap before they reach full length.",
  impactOnHair: [
    "Visible breakage and short strands",
    "Frizz and reduced elasticity",
    "Loss of shine",
  ],
};
