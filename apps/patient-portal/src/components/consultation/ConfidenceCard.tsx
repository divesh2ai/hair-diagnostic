import type { Confidence } from "@shared/types/consultation";
import { CardShell, Pill } from "./_shell";

export function ConfidenceCard({ confidence }: { confidence: Confidence }) {
  const pct = Math.round(confidence.overall.score * 100);
  const tone = confidence.overall.band === "high" ? "teal" : confidence.overall.band === "moderate" ? "amber" : "rose";

  return (
    <CardShell
      eyebrow="Confidence"
      title={`${pct}% · ${confidence.overall.band}`}
      action={<Pill tone={tone}>{confidence.overall.band.toUpperCase()}</Pill>}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-700 leading-snug">{confidence.overall.rationale}</p>

        <div className="grid grid-cols-3 gap-2 text-center">
          {(["diagnosis", "rootCause", "treatment"] as const).map((k) => (
            <div key={k} className="rounded-xl border border-stone-200 bg-stone-50/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-stone-500">{k}</p>
              <p className="text-sm font-semibold text-slate-800 tabular-nums">
                {Math.round(confidence.bySection[k].score * 100)}%
              </p>
            </div>
          ))}
        </div>

        {confidence.missingInformation.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-500 mb-1.5">Suggested additional inputs</p>
            <ul className="space-y-1.5">
              {confidence.missingInformation.map((m, idx) => (
                <li key={`${m.kind}-${idx}`} className="text-xs text-slate-700">
                  <span className="font-medium">{m.suggestion}</span>
                  <span className="text-stone-500"> — {m.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CardShell>
  );
}
