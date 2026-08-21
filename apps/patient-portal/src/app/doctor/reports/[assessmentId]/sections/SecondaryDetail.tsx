"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/format/useHydrated";
import { History, ShieldCheck } from "lucide-react";
import type { Consultation } from "@shared/types/consultation";
import {
  ClinicalEvidenceCard,
  ClinicalFindingsCard,
  RootCauseCard,
  RiskFactorsCard,
  SafetyCard,
  LifestyleCard,
  TimelineCard,
  FollowUpCard,
  EducationCard,
} from "@/components/consultation";

// MORE CLINICAL DETAIL — reference material, deliberately demoted.
//
// ── What is NOT here any more ──────────────────────────────────────────────
// The kit lineup, the lineup editor, the plan rationale and the topical shelf
// used to live in a "Product recommendation protocol" tab, which meant the
// answer to "what am I approving" was one click away from the page that
// approved it. All of that now sits in ProtocolSection, above. Nothing in this
// component may restate the diagnosis, the drivers, the primary rationale or
// the treatment plan: a fact shown in two places is a fact that can disagree
// with itself after an edit.
//
// What remains is genuinely secondary — the full questionnaire, the long-tail
// evidence, recovery and lifestyle guidance, disclosures, and the audit trail.
// A doctor should be able to approve without ever opening this.

type DetailTab = "assessment" | "recovery" | "record";

const TABS: { id: DetailTab; label: string }[] = [
  { id: "assessment", label: "Assessment & evidence" },
  { id: "recovery", label: "Recovery & lifestyle" },
  { id: "record", label: "Record history" },
];

export interface SecondaryDetailProps {
  consultation: Consultation;
  contentVersion: number;
}

export function SecondaryDetail({
  consultation,
  contentVersion,
}: SecondaryDetailProps) {
  // Audit timestamps are locale-formatted; same rule as ReviewHeader.
  const hydrated = useHydrated();
  const [tab, setTab] = useState<DetailTab>("assessment");

  // Newest first — the last thing that happened is the thing being asked about.
  const auditEvents = [...(consultation.audit?.events ?? [])].reverse();

  return (
    <section aria-labelledby="detail-heading" className="space-y-4">
      <h2
        id="detail-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
      >
        More clinical detail
      </h2>

      <div role="tablist" aria-label="Secondary clinical detail" className="flex flex-wrap gap-1 border-b border-stone-200">
        {TABS.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`detail-tab-${id}`}
              aria-selected={active}
              aria-controls={`detail-panel-${id}`}
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 ${
                active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-stone-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`detail-panel-${tab}`}
        aria-labelledby={`detail-tab-${tab}`}
        className="space-y-6"
      >
        {tab === "assessment" && (
          <>
            {/* "Assessment responses" is no longer here. The raw
                Object.entries dump of every question — blank rows for empty
                multi-selects included — was the original defect. Selections
                now sit in ClinicalSummarySection, and the complete
                questionnaire is behind "View full assessment". */}
            {consultation.clinicalFindings.length > 0 && (
              <DetailBlock title="Signal interpretation">
                <ClinicalFindingsCard findings={consultation.clinicalFindings} />
              </DetailBlock>
            )}

            <DetailBlock title="Root cause detail">
              <div className="space-y-4">
                <RootCauseCard rootCause={consultation.rootCause} />
                <RiskFactorsCard rootCause={consultation.rootCause} />
              </div>
            </DetailBlock>

            <DetailBlock title="Evidence catalogue">
              <ClinicalEvidenceCard evidence={consultation.evidence} />
            </DetailBlock>
          </>
        )}

        {tab === "recovery" && (
          <>
            {consultation.treatmentPlan.expectedTimeline.length > 0 && (
              <DetailBlock title="Recovery milestones">
                <TimelineCard
                  milestones={consultation.treatmentPlan.expectedTimeline}
                />
              </DetailBlock>
            )}

            <DetailBlock title="Diet & lifestyle">
              <LifestyleCard
                general={consultation.patientEducation.generalLifestyle}
                conditionMapped={consultation.patientEducation.conditionLifestyle}
              />
            </DetailBlock>

            <DetailBlock title="Patient education">
              <EducationCard education={consultation.patientEducation} />
            </DetailBlock>

            {consultation.followUp && (
              <DetailBlock title="Follow-up plan">
                <FollowUpCard followUp={consultation.followUp} />
              </DetailBlock>
            )}
          </>
        )}

        {tab === "record" && (
          <>
            <DetailBlock title="Safety & disclosures">
              <SafetyCard consultation={consultation} />
            </DetailBlock>

            {consultation.treatmentPlan.topicalCautions?.length > 0 && (
              <DetailBlock title="Topicals excluded for this patient">
                <ul className="space-y-1.5 rounded-xl border border-stone-200 bg-white p-4 text-sm text-slate-700">
                  {consultation.treatmentPlan.topicalCautions.map((c, i) => (
                    <li key={`${c.name}-${i}`}>
                      <span className="font-medium text-slate-900">{c.name}</span>
                      {c.reason ? ` — ${c.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </DetailBlock>
            )}

            <DetailBlock title="Version history">
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="mb-3 flex items-center gap-1.5 text-xs text-stone-500">
                  <History className="h-3.5 w-3.5" aria-hidden />
                  Current version {contentVersion}
                </p>
                {auditEvents.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    No recorded changes for this consultation.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {auditEvents.map((ev, i) => (
                      <li
                        key={`${ev.at}-${i}`}
                        className="flex items-start gap-2 text-xs text-slate-700"
                      >
                        <ShieldCheck
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400"
                          aria-hidden
                        />
                        <div>
                          <p className="font-medium capitalize">
                            {ev.kind.toLowerCase()}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            {hydrated ? new Date(ev.at).toLocaleString() : null}
                            {ev.note ? ` · ${ev.note}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </DetailBlock>
          </>
        )}
      </div>
    </section>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <h3 className="font-serif text-base text-slate-900">{title}</h3>
      {children}
    </div>
  );
}
