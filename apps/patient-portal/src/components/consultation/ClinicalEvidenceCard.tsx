import type { ClinicalEvidence, EvidenceStatus } from "@shared/types/consultation";
import { CardShell, Pill } from "./_shell";

const LABELS: Record<string, string> = {
  ASSESSMENT_QUESTIONNAIRE: "Assessment questionnaire",
  SCALP_IMAGES: "Scalp images",
  DOCTOR_NOTES: "Doctor notes",
  CLINIC_OBSERVATIONS: "Clinic observations",
  PREVIOUS_CONSULTATION: "Previous consultation",
  PREVIOUS_REPORTS: "Previous reports",
  LAB_REPORTS: "Lab reports",
  TRICHOSCOPY: "Trichoscopy",
  WEARABLES: "Wearables",
  GENETICS: "Genetics",
};

function statusTone(s: EvidenceStatus): "teal" | "slate" | "neutral" {
  if (s === "USED") return "teal";
  if (s === "FUTURE") return "slate";
  return "neutral";
}

function statusLabel(s: EvidenceStatus) {
  return s === "USED" ? "Used" : s === "NOT_PROVIDED" ? "Not provided" : "Future";
}

export function ClinicalEvidenceCard({ evidence }: { evidence: ClinicalEvidence }) {
  return (
    <CardShell eyebrow="Evidence" title="What fed this diagnosis">
      <ul className="divide-y divide-stone-100">
        {evidence.items.map((i) => (
          <li key={i.kind} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{LABELS[i.kind] ?? i.kind}</p>
              {i.detail && <p className="text-xs text-stone-500 truncate">{i.detail}</p>}
            </div>
            <Pill tone={statusTone(i.status)}>{statusLabel(i.status)}</Pill>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
