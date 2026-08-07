import type { Consultation } from "@shared/types/consultation";
import { CardShell, Pill } from "./_shell";

// Safety & disclosure surface. Every bucket is populated verbatim from
// existing canonical fields on the Consultation — no client-side
// recomputation, no synthesized findings, no rule IDs. Buckets:
//   • CAUTION       — treatmentPlan.topicalCautions[]
//   • MISSING_INPUT — confidence.missingInformation[]
//   • NOT_EVALUATED — evidence.items[status="FUTURE"]
// A BLOCK bucket is intentionally omitted: the current canonical contract
// has no BLOCK-severity field. If the engine emits one later, add a bucket
// here — do NOT synthesise blocks from other fields.

export function SafetyCard({ consultation }: { consultation: Consultation }) {
  const cautions = consultation.treatmentPlan.topicalCautions ?? [];
  const missing = consultation.confidence.missingInformation ?? [];
  const notEvaluated =
    consultation.evidence?.items?.filter((e) => e.status === "FUTURE") ?? [];

  if (cautions.length === 0 && missing.length === 0 && notEvaluated.length === 0) {
    return (
      <CardShell eyebrow="Safety" title="Safety & disclosures">
        <p className="text-sm text-slate-600">
          No safety cautions, missing inputs, or unevaluated evidence for this
          consultation.
        </p>
      </CardShell>
    );
  }

  return (
    <CardShell eyebrow="Safety" title="Safety & disclosures">
      <div className="space-y-4">
        {cautions.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Pill tone="amber">CAUTION</Pill>
              <span className="text-xs text-stone-500">Topicals to avoid</span>
            </div>
            <ul className="space-y-1 text-sm text-slate-800">
              {cautions.map((c, i) => (
                <li key={`${c.name}-${i}`}>
                  <span className="font-medium">{c.name}</span>{" "}
                  <span className="text-slate-600">— {c.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {missing.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Pill tone="sky">MISSING INPUT</Pill>
              <span className="text-xs text-stone-500">
                Would raise confidence if collected
              </span>
            </div>
            <ul className="space-y-2 text-sm text-slate-800">
              {missing.map((m, i) => (
                <li key={`${m.kind}-${i}`}>
                  <p>
                    <span className="font-medium">{humanKind(m.kind)}</span>{" "}
                    <span className="text-slate-600">— {m.reason}</span>
                  </p>
                  {m.suggestion && (
                    <p className="text-xs text-stone-500">{m.suggestion}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {notEvaluated.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Pill tone="slate">NOT EVALUATED</Pill>
              <span className="text-xs text-stone-500">
                Evidence not available for this consultation
              </span>
            </div>
            <ul className="space-y-1 text-sm text-slate-800">
              {notEvaluated.map((e, i) => (
                <li key={`${e.kind}-${i}`}>
                  <span className="font-medium">{humanKind(e.kind)}</span>
                  {e.detail && (
                    <span className="text-slate-600"> — {e.detail}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CardShell>
  );
}

const KIND_LABELS: Record<string, string> = {
  ASSESSMENT_QUESTIONNAIRE: "Questionnaire",
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

function humanKind(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
