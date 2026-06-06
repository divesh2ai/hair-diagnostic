import type { NarrativeResult } from "../packages/ai-engine/explanations/types";

export function renderNarrativeView(narratives: NarrativeResult): void {
  console.log("========================================");
  console.log("NARRATIVE OUTPUTS");
  console.log("========================================");

  const docPreview = narratives.doctorSummary
    ? narratives.doctorSummary.substring(0, 80) + "..."
    : "NONE";
  const patPreview = narratives.patientSummary
    ? narratives.patientSummary.substring(0, 80) + "..."
    : "NONE";

  console.log(`- Doctor Summary: ${docPreview}`);
  console.log(`- Patient Summary: ${patPreview}`);
  console.log(`- Narrative Length: ${narratives.length}`);
  console.log("");
}
