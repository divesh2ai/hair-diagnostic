/**
 * Deterministic protocol builder.
 *
 * Maps primary cause + supporting signals → protocolClass, kits, fired
 * rules, and therapy needs. The mapping is intentionally explicit and
 * registry-grounded (kits are substrings to match the corpus's
 * mustIncludeKits / mustExcludeKits substring contract).
 */

import {
  ActivatedPathway,
  ClinicalReplayCase,
  DiagnosisResult,
  ProtocolResult,
} from "../types";

const CAUSE_TO_CLASS: Record<string, string> = {
  "androgen-driven-miniaturization": "MPHL", // refined below for female
  "stress-driven-telogen-effluvium": "TE_ACUTE",
  "nutritional-hair-stress": "NUTRITIONAL",
  "hormonal-hair-loss": "HORMONAL",
  "metabolic-hair-dysfunction": "HORMONAL",
  "autoimmune-hair-loss": "AUTOIMMUNE_AA",
  "gut-hair-axis-dysfunction": "GUT_AXIS",
  "inflammatory-scalp-dysfunction": "INFLAMMATORY",
  "hair-shaft-damage-syndrome": "SHAFT_REPAIR",
  "multifactorial-hair-loss": "MULTIFACTORIAL",
};

export function buildProtocol(
  c: ClinicalReplayCase,
  diag: DiagnosisResult,
  pathways: ActivatedPathway[]
): ProtocolResult {
  let protocolClass = CAUSE_TO_CLASS[diag.primary] ?? "MULTIFACTORIAL";

  // Refinement
  if (diag.primary === "androgen-driven-miniaturization" && c.demographicProfile.sex === "Female") {
    protocolClass = "FPHL";
  }
  if (diag.primary === "hormonal-hair-loss" && diag.legacyDiagnosisKey.startsWith("PCOS")) {
    protocolClass = "PCOS";
  }
  if (diag.primary === "stress-driven-telogen-effluvium") {
    if (diag.legacyDiagnosisKey === "POST_ILLNESS_TE") protocolClass = "TE_POST_ILLNESS";
    else if (diag.legacyDiagnosisKey === "CHRONIC_TE") protocolClass = "TE_CHRONIC";
    else protocolClass = "TE_ACUTE";
  }

  const kits: string[] = [];
  const fired: string[] = [];
  const therapyNeeds = new Set<string>();

  const sigSet = new Set(c.questionnaireAnswers.scalp ?? []);
  const inflam = pathways.find((p) => p.pathwayId === "scalp-inflammation");
  const inflamActive = (inflam?.activation ?? 0) >= 0.4;

  switch (protocolClass) {
    case "MPHL":
      kits.push("MPHL");
      if (sigSet.has("Oily scalp") || inflamActive) kits.push("PHENOTYPE INFLAMATION");
      kits.push("PRO IMMUNE GOLD");
      therapyNeeds.add("DHT_SUPPRESSION");
      therapyNeeds.add("INFLAMMATION_CONTROL");
      fired.push("NO_VISIBLE_FALL");
      if (diag.severity === "severe") fired.push("GRADE45_LOCK");
      break;
    case "FPHL":
      kits.push("MPHL PLUS", "FPHL");
      therapyNeeds.add("DHT_SUPPRESSION");
      therapyNeeds.add("ENDOCRINE_OPTIMIZATION");
      therapyNeeds.add("INFLAMMATION_CONTROL");
      fired.push("NO_VISIBLE_FALL");
      break;
    case "PCOS":
      kits.push("PCOS GOLD", "MPHL PLUS");
      therapyNeeds.add("ENDOCRINE_OPTIMIZATION");
      therapyNeeds.add("DHT_SUPPRESSION");
      therapyNeeds.add("INFLAMMATION_CONTROL");
      if (diag.legacyDiagnosisKey === "PCOS_METABOLIC") therapyNeeds.add("METABOLIC_OPTIMIZATION");
      break;
    case "HORMONAL":
      kits.push("HORMONAL GOLD");
      therapyNeeds.add("ENDOCRINE_OPTIMIZATION");
      therapyNeeds.add("CYCLE_RESTORATION");
      break;
    case "TE_ACUTE":
    case "TE_CHRONIC":
    case "TE_POST_ILLNESS":
      kits.push("HAIR FACT TE GOLD");
      therapyNeeds.add("CYCLE_RESTORATION");
      therapyNeeds.add("STRESS_DOWNREGULATION");
      therapyNeeds.add("NUTRITIONAL_REPLETION");
      break;
    case "AUTOIMMUNE_AA":
      kits.push("AA KIT");
      therapyNeeds.add("AUTOIMMUNE_QUIESCENCE");
      therapyNeeds.add("IMMUNE_MODULATION");
      therapyNeeds.add("INFLAMMATION_CONTROL");
      break;
    case "INFLAMMATORY":
      kits.push("PHENOTYPE INFLAMATION");
      therapyNeeds.add("INFLAMMATION_CONTROL");
      therapyNeeds.add("SCALP_DECONGESTION");
      break;
    case "NUTRITIONAL":
      kits.push("NUTRITIONAL REPLETION");
      therapyNeeds.add("NUTRITIONAL_REPLETION");
      break;
    case "GUT_AXIS":
      kits.push("GUT REPAIR");
      therapyNeeds.add("GUT_REPAIR");
      therapyNeeds.add("NUTRITIONAL_REPLETION");
      break;
    case "SHAFT_REPAIR":
      kits.push("SHAFT REPAIR");
      therapyNeeds.add("SHAFT_RECONSTRUCTION");
      break;
    case "MULTIFACTORIAL":
      kits.push("MPHL PLUS", "HAIR FACT TE GOLD", "PHENOTYPE INFLAMATION");
      therapyNeeds.add("DHT_SUPPRESSION");
      therapyNeeds.add("CYCLE_RESTORATION");
      therapyNeeds.add("INFLAMMATION_CONTROL");
      therapyNeeds.add("NUTRITIONAL_REPLETION");
      therapyNeeds.add("ENDOCRINE_OPTIMIZATION");
      break;
  }

  // Cross-cutting amplifiers
  if (c.questionnaireAnswers.deficiency?.includes("Iron deficiency")) {
    kits.push("IRON SUPPORT");
    therapyNeeds.add("NUTRITIONAL_REPLETION");
  }
  if (c.questionnaireAnswers.thyroid?.includes("Hypothyroidism")) {
    therapyNeeds.add("ENDOCRINE_OPTIMIZATION");
  }
  if (inflamActive && protocolClass !== "INFLAMMATORY") {
    therapyNeeds.add("SCALP_DECONGESTION");
  }

  return {
    protocolClass,
    recommendedKits: kits,
    firedRules: fired,
    therapyNeeds: [...therapyNeeds].sort(),
  };
}
