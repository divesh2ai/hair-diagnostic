"use client";

import { useHydrated } from "@/lib/format/useHydrated";
import { History, ShieldCheck } from "lucide-react";
import type { Consultation } from "@shared/types/consultation";
import {
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

  // Newest first — the last thing that happened is the thing being asked about.
  const auditEvents = [...(consultation.audit?.events ?? [])].reverse();

  return (
    <section aria-labelledby="detail-heading" className="space-y-6">
      {/* No inner tab bar.
          This whole component is now the CONTENT of one outer tab, and tabs
          inside tabs is the nesting that makes a doctor hunt for where a thing
          lives. Recovery and record simply stack. */}
      <div className="space-y-6">
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
      </div>

      <div className="hd-divide-t space-y-6 pt-6">
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
