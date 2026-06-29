import type { ClinicalInterpretation } from "@shared/types/consultation";
import { CardShell } from "./_shell";

export function ClinicalFindingsCard({ findings }: { findings: ClinicalInterpretation[] }) {
  if (findings.length === 0) {
    return (
      <CardShell eyebrow="Findings" title="Clinical interpretation">
        <p className="text-sm text-stone-500">No notable findings derived from this assessment.</p>
      </CardShell>
    );
  }
  return (
    <CardShell eyebrow="Findings" title="Clinical interpretation">
      <ul className="space-y-3">
        {findings.map((f, idx) => (
          <li key={`${f.signal}-${idx}`} className="border-l-2 border-teal-200 pl-3">
            <p className="text-xs font-semibold text-teal-700">{f.signal}{f.condition ? ` · ${f.condition}` : ""}</p>
            <p className="text-sm text-slate-700 leading-snug">{f.interpretation}</p>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
