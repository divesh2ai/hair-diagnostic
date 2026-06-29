import type { TreatmentPhase } from "../../../../../src/packages/ai-engine/report-engine/types";
import { CardShell, Pill } from "./_shell";

export function RecommendationKitCard({ kit }: { kit: TreatmentPhase }) {
  return (
    <CardShell
      eyebrow={`Phase ${kit.phase}`}
      title={kit.displayName}
      action={<Pill tone="sky">{kit.kitId}</Pill>}
    >
      <div className="space-y-3 text-sm text-slate-700">
        <p className="leading-snug">{kit.whySelected}</p>

        {kit.supportingConditions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-500 mb-1">Addresses</p>
            <div className="flex flex-wrap gap-1.5">
              {kit.supportingConditions.map((c) => (
                <Pill key={c} tone="teal">{c}</Pill>
              ))}
            </div>
          </div>
        )}

        {kit.keyIngredients.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-500 mb-1">Key ingredients</p>
            <p className="text-xs">{kit.keyIngredients.join(" · ")}</p>
          </div>
        )}

        {kit.mechanismOfAction.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-500 mb-1">Mechanism</p>
            <ul className="text-xs space-y-1 list-disc pl-4">
              {kit.mechanismOfAction.map((m, idx) => <li key={idx}>{m}</li>)}
            </ul>
          </div>
        )}
      </div>
    </CardShell>
  );
}
