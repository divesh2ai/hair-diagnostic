import type { RootCauseAnalysis } from "@shared/types/consultation";
import { CardShell, Pill } from "./_shell";

// Risk factors == the amplifiers bucket of the root-cause analysis.
// Kept as a separate primitive because PDFs / WhatsApp consume it standalone.
export function RiskFactorsCard({ rootCause }: { rootCause: RootCauseAnalysis }) {
  if (rootCause.amplifiers.length === 0) return null;
  return (
    <CardShell eyebrow="Risk factors" title="Amplifiers slowing recovery">
      <ul className="space-y-2">
        {rootCause.amplifiers.map((a) => (
          <li key={a.condition} className="rounded-xl border border-stone-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{a.condition}</p>
              <Pill tone={a.impact === "High" ? "rose" : a.impact === "Moderate" ? "amber" : "slate"}>
                {a.impact}
              </Pill>
            </div>
            <p className="text-xs text-stone-600 mt-1">{a.clinicalRelevance}</p>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
