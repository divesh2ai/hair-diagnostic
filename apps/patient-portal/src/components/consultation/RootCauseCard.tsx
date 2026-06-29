import type { RootCauseAnalysis, ImpactLevel } from "@shared/types/consultation";
import type { RootCauseCondition } from "../../../../../src/packages/ai-engine/report-engine/types";
import { CardShell, Pill } from "./_shell";

const IMPACT_TONE: Record<ImpactLevel, "rose" | "amber" | "slate"> = {
  High: "rose",
  Moderate: "amber",
  Low: "slate",
};

function Bucket({ title, items }: { title: string; items: RootCauseCondition[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">{title}</p>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.condition} className="rounded-xl border border-stone-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{c.condition}</p>
              <Pill tone={IMPACT_TONE[c.impact]}>{c.impact}</Pill>
            </div>
            <p className="text-xs text-stone-600 mt-1">{c.clinicalRelevance}</p>
            {c.supportingSignals.length > 0 && (
              <p className="text-[11px] text-stone-500 mt-1">Signals · {c.supportingSignals.join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RootCauseCard({ rootCause }: { rootCause: RootCauseAnalysis }) {
  return (
    <CardShell eyebrow="Root cause" title="What's driving this">
      <div className="space-y-4">
        <Bucket title="Primary" items={rootCause.primary} />
        <Bucket title="Secondary" items={rootCause.secondary} />
        <Bucket title="Amplifiers" items={rootCause.amplifiers} />
      </div>
    </CardShell>
  );
}
