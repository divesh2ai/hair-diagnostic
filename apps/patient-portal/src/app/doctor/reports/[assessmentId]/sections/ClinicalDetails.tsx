"use client";

import { Flag } from "lucide-react";
import type { Consultation, DoctorNote } from "@shared/types/consultation";
import {
  SafetyCard,
  LifestyleCard,
  TimelineCard,
  FollowUpCard,
} from "@/components/consultation";
import { PatientTreatmentHistory } from "@/components/doctor/PatientTreatmentHistory";
import { useHydrated } from "@/lib/format/useHydrated";
import { OnePagerBlock } from "./OnePagerBlock";

// CLINICAL DETAILS — the reference material a doctor can approve without, moved
// beneath the clinical order so the decision area stays uncluttered.
//
// ── What is here, and what is NOT ──────────────────────────────────────────
// Genuinely secondary context lives here: the follow-up plan and the patient's
// previous treatment, recovery milestones, diet & lifestyle, the safety
// disclosures, the report snapshot and the decision/approval record.
//
// Critically, this is NOT where safety-critical alerts live. Contraindications,
// cautions, allergy flags, missing critical inputs and unresolved safety blocks
// stay in ClinicalAttentionSection, rendered immediately beside the decision —
// this component only carries the routine disclosures a patient receives, and
// those sit behind an expansion. Nothing here changes clinical scoring, the
// safety rules, or approval restrictions.
//
// The follow-up and previous-treatment summary stay open (a doctor plans the
// next visit from them); the bulkier recovery/lifestyle, the full disclosures
// and the report snapshot are collapsed by default to keep scrolling down.

function DetailDisclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-[color:var(--hd-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hd-primary)]">
        {summary}
        <span className="text-[color:var(--hd-text-muted)] transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="space-y-6 border-t border-[color:var(--hd-border)] px-4 py-4">
        {children}
      </div>
    </details>
  );
}

export interface ClinicalDetailsProps {
  consultation: Consultation;
  assessmentId: string;
  patientId: string;
  /** Open the structured recommendation-feedback drawer. */
  onFlagIssue: () => void;
}

export function ClinicalDetails({
  consultation,
  assessmentId,
  patientId,
  onFlagIssue,
}: ClinicalDetailsProps) {
  const hydrated = useHydrated();
  const decisionNotes: DoctorNote[] = consultation.doctorNotes ?? [];
  const hasTimeline = consultation.treatmentPlan.expectedTimeline.length > 0;

  return (
    <section
      aria-labelledby="clinical-details-heading"
      className="space-y-3 border-t border-[color:var(--hd-border)] pt-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="clinical-details-heading" className="hd-story-title">
          Clinical details
        </h2>
        <p className="text-xs text-[color:var(--hd-text-muted)]">
          Follow-up, disclosures and the supporting record
        </p>
      </div>

      {/* Follow-up + previous treatment — kept open: the doctor plans the next
          visit from the recommended interval, the plan and what was obtained. */}
      {consultation.followUp && <FollowUpCard followUp={consultation.followUp} />}
      <PatientTreatmentHistory patientId={patientId} />

      {hasTimeline || consultation.patientEducation ? (
        <DetailDisclosure summary="Recovery timeline & lifestyle">
          {hasTimeline && (
            <TimelineCard milestones={consultation.treatmentPlan.expectedTimeline} />
          )}
          <LifestyleCard
            general={consultation.patientEducation.generalLifestyle}
            conditionMapped={consultation.patientEducation.conditionLifestyle}
          />
        </DetailDisclosure>
      ) : null}

      {/* Safety & disclosures — the routine patient disclosures, behind an
          expansion. Safety-critical alerts are NOT here; they stay in Clinical
          attention beside the decision. */}
      <DetailDisclosure summary="Safety & disclosures">
        <SafetyCard consultation={consultation} />
      </DetailDisclosure>

      <DetailDisclosure summary="Report snapshot & record">
        <OnePagerBlock assessmentId={assessmentId} />
        {decisionNotes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--hd-text-muted)]">
              Decision &amp; approval record
            </h3>
            <ul className="space-y-2">
              {decisionNotes.map((n) => (
                <li key={n.id} className="text-xs text-[color:var(--hd-text-secondary)]">
                  <p className="max-w-prose whitespace-pre-wrap">{n.body}</p>
                  <p className="text-[10px] text-[color:var(--hd-text-muted)]">
                    {hydrated ? new Date(n.createdAt).toLocaleString() : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DetailDisclosure>

      <div>
        <button
          type="button"
          onClick={onFlagIssue}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--hd-border-strong)] bg-[color:var(--hd-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--hd-text-secondary)] hover:bg-[color:var(--hd-surface-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hd-primary)]"
        >
          <Flag className="h-3.5 w-3.5" aria-hidden />
          Flag recommendation issue
        </button>
      </div>
    </section>
  );
}
