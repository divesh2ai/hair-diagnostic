import type { Diagnosis } from "@shared/types/consultation";
import { CardShell, KeyValue, Pill } from "./_shell";

export function DiagnosisSummaryCard({ diagnosis }: { diagnosis: Diagnosis }) {
  return (
    <CardShell eyebrow="Diagnosis" title={diagnosis.primary}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Pill tone={diagnosis.severity === "SEVERE" ? "rose" : diagnosis.severity === "MODERATE" ? "amber" : "teal"}>
            Severity · {diagnosis.severity}
          </Pill>
          <Pill tone="slate">{diagnosis.severitySource === "doctor_override" ? "Doctor confirmed" : "Engine"}</Pill>
        </div>

        {diagnosis.differentials.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-500 mb-1.5">Differentials</p>
            <ul className="space-y-1.5">
              {diagnosis.differentials.slice(0, 5).map((d) => (
                <li key={d.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-800 truncate">{d.label}</span>
                  <span className="text-xs text-stone-500 tabular-nums">{(d.score * 10).toFixed(0)}/10</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <KeyValue label="Diagnosis key" value={<code className="text-xs">{diagnosis.primaryKey}</code>} />
      </div>
    </CardShell>
  );
}
