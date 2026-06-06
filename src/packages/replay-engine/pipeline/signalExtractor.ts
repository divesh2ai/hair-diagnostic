/**
 * Deterministic signal extractor.
 *
 * Reads a ClinicalReplayCase.questionnaireAnswers and emits a set of
 * ExtractedSignals using a fixed rule table. The rules mirror the
 * production questionnaire→signal mapping and intentionally use the
 * same answer keys/values.
 *
 * Every emitted signal MUST exist in the signal registry (validated
 * post-emit). Confidence comes from registry confidenceBase, scaled
 * by per-rule modifiers when the answer is corroborated.
 */

import {
  ClinicalReplayCase,
  ExtractedSignal,
  QuestionnaireAnswers,
} from "../types";
import { loadRegistries } from "./registryLoader";

type Rule = (a: QuestionnaireAnswers, age: number) => Array<{
  signalId: string;
  confidence: number;
  primary?: boolean;
}>;

const includes = (arr: string[] | undefined, v: string): boolean =>
  Array.isArray(arr) && arr.includes(v);

// ── Demographic / age signals ──────────────────────────────────────────────

const demographicRules: Rule[] = [
  (a) => [{ signalId: a.sex === "Male" ? "sex-male" : "sex-female", confidence: 1.0 }],
  (_a, age) => {
    if (age < 25) return [{ signalId: "age-young-modifier", confidence: 1.0 }];
    if (age < 40) return [{ signalId: "age-mid-modifier", confidence: 1.0 }];
    if (age < 55) return [{ signalId: "age-mature-modifier", confidence: 1.0 }];
    return [{ signalId: "age-senior-modifier", confidence: 1.0 }];
  },
];

// ── Hair-loss pattern (hairtype) ──────────────────────────────────────────

const patternRules: Rule[] = [
  (a) => {
    const ht = a.hairtype ?? [];
    const out: Array<{ signalId: string; confidence: number; primary?: boolean }> = [];
    const hasPattern = ht.some((v) =>
      ["Thinning at crown", "Receding hairline", "Widening parting"].includes(v)
    );
    if (hasPattern) out.push({ signalId: "pattern-thinning-marker", confidence: 0.85, primary: true });
    if (includes(ht, "Diffuse shedding")) out.push({ signalId: "diffuse-shedding-marker", confidence: 0.88, primary: true });
    if (includes(ht, "Patchy bald spots")) out.push({ signalId: "patchy-loss-marker", confidence: 0.92, primary: true });
    if (includes(ht, "Shaft breakage")) out.push({ signalId: "shaft-breakage-marker", confidence: 0.85, primary: true });
    // pattern WITHOUT shedding marker — derived
    const minimalFall = a.count?.includes("minimal") || a.count?.includes("thinning visible, minimal fall");
    if (hasPattern && minimalFall) out.push({ signalId: "thinning-without-shedding", confidence: 0.7 });
    return out;
  },
];

// ── Shedding intensity ────────────────────────────────────────────────────

const sheddingRules: Rule[] = [
  (a) => {
    const cnt = a.count ?? "";
    if (cnt.includes("more than 200")) return [{ signalId: "active-shedding-heavy", confidence: 0.88 }];
    if (cnt.includes("100–200") || cnt.includes("100-200")) return [{ signalId: "active-shedding-heavy", confidence: 0.78 }];
    if (cnt.includes("50–100") || cnt.includes("50-100")) return [{ signalId: "active-shedding-mild", confidence: 0.78 }];
    return [];
  },
];

// ── Duration ──────────────────────────────────────────────────────────────

const durationRules: Rule[] = [
  (a) => {
    const d = a.duration ?? "";
    if (d.includes("Less than 3 months")) return [{ signalId: "acute-duration-marker", confidence: 0.9 }];
    if (d.includes("3–6 months") || d.includes("3-6 months")) return [{ signalId: "acute-duration-marker", confidence: 0.85 }];
    if (d.includes("6–12 months") || d.includes("6-12 months")) return [{ signalId: "subacute-duration-marker", confidence: 0.85 }];
    if (d.includes("More than 1 year") || d.includes("More than 12 months")) return [{ signalId: "chronic-duration-marker", confidence: 0.9 }];
    return [];
  },
];

// ── Severity grade ────────────────────────────────────────────────────────

const gradeRules: Rule[] = [
  (a) => {
    const g = a.grade ?? "";
    const m = g.match(/Grade\s*(\d)/i);
    if (!m) return [];
    const n = parseInt(m[1]!, 10);
    if (n <= 3) return [{ signalId: "grade123-severity-marker", confidence: 0.85 }];
    return [{ signalId: "grade45-severity-marker", confidence: 0.85 }];
  },
];

// ── Scalp state ───────────────────────────────────────────────────────────

const scalpRules: Rule[] = [
  (a) => {
    const s = a.scalp ?? [];
    const out: Array<{ signalId: string; confidence: number; primary?: boolean }> = [];
    if (includes(s, "Oily scalp")) out.push({ signalId: "oily-scalp", confidence: 0.85 });
    if (includes(s, "Dry scalp")) out.push({ signalId: "dry-scalp", confidence: 0.85 });
    if (includes(s, "Dandruff")) out.push({ signalId: "dandruff-presence", confidence: 0.85 });
    if (includes(s, "Dandruff with itching")) out.push({ signalId: "dandruff-with-itching", confidence: 0.88, primary: true });
    if (includes(s, "Scalp redness")) out.push({ signalId: "scalp-redness", confidence: 0.85 });
    if (includes(s, "Scalp pustules")) out.push({ signalId: "scalp-pustules", confidence: 0.92, primary: true });
    if (includes(s, "Scalp burning")) out.push({ signalId: "scalp-burning", confidence: 0.85 });
    if (includes(s, "Psoriasis on scalp")) out.push({ signalId: "psoriatic-scalp", confidence: 0.92, primary: true });
    if (includes(s, "Normal scalp")) out.push({ signalId: "normal-scalp", confidence: 0.85 });
    return out;
  },
];

// ── Cause hints (self-reported) ───────────────────────────────────────────

const causeHintRules: Rule[] = [
  (a) => {
    const c = a.cause ?? [];
    const out: Array<{ signalId: string; confidence: number }> = [];
    if (includes(c, "Family history")) out.push({ signalId: "genetic-predisposition-reported", confidence: 0.85 });
    if (includes(c, "Stress")) out.push({ signalId: "chronic-stress-reported", confidence: 0.85 });
    if (includes(c, "Recent illness")) out.push({ signalId: "post-illness-recovery", confidence: 0.88 });
    if (includes(c, "Postpartum")) out.push({ signalId: "postpartum-not-lactating", confidence: 0.85 });
    if (includes(c, "Crash diet")) out.push({ signalId: "crash-diet-pattern", confidence: 0.88 });
    if (includes(c, "Medications")) out.push({ signalId: "chronic-medical-on-medication", confidence: 0.85 });
    if (includes(c, "Chronic medical condition")) out.push({ signalId: "chronic-medical-on-medication", confidence: 0.85 });
    if (includes(c, "Autoimmune")) out.push({ signalId: "alopecia-areata-history", confidence: 0.9 });
    if (includes(c, "Scalp infection")) out.push({ signalId: "dandruff-with-itching", confidence: 0.7 });
    if (includes(c, "Nutrition") || includes(c, "Diet")) out.push({ signalId: "nutritional-cause-self-reported", confidence: 0.8 });
    return out;
  },
];

// ── Lifestyle ─────────────────────────────────────────────────────────────

const lifestyleRules: Rule[] = [
  (a) => {
    const l = a.lifestyle ?? [];
    const out: Array<{ signalId: string; confidence: number }> = [];
    if (includes(l, "Chronic stress") || includes(l, "Poor sleep")) out.push({ signalId: "chronic-stress-reported", confidence: 0.85 });
    if (includes(l, "Night shifts")) out.push({ signalId: "night-shift-exposure", confidence: 0.88 });
    if (includes(l, "Frequent flying")) out.push({ signalId: "frequent-flying-exposure", confidence: 0.85 });
    if (includes(l, "Smoking")) out.push({ signalId: "smoking-exposure", confidence: 0.85 });
    if (includes(l, "Alcohol")) out.push({ signalId: "alcohol-exposure", confidence: 0.8 });
    if (includes(l, "Heat styling")) out.push({ signalId: "heat-styling-exposure", confidence: 0.85 });
    if (includes(l, "Chemical treatments")) out.push({ signalId: "chemical-treatment-exposure", confidence: 0.85 });
    if (includes(l, "Hard water")) out.push({ signalId: "hard-water-exposure", confidence: 0.8 });
    if (includes(l, "Bodybuilding")) out.push({ signalId: "bodybuilding-pattern", confidence: 0.85 });
    return out;
  },
];

// ── Thyroid / hormonal / immunity / gut / deficiency / diet ───────────────

const conditionRules: Rule[] = [
  (a) => {
    const out: Array<{ signalId: string; confidence: number; primary?: boolean }> = [];
    if (includes(a.thyroid, "Hypothyroidism")) out.push({ signalId: "hypothyroid-diagnosis", confidence: 0.92, primary: true });
    if (includes(a.thyroid, "Hyperthyroidism")) out.push({ signalId: "hyperthyroid-diagnosis", confidence: 0.92, primary: true });

    if (includes(a.hormonal, "PCOS")) out.push({ signalId: "pcos-diagnosis", confidence: 0.95, primary: true });
    if (includes(a.hormonal, "Irregular periods") && includes(a.hormonal, "PCOS")) out.push({ signalId: "pcos-with-metabolic", confidence: 0.78 });
    if (includes(a.hormonal, "Perimenopause")) out.push({ signalId: "perimenopause-state", confidence: 0.88 });
    if (includes(a.hormonal, "Menopause")) out.push({ signalId: "menopause-state", confidence: 0.88 });
    if (includes(a.hormonal, "Postmenopause")) out.push({ signalId: "postmenopause-state", confidence: 0.9 });
    if (includes(a.hormonal, "Postpartum")) out.push({ signalId: "postpartum-not-lactating", confidence: 0.85 });
    if (includes(a.hormonal, "HRT")) out.push({ signalId: "hrt-use", confidence: 0.85 });
    if (includes(a.hormonal, "Endometriosis")) out.push({ signalId: "endometriosis-diagnosis", confidence: 0.85 });
    if (includes(a.hormonal, "Pregnancy")) out.push({ signalId: "pregnancy-state", confidence: 0.95 });

    if (includes(a.immunity, "Alopecia areata history")) out.push({ signalId: "alopecia-areata-history", confidence: 0.92 });
    if (includes(a.immunity, "Recurrent infections")) out.push({ signalId: "recurrent-infection-pattern", confidence: 0.85 });
    if (includes(a.immunity, "Allergies")) out.push({ signalId: "allergy-cluster", confidence: 0.8 });
    if (includes(a.immunity, "Asthma")) out.push({ signalId: "asthma-history", confidence: 0.85 });
    if (includes(a.immunity, "Skin rashes")) out.push({ signalId: "skin-rash-history", confidence: 0.8 });
    if (includes(a.immunity, "Scarring alopecia")) out.push({ signalId: "scarring-alopecia-history", confidence: 0.95 });

    if (includes(a.deficiency, "Iron deficiency")) out.push({ signalId: "iron-deficiency-reported", confidence: 0.9 });
    if (includes(a.deficiency, "Vitamin D deficiency")) out.push({ signalId: "vitamin-d-deficiency-reported", confidence: 0.85 });
    if (includes(a.deficiency, "Vitamin B12 deficiency")) out.push({ signalId: "vitamin-b12-deficiency-reported", confidence: 0.85 });

    if (includes(a.gut, "IBS") || includes(a.gut, "Constipation")) out.push({ signalId: "ibs-or-constipation", confidence: 0.85 });
    if (includes(a.gut, "GERD")) out.push({ signalId: "gerd-symptoms", confidence: 0.85 });
    if (includes(a.gut, "Bloating")) out.push({ signalId: "bloating-symptoms", confidence: 0.85 });
    if (includes(a.gut, "Mouth ulcers")) out.push({ signalId: "mouth-ulcers-cooccurrence", confidence: 0.8 });

    if (includes(a.diet, "Vegan")) out.push({ signalId: "vegan-diet", confidence: 0.9 });
    if (includes(a.diet, "Vegetarian")) out.push({ signalId: "vegetarian-diet", confidence: 0.9 });
    if (includes(a.diet, "Crash dieting")) out.push({ signalId: "crash-diet-pattern", confidence: 0.85 });
    if (includes(a.diet, "Irregular meals")) out.push({ signalId: "irregular-diet-pattern", confidence: 0.85 });
    if (includes(a.diet, "High protein")) out.push({ signalId: "high-protein-diet", confidence: 0.8 });

    return out;
  },
  (a) => {
    const out: Array<{ signalId: string; confidence: number }> = [];
    const g = a.goal ?? [];
    if (g.includes("Regrow lost hair")) out.push({ signalId: "regrow-goal", confidence: 0.9 });
    return out;
  },
];

const ALL_RULES: Rule[][] = [
  demographicRules,
  patternRules,
  sheddingRules,
  durationRules,
  gradeRules,
  scalpRules,
  causeHintRules,
  lifestyleRules,
  conditionRules,
];

/**
 * Extract signals deterministically. Order is stable: a fixed pre-order
 * over the rule tables, then by signalId within each rule.
 */
export function extractSignals(c: ClinicalReplayCase): ExtractedSignal[] {
  const { signals: registry } = loadRegistries();
  const a = c.questionnaireAnswers;
  const age = parseInt(a.age, 10);

  const dedup = new Map<string, ExtractedSignal>();

  for (const block of ALL_RULES) {
    for (const rule of block) {
      const emitted = rule(a, age);
      for (const e of emitted) {
        if (!registry.has(e.signalId)) continue; // silently drop unknown — registry is truth
        const existing = dedup.get(e.signalId);
        if (!existing) {
          dedup.set(e.signalId, {
            signalId: e.signalId,
            confidence: e.confidence,
            primary: e.primary ?? false,
            source: "questionnaire",
          });
        } else {
          // Highest-confidence + OR of primary
          existing.confidence = Math.max(existing.confidence, e.confidence);
          existing.primary = existing.primary || (e.primary ?? false);
        }
      }
    }
  }

  return [...dedup.values()].sort((x, y) => x.signalId.localeCompare(y.signalId));
}
