"use client";

import { useMemo, useState } from "react";
import { CircleSlash, MinusCircle, AlertCircle } from "lucide-react";
import {
  buildAssessmentTranscript,
  type TranscriptRow,
  type TranscriptSection,
} from "@/lib/doctor/assessmentTranscript";

// THE PATIENT'S OWN WORDS — the questionnaire, read back as it was asked.
//
// This replaced a raw `Object.entries(rawAnswers)` dump. The rationale for
// every rule below lives in lib/doctor/assessmentTranscript.ts; what this file
// owns is only how the transcript reads.
//
// ── Two presentation rules ──────────────────────────────────────────────────
//
//  1. A row with no answer says WHY in words. "Not reported", "Not asked" and
//     "No answer recorded" are three different clinical facts and each gets its
//     own sentence and its own icon. The one thing this component may never do
//     is render a label with empty space beside it, which is what it used to
//     do for eight rows out of eighteen.
//
//  2. Multi-selects are stacked, never comma-joined. The option text itself
//     contains commas, slashes and plus signs — "Dandruff + Itching + White
//     flakes", "Alcohol (8–10×/month)" — so joining them produces a sentence
//     in which the boundary between two clinical findings is invisible.

export interface AssessmentTranscriptProps {
  answers: Record<string, unknown> | null | undefined;
}

export function AssessmentTranscript({ answers }: AssessmentTranscriptProps) {
  const transcript = useMemo(() => buildAssessmentTranscript(answers), [answers]);

  // Default OFF. The complaint that prompted this work was that responses were
  // missing, so the answers a doctor is looking for must not be diluted by ~6
  // rows of "not applicable" until they ask for them.
  const [showSkipped, setShowSkipped] = useState(false);

  const skippedCount = useMemo(
    () =>
      [...transcript.sections.flatMap((s) => s.rows), ...transcript.additional].filter(
        (r) => r.state === "not_applicable",
      ).length,
    [transcript],
  );

  if (transcript.asked === 0 && transcript.additional.length === 0) {
    return (
      <p className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        No questionnaire responses were stored for this assessment.
      </p>
    );
  }

  const sections: TranscriptSection[] = showSkipped
    ? transcript.sections
    : transcript.sections
        .map((s) => ({ ...s, rows: s.rows.filter((r) => r.state !== "not_applicable") }))
        .filter((s) => s.rows.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          <span className="font-medium text-slate-700">
            {transcript.answered} of {transcript.asked}
          </span>{" "}
          questions answered
        </p>
        {skippedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowSkipped((v) => !v)}
            aria-pressed={showSkipped}
            className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            {showSkipped ? "Hide" : "Show"} {skippedCount} not applicable
          </button>
        )}
      </div>

      {sections.map((section) => (
        <section key={section.id} aria-label={section.title}>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            {section.title}
          </h4>
          <dl className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {section.rows.map((row) => (
              <TranscriptRowView key={row.id} row={row} />
            ))}
          </dl>
        </section>
      ))}

      {transcript.additional.length > 0 && (
        <section aria-label="Responses outside the current protocol">
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Other stored responses
          </h4>
          <p className="mb-1.5 text-xs text-stone-500">
            Recorded against this patient but not part of the current
            questionnaire — usually an answer from an earlier protocol version.
          </p>
          <dl className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {transcript.additional.map((row) => (
              <TranscriptRowView key={row.id} row={row} />
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

function TranscriptRowView({ row }: { row: TranscriptRow }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[minmax(0,20rem)_1fr] sm:gap-6">
      {/* The question, in the patient's reading — quiet, because the doctor is
          scanning the answers, not re-reading the questionnaire. */}
      <dt className="text-sm leading-snug text-stone-500">{row.label}</dt>
      <dd className="min-w-0">
        <AnswerView row={row} />
      </dd>
    </div>
  );
}

function AnswerView({ row }: { row: TranscriptRow }) {
  if (row.state === "none_reported") {
    return (
      <EmptyAnswer
        icon={<MinusCircle className="h-3.5 w-3.5" aria-hidden />}
        // The patient saw this question and selected nothing. That is a
        // clinical negative and reads as one.
        text="Nothing reported"
      />
    );
  }

  if (row.state === "not_applicable") {
    return (
      <EmptyAnswer
        icon={<CircleSlash className="h-3.5 w-3.5" aria-hidden />}
        text={row.notApplicableReason ?? "Not asked — did not apply to this patient"}
      />
    );
  }

  if (row.state === "unanswered") {
    return (
      // Amber, unlike the other two: this is the only one of the three that is
      // a gap in the record rather than a fact about the patient.
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        No answer recorded
      </span>
    );
  }

  if (row.freeText) {
    return (
      <p className="font-serif text-[15px] leading-relaxed text-slate-900">
        {row.freeText}
      </p>
    );
  }

  if (row.values.length === 1) {
    return (
      <p className="font-serif text-[15px] leading-relaxed text-slate-900">
        {row.values[0]}
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {row.values.map((value, i) => (
        <li
          key={`${value}-${i}`}
          className="flex gap-2 font-serif text-[15px] leading-relaxed text-slate-900"
        >
          <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-stone-400" />
          <span className="min-w-0">{value}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyAnswer({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-stone-400">
      {icon}
      {text}
    </span>
  );
}
