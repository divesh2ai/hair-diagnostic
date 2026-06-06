import type { KitRecommendation } from "../packages/ai-engine/kit-scorer/types";

export function renderRecommendationView(recommendations: KitRecommendation): void {
  console.log("========================================");
  console.log("RECOMMENDATIONS");
  console.log("========================================");

  console.log(`- Protocol: ${recommendations.protocolLabel}`);
  console.log(`- Kits Ranked: ${recommendations.rankedKits.length}`);
  recommendations.rankedKits.forEach((kit, i) => {
    console.log(`  ${i + 1}. ${kit.kitId} (score: ${kit.score.toFixed(3)}, phase: ${kit.phase})`);
  });
  console.log(`- Rationale: ${recommendations.protocolRationale}`);
  console.log(`- Rules Applied: ${recommendations.appliedRules.join(", ") || "None"}`);
  console.log("");
}
