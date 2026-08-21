"use client";

import { useState } from "react";
import { ClipboardList, X } from "lucide-react";
import type { Consultation } from "@shared/types/consultation";
import { buildClinicalSummary } from "@/lib/doctor/clinicalSummary";
import { AssessmentTranscript } from "./AssessmentTranscript";

// STEP 1 — THE CASE. The hero, and the only thing a doctor must read.
//
// ── What replaced what ──────────────────────────────────────────────────────
// This replaced two competing blocks of equal visual weight: an "Assessment
// responses" transcript of all twenty questions (most unanswered) beside a
// separate interpretation panel. A doctor had to read a questionnaire and
// derive the case themselves.
//
// One surface now answers three questions, in the order a clinician asks them:
//
//   WHAT IS THIS?   severity + headline + synthesis        (authored)
//   WHAT WAS SAID?  patient-reported evidence — selections only
//   WHAT DOES IT    signal → clinical pattern → meaning    (engine's own)
//   MEAN?
//
// ── Evidence is selections, never questions ─────────────────────────────────
// Every row is something the patient actively chose. No "No answer recorded",
// no "Not applicable", no question text — the source is the engine's grouped
// `patientSummary`, not the raw questionnaire. See lib/doctor/clinicalSummary
// for why that distinction is load-bearing.
//
// The full questionnaire is one click away and nowhere else.
//
// ── Emphasis is the engine's, not ours ──────────────────────────────────────
// A selection renders bolder only when the engine's own interpretation names
// that exact signal. This component never decides a reported factor is
// clinically relevant, and never restates a selection as a conclusion.

export interface ClinicalSummarySectionProps {
  consultation: Consultation;
}

export function ClinicalSummarySection({
  consultation,
}: ClinicalSummarySectionProps) {
  const vm = buildClinicalSummary(consultation);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  if (vm.isEmpty) {
    return (
      <section aria-labelledby="summary-heading" className="space-y-3">
        <h2 id="summary-heading" className="hd-eyebrow">
          The case
        </h2>
        <p className="hd-card hd-label p-6">
          No clinical summary was composed for this assessment.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="summary-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="summary-heading" className="hd-step-label">
          <span className="hd-step-num" aria-hidden>
            1
          </span>
          The case
        </h2>
        {/* The questionnaire's only entry point. Deliberately quiet: needing
            it is the exception, and putting it on the surface is what made
            this page read as a survey-results screen. */}
        <button
          type="button"
          onClick={() => setTranscriptOpen(true)}
          className="hd-btn hd-btn-secondary !px-3 !py-1.5 !text-xs"
        >
          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
          View full assessment
        </button>
      </div>

      {/* One card, three bands.

          Picture, evidence and interpretation were three separate floating
          cards of near-equal weight, which read as three unrelated widgets
          rather than one line of reasoning. They are bands inside a single
          surface now, separated by rules — so the section reads as one
          argument: this is the case, this is what was said, this is what it
          means. */}
      <div className="hd-card overflow-hidden">
        <div className="hd-hero p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={"hd-pill " + severityPill(vm.severity.level)}>
              {vm.severity.label}
            </span>
            {vm.severity.setByDoctor && (
              <span className="hd-pill hd-pill-primary">Severity set by doctor</span>
            )}
            {vm.confidence && (
              <span
                className="hd-pill hd-pill-neutral"
                title={vm.confidence.rationale ?? undefined}
              >
                {vm.confidence.label}
              </span>
            )}
          </div>

          {vm.headline && <p className="hd-headline mt-3">{vm.headline}</p>}
          {vm.synthesis && <p className="hd-body mt-3">{vm.synthesis}</p>}

          {vm.patientGoals.length > 0 && (
            <p className="hd-label mt-4">
              <span className="hd-value font-semibold">Patient goal · </span>
              {vm.patientGoals.join(" · ")}
            </p>
          )}
        </div>

        {/* Two columns from lg, stacked below it with evidence first — on a
            narrow screen the source has to precede the reading of it. */}
        <div className="hd-divide-t grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
          {vm.evidence.length > 0 && (
            <div className="hd-divide-b hd-divide-r-lg min-w-0 p-5 sm:p-6">
              <h3 className="hd-eyebrow">Patient reported</h3>
              <div className="mt-3 space-y-4">
                {vm.evidence.map((g) => (
                  // `data-cat` resolves the three accent roles in the token
                  // layer. The component names a CATEGORY, never a colour, so
                  // the palette stays owned by one file.
                  <div key={g.key} data-cat={g.key} className="hd-cat">
                    <p className="hd-cat-title">{g.category}</p>
                    <dl className="mt-2 space-y-1">
                      {g.items.map((item, i) => (
                        <div
                          key={g.category + "-" + item.value + "-" + i}
                          className={
                            item.label
                              ? "grid grid-cols-[5.5rem_1fr] gap-3 leading-snug"
                              : "flex gap-2 leading-snug"
                          }
                        >
                          {item.label ? (
                            <dt className="hd-label">{item.label}</dt>
                          ) : (
                            <dt className="sr-only">{g.category}</dt>
                          )}
                          {!item.label && <span aria-hidden className="hd-bullet" />}
                          <dd
                            className={
                              "hd-value min-w-0" +
                              (item.emphasis === "attention" ? " font-semibold" : "")
                            }
                          >
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(vm.primaryDriverExplanation ||
            vm.interpretations.length > 0 ||
            vm.drivers.length > 0 ||
            vm.clinicalObjective) && (
            <div className="min-w-0 p-5 sm:p-6">
              <h3 className="hd-eyebrow">What it means</h3>

              {/* The leading driver, explained. Its LABEL is the headline and
                  is not repeated — but what it does to the follicle is not a
                  repeat, and on a single-driver case dropping it left this
                  panel as a heading above a bare objective line. */}
              {vm.primaryDriverExplanation && (
                <div className="mt-3">
                  <p className="hd-value text-[12px] font-semibold">Primary driver</p>
                  <p className="hd-label mt-1 leading-relaxed">
                    {vm.primaryDriverExplanation}
                  </p>
                </div>
              )}

              {/* The same content, in the same order, as the "Clinical Summary
                  & Interpretation" page of the patient's own report. Presented
                  as the report presents it — signal, pattern, meaning — so a
                  doctor comparing the two never has to translate between
                  them. */}
              {vm.interpretations.length > 0 && (
                <div className="mt-4">
                  <p className="hd-value text-[12px] font-semibold">
                    Signals and what they indicate
                  </p>
                  <ul className="mt-2 space-y-3">
                    {vm.interpretations.map((entry, i) => (
                      <li key={entry.signal + "-" + i}>
                        <p className="hd-value font-medium leading-snug">{entry.signal}</p>
                        {entry.condition && (
                          <p className="hd-condition mt-0.5">{entry.condition}</p>
                        )}
                        <p className="hd-label mt-1 leading-relaxed">
                          {entry.interpretation}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Drivers only when the engine emitted no signal mapping —
                  otherwise the two say the same thing in two shapes. */}
              {vm.interpretations.length === 0 && vm.drivers.length > 0 && (
                <div className="mt-4">
                  <p className="hd-value text-[12px] font-semibold">
                    Contributing driver{vm.drivers.length === 1 ? "" : "s"}
                  </p>
                  <ul className="mt-1.5 space-y-2.5">
                    {vm.drivers.map((d, i) => (
                      <li key={d.label + "-" + i}>
                        <p className="hd-value font-medium leading-snug">{d.label}</p>
                        {d.explanation && (
                          <p className="hd-label mt-0.5 leading-relaxed">{d.explanation}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {vm.clinicalObjective && (
                <div className="hd-divide-t mt-4 pt-3">
                  <p className="hd-value text-[12px] font-semibold">Clinical objective</p>
                  {/* One of only two places green is spent on this page. */}
                  <p className="hd-objective mt-1 leading-relaxed">
                    {vm.clinicalObjective}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {transcriptOpen && (
        <FullAssessmentDialog
          consultation={consultation}
          onClose={() => setTranscriptOpen(false)}
        />
      )}
    </section>
  );
}

/**
 * Severity is the one clinical statement on this page that earns colour on its
 * own. Mild reads as reassurance rather than as absence of information, which
 * a grey pill did not.
 */
function severityPill(level: string): string {
  if (level === "SEVERE") return "hd-pill-critical";
  if (level === "MODERATE") return "hd-pill-attention";
  if (level === "MILD") return "hd-pill-success";
  return "hd-pill-neutral";
}

/**
 * The complete questionnaire, on demand.
 *
 * The ONLY place raw question text appears on the review. It keeps the
 * every-question transcript — unanswered and not-applicable rows included —
 * because when a doctor deliberately opens the full assessment, "we never
 * asked this" and "they declined to answer" are exactly the distinctions they
 * came looking for.
 */
function FullAssessmentDialog({
  consultation,
  onClose,
}: {
  consultation: Consultation;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full assessment"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="hd-card w-full max-w-3xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="hd-value text-base font-semibold">Full assessment</h3>
            <p className="hd-label mt-0.5 text-xs">
              Every question as the patient was asked it, including the ones
              they did not answer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close full assessment"
            className="hd-btn hd-btn-secondary !p-2"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <AssessmentTranscript answers={consultation.assessment.rawAnswers} />
      </div>
    </div>
  );
}
