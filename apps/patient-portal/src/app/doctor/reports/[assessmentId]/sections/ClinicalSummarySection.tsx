"use client";

import { useState } from "react";
import { ClipboardList, X, Activity } from "lucide-react";
import type { Consultation } from "@shared/types/consultation";
import { buildClinicalSummary } from "@/lib/doctor/clinicalSummary";
import { buildMergedGroups, type MergedGroup } from "@/lib/doctor/clinicalSignals";
import { SymptomIcon } from "@/lib/doctor/symptomIcons";
import { CollapsibleText } from "./CollapsibleText";
import { AssessmentTranscript } from "./AssessmentTranscript";

// STEP 1 — THE CASE. The hero, and the only thing a doctor must read.
//
// ── What replaced what ──────────────────────────────────────────────────────
// This once showed two side-by-side panels: "Patient reported" (the raw
// selections) and "What it means" (the engine's signal → pattern → meaning).
// They were the SAME signals rendered twice, forcing the doctor to read a
// selection on the left and hunt for its interpretation on the right.
//
// They are now CLUBBED into one flow. Each reported signal is joined to its own
// interpretation and shown once — a category-coloured icon, the selection, the
// clinical pattern it maps to, and what it means — grouped by clinical category.
// The join and the orphan-handling live in lib/doctor/clinicalSignals (pure,
// tested). Interpretations the engine flagged for a factor with no matching
// selection are NOT dropped: they surface in an explicit "Additional clinical
// signals" group so a broken/renamed signal is visible, never a silent gap.
//
// The clinical reading hierarchy is fixed:
//   VERDICT          severity + headline + synthesis        (authored)
//   PRIMARY DRIVER   the leading driver, called out
//   SIGNALS & WHAT   signal → pattern → meaning, per finding, with an icon
//   THEY MEAN
// Kit / recommendation reasoning follows in the next section of the page.
//
// ── The one rule still holds ────────────────────────────────────────────────
// Presentation may be transformed; clinical meaning may not. Every string is
// copied from the engine's own output; the icon is chosen from the signal text
// and the colour from the category token — neither invents a clinical claim.

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

  const groups = buildMergedGroups(vm);

  return (
    <section aria-labelledby="summary-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="summary-heading" className="hd-story-title">
          The case
        </h2>
        <button
          type="button"
          onClick={() => setTranscriptOpen(true)}
          className="hd-btn hd-btn-secondary !px-3 !py-1.5 !text-xs"
        >
          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
          View full assessment
        </button>
      </div>

      <div className="hd-card overflow-hidden">
        {/* CLINICAL CONCLUSION — the decision snapshot. Everything here is
            source-backed: the headline is the engine's primary diagnosis, the
            driver comes from the engine's story, severity from diagnosis,
            confidence from the payload band
            (no %), synthesis from finalClinicalAssessment, goal from the
            patient summary. No new medical wording is authored. */}
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

          {/* Primary driver — the leading driver, promoted into the conclusion.
              The headline above is the DIAGNOSIS, so the driver's own label is
              shown here; without it the mechanism is unnamed. Subtle purple
              accent, no coloured box. */}
          {vm.primaryDriver && (
            <div className="mt-3 flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "var(--hd-primary-tint)", color: "var(--hd-primary-dark)" }}
              >
                <Activity className="size-4" />
              </span>
              <p className="min-w-0 text-[13px] leading-relaxed text-[color:var(--hd-text)]">
                <span className="font-semibold">
                  Primary driver · {vm.primaryDriver.label}
                </span>
                {vm.primaryDriver.explanation && (
                  <> — {vm.primaryDriver.explanation}</>
                )}
              </p>
            </div>
          )}

          {vm.synthesis && <p className="hd-body mt-3">{vm.synthesis}</p>}

          {vm.patientGoals.length > 0 && (
            <p className="hd-label mt-4">
              <span className="hd-value font-semibold">Patient goal · </span>
              {vm.patientGoals.join(" · ")}
            </p>
          )}
        </div>

        {/* The recommended treatment is no longer glanced here: on the V3
            workspace the full plan reads immediately below this section in the
            same column, and the rail carries the checklist — a third copy would
            be duplicate information. This section stays the case: what they
            reported, and what it means. */}

        {/* FINDINGS — the clubbed signal → pattern → meaning flow. */}
        <div className="hd-divide-t space-y-5 p-5 sm:p-6">
          {groups.length > 0 && (
            <div>
              <h3 className="hd-eyebrow">Signals &amp; what they mean</h3>
              {/* Natural-height flow, not a fixed grid: categories are unequal
                  (Hair is long, Scalp is often one line), so a two-column grid
                  would stretch a short group to a tall one's height and leave a
                  gap. CSS columns let each group take its own height and pack
                  without holes. Each group is kept whole with break-inside. */}
              <div className="mt-3 gap-x-8 lg:columns-2">
                {groups.map((g) => (
                  <div key={g.key} className="mb-5 break-inside-avoid">
                    <SignalGroupBlock group={g} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drivers only when the engine emitted no signal mapping — otherwise
              the two say the same thing in two shapes. */}
          {vm.interpretations.length === 0 && vm.drivers.length > 0 && (
            <div>
              <h3 className="hd-eyebrow">
                Contributing driver{vm.drivers.length === 1 ? "" : "s"}
              </h3>
              <ul className="mt-2 space-y-2.5">
                {vm.drivers.map((d, i) => (
                  <li key={d.label + "-" + i}>
                    <p className="hd-value text-[13px] font-medium leading-snug">
                      {d.label}
                    </p>
                    {d.explanation && (
                      <p className="hd-label mt-0.5 text-[12px] leading-relaxed">
                        {d.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
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
 * One clinical category, rendered light: a thin category-coloured rail, the
 * category title, then each reported signal on its own row — glyph, the
 * selection, the clinical pattern it maps to, and the meaning. No card, no
 * shadow; `data-cat` resolves the colour role in the token layer, so this names
 * a category and never a colour.
 */
function SignalGroupBlock({ group }: { group: MergedGroup }) {
  return (
    <div
      data-cat={group.key}
      className="pl-3.5"
      style={{ borderLeft: "2px solid var(--cat-edge)" }}
    >
      <div className="flex items-center gap-2">
        {/* Empty value → the category's own fallback glyph. */}
        <SymptomIcon value="" category={group.key} size="sm" />
        <p className="hd-cat-title !m-0">{group.category}</p>
      </div>

      <ul className="mt-2.5 space-y-2.5">
        {group.signals.map((s) => (
          <li key={s.id} className="flex gap-2.5">
            <SymptomIcon value={s.value} category={group.key} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="hd-value text-[13px] leading-snug">
                {s.label && (
                  <span className="hd-label mr-1 font-normal">{s.label}:</span>
                )}
                <span className={s.interpreted ? "font-semibold" : "font-medium"}>
                  {s.value}
                </span>
                {s.condition && (
                  <span className="hd-condition ml-2 align-middle">
                    {s.condition}
                  </span>
                )}
              </p>
              {s.interpretation && (
                <CollapsibleText text={s.interpretation} moreLabel="full explanation" />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Severity is the one clinical statement on this page that earns colour on its
 * own. Mild reads as reassurance rather than as absence of information.
 */
function severityPill(level: string): string {
  if (level === "SEVERE") return "hd-pill-critical";
  if (level === "MODERATE") return "hd-pill-attention";
  if (level === "MILD") return "hd-pill-success";
  return "hd-pill-neutral";
}

/**
 * The complete questionnaire, on demand — the ONLY place raw question text
 * appears on the review. It keeps unanswered and not-applicable rows because
 * when a doctor deliberately opens the full assessment, "we never asked this"
 * and "they declined to answer" are exactly the distinctions they came for.
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
              Every question as the patient was asked it, including the ones they
              did not answer.
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
