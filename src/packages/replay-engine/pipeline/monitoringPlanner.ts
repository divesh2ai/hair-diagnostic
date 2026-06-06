/**
 * Deterministic monitoring planner. Schedules labs/scope based on
 * diagnosis class + supporting signals.
 */

import {
  ClinicalReplayCase,
  DiagnosisResult,
  MonitoringResult,
  ProtocolResult,
} from "../types";

export function scheduleMonitoring(
  c: ClinicalReplayCase,
  diag: DiagnosisResult,
  protocol: ProtocolResult
): MonitoringResult {
  const scheduled = new Set<string>();

  // Universal core
  scheduled.add("GLOBAL_PHOTO_3M");

  switch (protocol.protocolClass) {
    case "MPHL":
    case "FPHL":
      scheduled.add("TRICHOSCOPY_6M");
      scheduled.add("SHED_COUNT_MONTHLY");
      break;
    case "PCOS":
      scheduled.add("ANDROGEN_PANEL_6M");
      scheduled.add("MENSTRUAL_DIARY");
      if (diag.legacyDiagnosisKey === "PCOS_METABOLIC") {
        scheduled.add("HBA1C_3M");
        scheduled.add("WEIGHT_MONTHLY");
      }
      break;
    case "HORMONAL":
      scheduled.add("TSH_3M");
      scheduled.add("FREE_T4_3M");
      break;
    case "TE_ACUTE":
    case "TE_CHRONIC":
    case "TE_POST_ILLNESS":
      scheduled.add("SHED_COUNT_MONTHLY");
      scheduled.add("FERRITIN_4M");
      scheduled.add("VITAMIN_D_4M");
      scheduled.add("STRESS_PHQ_MONTHLY");
      if (protocol.protocolClass !== "TE_POST_ILLNESS") scheduled.add("TSH_3M");
      break;
    case "AUTOIMMUNE_AA":
      scheduled.add("SCALP_EXAM_3M");
      scheduled.add("TRICHOSCOPY_6M");
      break;
    case "INFLAMMATORY":
      scheduled.add("SCALP_EXAM_3M");
      scheduled.add("TRICHOSCOPY_6M");
      break;
    case "MULTIFACTORIAL":
      scheduled.add("TRICHOSCOPY_6M");
      scheduled.add("FERRITIN_4M");
      scheduled.add("VITAMIN_D_4M");
      scheduled.add("TSH_3M");
      scheduled.add("SHED_COUNT_MONTHLY");
      scheduled.add("STRESS_PHQ_MONTHLY");
      break;
  }

  // Cross-cutting deficiency / endocrine driven adds
  const a = c.questionnaireAnswers;
  if (a.deficiency?.includes("Iron deficiency")) scheduled.add("FERRITIN_4M");
  if (a.deficiency?.includes("Vitamin D deficiency")) scheduled.add("VITAMIN_D_4M");
  if (a.deficiency?.includes("Vitamin B12 deficiency")) scheduled.add("B12_4M");
  if (a.thyroid?.includes("Hypothyroidism") || a.thyroid?.includes("Hyperthyroidism")) {
    scheduled.add("TSH_3M");
    scheduled.add("FREE_T4_3M");
  }

  return { scheduled: [...scheduled].sort() };
}
