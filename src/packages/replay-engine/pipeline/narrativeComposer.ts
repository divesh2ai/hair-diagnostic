/**
 * Deterministic narrative composer.
 *
 * Produces patient / doctor / scientific framings + themes per
 * primary cause. Strings are templated from registry concepts; no AI.
 */

import {
  ClinicalReplayCase,
  DiagnosisResult,
  NarrativeResult,
  ProtocolResult,
} from "../types";

interface CauseNarrative {
  themes: string[];
  doctor: string;
  patient: string;
  scientific: string;
}

const NARRATIVES: Record<string, CauseNarrative> = {
  "androgen-driven-miniaturization": {
    themes: ["ANDROGENIC_PROGRESSION", "EXPECTATION_SETTING_SLOW"],
    doctor: "Androgen-mediated terminal-to-vellus conversion is the dominant explanation for the observed pattern thinning topology, with miniaturization pathway leading on signal weight aggregation.",
    patient: "Your hair is getting finer because of how your follicles respond to hormones over time — a hereditary pattern that progresses gradually if left alone. Treatment slows that pattern and supports density.",
    scientific: "DHT-driven dermal-papilla signaling shortens anagen and reduces follicle volume across successive cycles, producing the gradient thinning topology observed in this case.",
  },
  "stress-driven-telogen-effluvium": {
    themes: ["CYCLE_RESET", "REVERSIBILITY_REASSURANCE", "STRESS_RECOVERY"],
    doctor: "Diffuse synchronized telogen release triggered by an identifiable precipitant; architectural follicle integrity is preserved and the process is fully reversible once the precipitant resolves.",
    patient: "A stress event two to four months ago pushed many hairs into a resting phase, which now show up as visible shedding. This is fully reversible — most regrowth happens over the next telogen cycle.",
    scientific: "Stress-axis activation accelerates anagen-to-telogen transition; the diffuse shedding lags the precipitant by approximately one telogen cycle.",
  },
  "nutritional-hair-stress": {
    themes: ["NUTRITIONAL_RESTORATION", "REVERSIBILITY_REASSURANCE"],
    doctor: "Substrate insufficiency for follicular proliferation — iron, vitamin D, B-complex, or protein — is the dominant explanation; correction reverses the phenotype within a telogen cycle.",
    patient: "Your hair is reflecting a nutrient gap. Restoring substrate restores normal cycling and density typically follows within a few months.",
    scientific: "Reduced ferritin and 25-OH-vitamin-D constrain matrix proliferation; correction reverses the phenotype within a telogen cycle.",
  },
  "hormonal-hair-loss": {
    themes: ["ENDOCRINE_REBALANCE", "ANDROGENIC_PROGRESSION", "EXPECTATION_SETTING_SLOW"],
    doctor: "Identifiable endocrine perturbation (thyroid, PCOS, peri/menopause) is the named driver of the observed loss; correcting the upstream endocrine state typically improves the hair phenotype on standard cycles.",
    patient: "A hormonal shift is the leading explanation here. Addressing the underlying endocrine state, alongside targeted hair therapy, gives the best chance of improvement.",
    scientific: "Thyroid, androgen, and estrogen axes modulate follicle cycling; perturbation produces phenotype-specific loss patterns that respond when the axis is rebalanced.",
  },
  "metabolic-hair-dysfunction": {
    themes: ["MULTIFACTORIAL_COORDINATION", "ENDOCRINE_REBALANCE"],
    doctor: "Insulin–androgen axis cross-talk is the named driver of the follicular phenotype; therapy combines metabolic optimization with hair-directed support.",
    patient: "Metabolic factors — sugar regulation, weight, related hormonal patterns — are the primary explanation here.",
    scientific: "Hyperinsulinaemia raises bioavailable androgens via SHBG suppression, amplifying miniaturization risk.",
  },
  "autoimmune-hair-loss": {
    themes: ["AUTOIMMUNE_CONTROL", "EXPECTATION_SETTING_SLOW"],
    doctor: "Immune-mediated follicular targeting is the named driver, supported by patchy topology and alopecia areata history; treatment focuses on immune quiescence and relapse-remission expectation setting.",
    patient: "Your immune system is reacting against the follicles. Treatment focuses on calming that response — outcomes vary and we plan for relapse cycles.",
    scientific: "Loss of immune privilege at the follicle bulge with CD8+ T-cell infiltration produces the areata phenotype; scarring forms reflect irreversible perifollicular fibrosis.",
  },
  "gut-hair-axis-dysfunction": {
    themes: ["GUT_RECOVERY", "NUTRITIONAL_RESTORATION"],
    doctor: "Functional malabsorption and gut inflammation are the named upstream drivers of the substrate insufficiency manifesting in hair.",
    patient: "Your gut and hair are connected — chronic gut symptoms are reducing how much your follicles can build with. Addressing gut function is the lever.",
    scientific: "Chronic mucosal inflammation reduces iron and B-complex bioavailability while systemic cytokine load suppresses anagen.",
  },
  "inflammatory-scalp-dysfunction": {
    themes: ["INFLAMMATORY_QUIESCENCE", "REVERSIBILITY_REASSURANCE"],
    doctor: "Perifollicular and surface inflammation is the named driver; resolving the scalp-surface dermatosis restores cycling.",
    patient: "The scalp environment around the follicle is inflamed. Calming the scalp is the primary lever here, and improvement is generally fast once inflammation settles.",
    scientific: "Malassezia-driven seborrhoeic inflammation and cytokine load disrupt anagen maintenance and pigmentation.",
  },
  "hair-shaft-damage-syndrome": {
    themes: ["SHAFT_RECONSTRUCTION", "REVERSIBILITY_REASSURANCE"],
    doctor: "Cuticle/cortex compromise from extrinsic exposures is the named driver; follicular architecture is intact.",
    patient: "Your hair is breaking, not falling — the strands are damaged by heat, chemicals, or environment, not the roots. Treatment focuses on shaft reconstruction.",
    scientific: "Repeated thermal and oxidative insults degrade cuticular integrity, producing mid-shaft fracture under normal mechanical load.",
  },
  "multifactorial-hair-loss": {
    themes: ["MULTIFACTORIAL_COORDINATION", "EXPECTATION_SETTING_SLOW"],
    doctor: "No single driver dominates; the case requires a composite explanation across at least three pathways. Treatment must address the top co-leading causes in parallel.",
    patient: "Multiple causes are working together here. We need to address more than one driver to see meaningful improvement — single-lever fixes will under-deliver.",
    scientific: "Multiple converging mechanisms exceed activation threshold without a single dominant posterior; treatment combinatorics required.",
  },
};

export function composeNarrative(
  c: ClinicalReplayCase,
  diag: DiagnosisResult,
  protocol: ProtocolResult
): NarrativeResult {
  const base = NARRATIVES[diag.primary];
  if (!base) {
    return {
      themes: ["EXPECTATION_SETTING_SLOW"],
      patientFraming: "We will treat this conservatively while clarifying the dominant driver over the next cycle.",
      doctorFraming: "Cause posterior is below confidence floor; defer to conservative protocol pending repeat assessment.",
      scientificFraming: "Insufficient signal weight for a confident causal hypothesis at this evaluation.",
    };
  }
  const themes = new Set(base.themes);
  if (diag.coExplanations.length > 0) themes.add("MULTIFACTORIAL_COORDINATION");
  if (c.questionnaireAnswers.deficiency?.length) themes.add("NUTRITIONAL_RESTORATION");
  if (protocol.protocolClass === "TE_POST_ILLNESS") themes.add("STRESS_RECOVERY");

  return {
    themes: [...themes].sort(),
    patientFraming: base.patient,
    doctorFraming: base.doctor,
    scientificFraming: base.scientific,
  };
}
