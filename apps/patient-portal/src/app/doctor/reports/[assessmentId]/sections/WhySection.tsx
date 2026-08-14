"use client";

import type { Consultation, EvidenceItem } from "@shared/types/consultation";

// WHY DOES DR FACT THINK THAT? — traceability, in about five lines.
//
// ── Provenance is claimed, never assumed ────────────────────────────────────
// Each point is labelled with where it came from, and the label is derived
// from the evidence catalogue the engine actually produced. If no scalp images
// were contributed, nothing on this page says "image derived" — a fabricated
// provenance is worse than none, because a doctor may weigh an image-confirmed
// finding differently from a self-reported one.
//
// ── Confidence is a band, not a percentage ──────────────────────────────────
// The engine stores `confidence.overall.score` as a 0–1 number, but that number
// has no validated clinical meaning: "87%" invites a doctor to treat it as a
// calibrated probability of diagnosis, which it is not. The band it is already
// bucketed into is the honest form of the same information.
//
// ── One disclosure, not five ────────────────────────────────────────────────
// A single line at the foot of this section. Repeating "AI generated" beside
// every item trains doctors to ignore the phrase and makes the workspace read
// as a chatbot rather than decision support.

type Provenance = "reported" | "image" | "historical" | "engine";

const PROVENANCE_LABELS: Record<Provenance, string> = {
  reported: "Patient reported",
  image: "Image derived",
  historical: "Previous visit",
  engine: "Clinical engine",
};

const PROVENANCE_STYLES: Record<Provenance, string> = {
  reported: "bg-stone-100 text-stone-700",
  image: "bg-sky-50 text-sky-800",
  historical: "bg-teal-50 text-teal-800",
  engine: "bg-slate-100 text-slate-700",
};

/**
 * Which evidence kinds were genuinely used for this consultation.
 *
 * `EvidenceStatus` distinguishes USED from NOT_PROVIDED and FUTURE, so the set
 * of things we may claim as sources is exactly the USED ones.
 */
function usedEvidenceKinds(evidence: Consultation["evidence"]): Set<EvidenceItem["kind"]> {
  const used = new Set<EvidenceItem["kind"]>();
  if (evidence?.questionnaire?.status === "USED") {
    used.add(evidence.questionnaire.kind);
  }
  for (const item of evidence?.items ?? []) {
    if (item.status === "USED") used.add(item.kind);
  }
  return used;
}

/**
 * Attribute one driver to a source.
 *
 * A driver carries `supportingSignals` — raw questionnaire answers. When those
 * exist the point is patient-reported, because that is literally where the
 * signal came from. Image and historical attributions are only ever made when
 * the corresponding evidence was actually contributed AND the driver has no
 * questionnaire signals of its own to explain it.
 */
function provenanceFor(
  supportingSignals: string[] | undefined,
  used: Set<EvidenceItem["kind"]>,
): Provenance {
  if (supportingSignals && supportingSignals.length > 0) return "reported";
  if (used.has("SCALP_IMAGES") || used.has("TRICHOSCOPY")) return "image";
  if (used.has("PREVIOUS_CONSULTATION") || used.has("PREVIOUS_REPORTS")) return "historical";
  return "engine";
}

const BAND_LABELS = {
  high: "Strong evidence",
  moderate: "Mixed evidence",
  low: "Limited evidence",
} as const;

const BAND_STYLES = {
  high: "bg-teal-50 text-teal-800 ring-teal-200",
  moderate: "bg-stone-100 text-slate-700 ring-stone-200",
  low: "bg-amber-50 text-amber-900 ring-amber-200",
} as const;

/** The strongest points, capped so this stays scannable. */
const MAX_POINTS = 5;

export interface WhySectionProps {
  rootCause: Consultation["rootCause"];
  evidence: Consultation["evidence"];
  confidence: Consultation["confidence"];
  /** Deeper reasoning already rendered elsewhere; linked, not duplicated. */
  onOpenFullReasoning?: () => void;
}

export function WhySection({ rootCause, evidence, confidence }: WhySectionProps) {
  const used = usedEvidenceKinds(evidence);

  // Primary drivers first, then secondary, until we have enough points.
  const points = [...(rootCause?.primary ?? []), ...(rootCause?.secondary ?? [])]
    .filter((d) => Boolean(d.clinicalRelevance))
    .slice(0, MAX_POINTS)
    .map((d) => ({
      condition: d.condition,
      text: d.clinicalRelevance,
      signals: d.supportingSignals ?? [],
      provenance: provenanceFor(d.supportingSignals, used),
    }));

  const band = confidence?.overall?.band ?? null;

  if (points.length === 0) return null;

  return (
    <section aria-labelledby="why-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="why-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
        >
          Why Dr FACT reached this assessment
        </h2>
        {band && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${BAND_STYLES[band]}`}
          >
            {BAND_LABELS[band]}
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {points.map((p, i) => (
          <li key={`${p.condition}-${i}`} className="flex gap-3">
            <span
              aria-hidden
              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
            />
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-slate-800">{p.text}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${PROVENANCE_STYLES[p.provenance]}`}
                >
                  {PROVENANCE_LABELS[p.provenance]}
                </span>
                {p.signals.length > 0 && (
                  <span className="truncate text-[11px] text-stone-500">
                    {p.signals.slice(0, 3).join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* The single disclosure for the whole workspace. */}
      <p className="border-t border-stone-200 pt-3 text-[11px] text-stone-500">
        Clinical decision support · Doctor confirmation required
      </p>
    </section>
  );
}
