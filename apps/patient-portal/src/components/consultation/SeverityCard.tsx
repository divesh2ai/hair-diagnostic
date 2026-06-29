import type { Severity } from "@shared/types/consultation";
import { CardShell, Pill } from "./_shell";

const TONE: Record<Severity, "teal" | "amber" | "rose" | "slate"> = {
  MILD: "teal",
  MODERATE: "amber",
  SEVERE: "rose",
  UNKNOWN: "slate",
};

const COPY: Record<Severity, string> = {
  MILD: "Early-stage. High likelihood of recovery with conservative care.",
  MODERATE: "Progressing. Active multi-axis treatment recommended.",
  SEVERE: "Advanced. Combined therapy + close follow-up indicated.",
  UNKNOWN: "Severity could not be determined from current evidence.",
};

export function SeverityCard({ severity, source }: { severity: Severity; source?: "engine" | "doctor_override" }) {
  return (
    <CardShell eyebrow="Severity" title={severity}>
      <div className="flex items-center gap-2 mb-3">
        <Pill tone={TONE[severity]}>{severity}</Pill>
        {source === "doctor_override" && <Pill tone="slate">Doctor override</Pill>}
      </div>
      <p className="text-sm text-slate-700 leading-snug">{COPY[severity]}</p>
    </CardShell>
  );
}
