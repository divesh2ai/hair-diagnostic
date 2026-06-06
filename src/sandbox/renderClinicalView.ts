import type { ClinicalProfile } from "../packages/ai-engine/clinical-engine/types";

export function renderClinicalView(clinical: ClinicalProfile): void {
  console.log("========================================");
  console.log("CLINICAL DETECTION");
  console.log("========================================");

  console.log(`- Primary Condition: ${clinical.primaryDiagnosis}`);
  const secondary = clinical.secondaryDiagnoses.map((d) => d.key).join(", ") || "None";
  console.log(`- Secondary Conditions: ${secondary}`);
  console.log(`- Severity: ${clinical.severity}`);
  console.log(`- Primary Score: ${clinical.primaryScore.toFixed(3)}`);
  console.log(`- Scalp States: ${clinical.scalpStates.join(", ") || "None"}`);
  console.log(`- Root Causes: ${clinical.rootCauses.join(", ") || "None"}`);
  const flags = Object.entries(clinical.flags)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ") || "None";
  console.log(`- Flags: ${flags}`);
  console.log("");
}
