import type { TopicalRecommendation } from "@shared/types/consultation";
import { CardShell } from "./_shell";

// Renders `consultation.treatmentPlan.topicals` verbatim from the canonical
// payload. No recomputation, no client-side ranking — items appear in the
// exact order the engine emitted them. Absent by design when the engine did
// not surface any topicals for this consultation.

export function TopicalsCard({
  topicals,
}: {
  topicals: TopicalRecommendation[];
}) {
  if (!topicals || topicals.length === 0) return null;
  return (
    <CardShell eyebrow="Topical care" title="Topical recommendations">
      <ul className="space-y-3">
        {topicals.map((t, i) => (
          <li
            key={`${t.name}-${i}`}
            className="rounded-xl border border-stone-200 px-3 py-2.5"
          >
            <p className="text-sm font-medium text-slate-900">{t.name}</p>
            {t.usage && (
              <p className="mt-0.5 text-xs text-stone-600 leading-snug">
                {t.usage}
              </p>
            )}
            {t.note && (
              <p className="mt-1 text-xs text-slate-700">{t.note}</p>
            )}
            {t.whySelected && (
              <p className="mt-1 text-[11px] text-stone-500 italic">
                {t.whySelected}
              </p>
            )}
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
