import type {
  GeneralLifestyleGuide,
  DietLifestyleRecommendation,
} from "../../../../../src/packages/ai-engine/report-engine/types";
import { CardShell } from "./_shell";

export function LifestyleCard({
  general,
  conditionMapped,
}: {
  general: GeneralLifestyleGuide;
  conditionMapped: DietLifestyleRecommendation[];
}) {
  return (
    <CardShell eyebrow="Lifestyle" title="Diet & lifestyle">
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <Column title="Add to diet" items={general.foodsToAdd} tone="teal" />
        <Column title="Reduce" items={general.foodsToAvoid} tone="rose" />
      </div>
      {general.lifestyleRecommendations.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
            Lifestyle
          </p>
          <ul className="space-y-1 text-sm text-slate-700">
            {general.lifestyleRecommendations.map((l, idx) => (
              <li key={idx}>· {l}</li>
            ))}
          </ul>
        </div>
      )}
      {conditionMapped.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
            Condition-specific
          </p>
          <ul className="space-y-2">
            {conditionMapped.map((r, idx) => (
              <li key={idx} className="text-sm">
                <p className="text-slate-800"><strong>{r.condition}</strong> · {r.recommendation}</p>
                <p className="text-xs text-stone-500">{r.expectedBenefit}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardShell>
  );
}

function Column({ title, items, tone }: { title: string; items: string[]; tone: "teal" | "rose" }) {
  const borderColor = tone === "teal" ? "border-teal-200" : "border-rose-200";
  const headColor = tone === "teal" ? "text-teal-700" : "text-rose-700";
  return (
    <div className={`rounded-xl border ${borderColor} bg-white p-3`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${headColor} mb-2`}>{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-stone-500">—</p>
      ) : (
        <ul className="space-y-1 text-sm text-slate-700">
          {items.map((it, idx) => <li key={idx}>· {it}</li>)}
        </ul>
      )}
    </div>
  );
}
