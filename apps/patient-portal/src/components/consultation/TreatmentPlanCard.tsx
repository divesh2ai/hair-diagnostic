import type { TreatmentPlan, TreatmentTier, Recommendation } from "@shared/types/consultation";
import { CardShell, Pill } from "./_shell";

const TIER_ORDER: TreatmentTier[] = ["IMMEDIATE", "SHORT_TERM", "LONG_TERM", "MAINTENANCE"];
const TIER_LABEL: Record<TreatmentTier, string> = {
  IMMEDIATE: "Immediate",
  SHORT_TERM: "Short-term",
  LONG_TERM: "Long-term",
  MAINTENANCE: "Maintenance",
};

const PRIORITY_TONE: Record<Recommendation["priority"], "rose" | "amber" | "sky" | "slate"> = {
  URGENT: "rose",
  HIGH: "amber",
  STANDARD: "sky",
  OPTIONAL: "slate",
};

export function TreatmentPlanCard({ plan }: { plan: TreatmentPlan }) {
  const byTier = TIER_ORDER.map((t) => ({
    tier: t,
    items: plan.recommendations.filter((r) => r.tier === t),
  })).filter((g) => g.items.length > 0);

  return (
    <CardShell eyebrow="Plan" title="Treatment plan">
      <div className="space-y-5">
        {byTier.map(({ tier, items }) => (
          <div key={tier}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
              {TIER_LABEL[tier]}
            </p>
            <ul className="space-y-2">
              {items.map((r) => (
                <li key={r.id} className="rounded-xl border border-stone-200 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{r.title}</p>
                      <p className="text-xs text-stone-600 leading-snug mt-0.5">{r.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Pill tone={PRIORITY_TONE[r.priority]}>{r.priority}</Pill>
                      {r.duration && <span className="text-[11px] text-stone-500">{r.duration}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {plan.topicalCautions.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2">
            <p className="text-xs font-semibold text-amber-800 mb-1">Topical cautions</p>
            <ul className="text-xs text-amber-900 space-y-0.5">
              {plan.topicalCautions.map((c) => (
                <li key={c.name}><strong>{c.name}</strong> — {c.reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CardShell>
  );
}
