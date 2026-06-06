/**
 * Builds DiagnosisResult from cause posteriors using the cause registry's
 * legacyMappings to emit the legacy DiagnosisKey for the protocol layer.
 *
 * Rules:
 *   - Primary = top-1 posterior.
 *   - Co-explanations = posteriors within dissent ceiling (≤ 0.05 gap).
 *   - Legacy key resolution prefers `parityStrategy: "direct"` mapped to
 *     the primary cause; otherwise the first available mapping.
 *   - Severity is taken from grade signals when present, else from
 *     activation magnitude.
 *   - Confidence is bounded by the leading cause's posterior.
 */

import {
  ActivatedPathway,
  CausePosterior,
  ClinicalReplayCase,
  DiagnosisResult,
  ExtractedSignal,
  Severity,
} from "../types";
import { loadRegistries } from "./registryLoader";

const CO_LEAD_GAP = 0.05;

function legacyKeyFor(
  causeId: string,
  c: ClinicalReplayCase,
  signals: ExtractedSignal[]
): string {
  const { causes } = loadRegistries();
  const entry = causes.get(causeId);
  if (!entry) return "UNKNOWN";

  const hasSig = (id: string): boolean => signals.some((s) => s.signalId === id);
  const sex = c.demographicProfile.sex;
  const grade45 = hasSig("grade45-severity-marker");

  if (causeId === "androgen-driven-miniaturization") {
    if (sex === "Male") return grade45 ? "AGA_MALE_45" : "AGA_MALE_123";
    return grade45 ? "AGA_FEMALE_45" : "AGA_FEMALE_123";
  }
  if (causeId === "stress-driven-telogen-effluvium") {
    if (hasSig("postpartum-lactating") || hasSig("postpartum-not-lactating")) return "POSTPARTUM_TE";
    if (hasSig("post-illness-recovery")) return "POST_ILLNESS_TE";
    if (hasSig("crash-diet-pattern")) return "NUTRITIONAL_TE";
    if (hasSig("chronic-duration-marker")) return "CHRONIC_TE";
    return "ACUTE_TE";
  }
  if (causeId === "hormonal-hair-loss") {
    if (hasSig("pcos-with-metabolic")) return "PCOS_METABOLIC";
    if (hasSig("pcos-diagnosis")) return "PCOS_HAIRLOSS";
    if (hasSig("hypothyroid-diagnosis")) return "HYPOTHYROID_HAIRLOSS";
    if (hasSig("hyperthyroid-diagnosis")) return "HYPERTHYROID_HAIRLOSS";
    if (hasSig("postmenopause-state") || hasSig("menopause-state")) return "MENOPAUSAL_HAIRLOSS";
    if (hasSig("perimenopause-state")) return "PERIMENOPAUSE_HAIRLOSS";
    return "PCOS_HAIRLOSS";
  }
  if (causeId === "autoimmune-hair-loss") {
    if (hasSig("scarring-alopecia-history")) return "SCARRING_ALOPECIA";
    return "ALOPECIA_AREATA";
  }
  if (causeId === "inflammatory-scalp-dysfunction") {
    if (hasSig("psoriatic-scalp")) return "PSORIATIC_SCALP";
    if (hasSig("dandruff-with-itching") || hasSig("oily-scalp")) return "SEBORRHEIC_DERMATITIS";
    return "INFLAMMATORY_SCALP";
  }
  if (causeId === "nutritional-hair-stress") {
    if (hasSig("vegan-diet")) return "VEGAN_NUTRITIONAL";
    if (hasSig("iron-deficiency-reported")) return "IRON_DEFICIENCY";
    return "NUTRITIONAL_TE";
  }
  if (causeId === "metabolic-hair-dysfunction") {
    if (hasSig("pcos-with-metabolic")) return "PCOS_METABOLIC";
    return "METABOLIC_HAIRLOSS";
  }
  if (causeId === "gut-hair-axis-dysfunction") return "GUT_AXIS_HAIRLOSS";
  if (causeId === "hair-shaft-damage-syndrome") {
    if (hasSig("chemical-treatment-exposure")) return "CHEMICAL_DAMAGE";
    if (hasSig("heat-styling-exposure")) return "HEAT_DAMAGE";
    return "SHAFT_DAMAGE";
  }
  if (causeId === "multifactorial-hair-loss") return "MULTI";

  const m = entry.legacyMappings[0];
  return m?.legacyDiagnosisKey ?? "UNKNOWN";
}

function severityFrom(signals: ExtractedSignal[], pathways: ActivatedPathway[]): Severity {
  if (signals.some((s) => s.signalId === "grade45-severity-marker")) return "severe";
  if (signals.some((s) => s.signalId === "active-shedding-heavy")) return "severe";
  const topAct = pathways[0]?.activation ?? 0;
  if (topAct >= 0.7) return "severe";
  if (topAct >= 0.45) return "moderate";
  return "mild";
}

export function buildDiagnosis(
  c: ClinicalReplayCase,
  posteriors: CausePosterior[],
  pathways: ActivatedPathway[],
  signals: ExtractedSignal[]
): DiagnosisResult {
  const top = posteriors[0]!;
  const co: string[] = [];
  for (let i = 1; i < posteriors.length; i++) {
    const p = posteriors[i]!;
    if (top.posterior - p.posterior <= CO_LEAD_GAP && p.posterior >= 0.1) co.push(p.causeId);
    else break;
  }
  return {
    primary: top.causeId,
    coExplanations: co,
    legacyDiagnosisKey: legacyKeyFor(top.causeId, c, signals),
    severity: severityFrom(signals, pathways),
    confidence: top.posterior,
  };
}
