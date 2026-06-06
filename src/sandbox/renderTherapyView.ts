import type { TherapyNeeds } from "../packages/ai-engine/therapy-engine/types";

export function renderTherapyView(therapy: TherapyNeeds): void {
  console.log("========================================");
  console.log("THERAPY PLAN");
  console.log("========================================");

  console.log(`- Therapy Needs: ${therapy.needs.join(", ") || "None"}`);
  const reasons = Object.entries(therapy.needReasons)
    .map(([need, r]) => `${need}: ${(r ?? []).join("; ")}`)
    .join("\n  ");
  if (reasons) console.log(`- Need Reasons:\n  ${reasons}`);
  console.log("");
}
