"use client";

import type {
  Consultation,
  Diagnosis,
  Severity,
} from "@shared/types/consultation";

// WHAT IS HAPPENING? — the primary clinical scan area.
//
// ── Why this is not the old "Clinical interpretation" card ──────────────────
// The previous first screen was a questionnaire dump followed by an
// interpretation list, so the doctor had to read to find the diagnosis. Here
// the working diagnosis is the largest thing on the page and everything else
// is arranged beneath it in decreasing decision-relevance.
//
// ── Severity lives here, and only here ──────────────────────────────────────
// This is the clinical statement about the patient's disease. The operational
// review pathway lives in ReviewHeader and never uses this visual language —
// conflating the two makes a routine case look urgent.
//
// ── Nothing is invented ─────────────────────────────────────────────────────
// Every field rendered comes from the persisted consultation. There is no
// grading scale, density figure or miniaturisation measure here because the
// clinical model does not carry one; inventing a "Ludwig II" from a severity
// enum would be fabricating a clinical assessment.

const SEVERITY_STYLES: Record<Severity, string> = {
  MILD: "bg-stone-100 text-slate-700 ring-stone-200",
  MODERATE: "bg-amber-50 text-amber-900 ring-amber-200",
  SEVERE: "bg-red-50 text-red-900 ring-red-200",
  UNKNOWN: "bg-stone-100 text-stone-600 ring-stone-200",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  MILD: "Mild",
  MODERATE: "Moderate",
  SEVERE: "Severe",
  UNKNOWN: "Severity not established",
};

export interface FindingsSectionProps {
  diagnosis: Diagnosis;
  rootCause: Consultation["rootCause"];
  clinicalFindings: Consultation["clinicalFindings"];
}

export function FindingsSection({
  diagnosis,
  rootCause,
  clinicalFindings,
}: FindingsSectionProps) {
  // Primary drivers first; amplifiers are contributory and are shown as a
  // quieter trailing line rather than as equal-weight cards.
  const primaryDrivers = rootCause?.primary ?? [];
  const secondaryDrivers = rootCause?.secondary ?? [];
  const amplifiers = rootCause?.amplifiers ?? [];

  const topDifferentials = (diagnosis.differentials ?? []).slice(0, 3);

  return (
    <section aria-labelledby="findings-heading" className="space-y-5">
      <h2
        id="findings-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
      >
        What Dr FACT found
      </h2>

      {/* The headline. Type size and weight carry the hierarchy — not colour,
          and not a row of equally-loud chips. */}
      <div>
        <p className="font-serif text-[28px] leading-tight text-slate-900">
          {diagnosis.primary || "Working diagnosis not established"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${SEVERITY_STYLES[diagnosis.severity]}`}
          >
            {SEVERITY_LABELS[diagnosis.severity]}
          </span>
          {/* A doctor override is a fact worth seeing: it means the number
              below the label is theirs, not the engine's. */}
          {diagnosis.severitySource === "doctor_override" && (
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-medium text-teal-800">
              Severity set by doctor
            </span>
          )}
        </div>
      </div>

      {/* ── Drivers are NAMED here and EXPLAINED in WhySection ────────────
          Both sections read the same `clinicalRelevance` string, so rendering
          the sentence in both put the identical paragraph on screen twice
          within one scroll — once under "Primary drivers" and again as an
          evidence point directly below it. Repetition at that distance reads
          as a rendering fault, and it pushed the protocol further down the
          page for no added information.

          The split follows the cognitive sequence: this section answers WHAT
          is happening, which the condition names carry on their own and scan
          far faster as a list. The reasoning sentence belongs to WHY, where it
          appears once, with its provenance label attached. */}
      {primaryDrivers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-700">Primary drivers</h3>
          <ul className="mt-2 space-y-1.5">
            {primaryDrivers.map((d, i) => (
              <li
                key={`${d.condition}-${i}`}
                className="border-l-2 border-slate-300 pl-3 text-sm font-medium text-slate-900"
              >
                {d.condition}
              </li>
            ))}
          </ul>
        </div>
      )}

      {secondaryDrivers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-700">Contributing factors</h3>
          <ul className="mt-2 space-y-1.5">
            {secondaryDrivers.map((d, i) => (
              <li key={`${d.condition}-${i}`} className="text-sm text-slate-700">
                {d.condition}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Amplifiers are real but rarely decide the protocol. One quiet line. */}
      {amplifiers.length > 0 && (
        <p className="text-xs text-stone-500">
          <span className="font-medium text-stone-600">Amplifiers: </span>
          {amplifiers.map((a) => a.condition).join(" · ")}
        </p>
      )}

      {topDifferentials.length > 0 && (
        <p className="text-xs text-stone-500">
          <span className="font-medium text-stone-600">Also considered: </span>
          {topDifferentials.map((d) => d.label).join(" · ")}
        </p>
      )}

      {/* The signal→interpretation mapping the engine produced. Collapsed by
          default: it is the long tail, and the drivers above already carry the
          decision-relevant content. */}
      {clinicalFindings.length > 0 && (
        <details className="group rounded-xl border border-stone-200 bg-stone-50/60">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500">
            All clinical signals ({clinicalFindings.length})
            <span className="ml-1 text-stone-400 group-open:hidden" aria-hidden>
              ▾
            </span>
          </summary>
          <ul className="space-y-2 border-t border-stone-200 px-4 py-3">
            {clinicalFindings.map((f, i) => (
              <li key={`${f.signal}-${i}`} className="text-sm">
                <span className="font-medium text-slate-800">
                  {f.condition || f.signal}
                </span>
                {f.interpretation && (
                  <span className="text-slate-600"> — {f.interpretation}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
