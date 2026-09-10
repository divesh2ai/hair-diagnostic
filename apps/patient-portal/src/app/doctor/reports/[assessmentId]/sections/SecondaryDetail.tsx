"use client";

import type { Consultation } from "@shared/types/consultation";
import {
  SafetyCard,
  LifestyleCard,
  TimelineCard,
  FollowUpCard,
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
// What remains is genuinely secondary — recovery milestones, diet & lifestyle,
// the follow-up plan and the safety disclosures. A doctor should be able to
// approve without ever opening this.
//
// ── Three things were removed from this tab, and why ───────────────────────
// TOPICALS EXCLUDED  was a second rendering of `treatmentPlan.topicalCautions`,
//   the exact list SafetyCard already prints under "Topicals to avoid". The
//   same caution appeared twice on one screen, word for word. Removed here
//   rather than in SafetyCard, because a caution belongs with the safety
//   disclosures, not in a block of its own further down.
// PATIENT EDUCATION  archived, not deleted: EducationCard and the
//   `patientEducation` payload that feeds it are untouched and still consumed
//   by the patient report. It is expected back when the video narrative work
//   starts; until then it was long prose a reviewing doctor scrolled past.
// VERSION HISTORY    the header already states the version, so this block
//   restated it and then listed audit events nobody reviews mid-consultation.
//   The audit trail itself is unaffected — it is still written and still
//   queryable; this only stops rendering it here.


export interface SecondaryDetailProps {
  consultation: Consultation;
}

// `contentVersion` was dropped with the version-history block: the review
// header already states the version, so nothing in this tab needs it.
export function SecondaryDetail({ consultation }: SecondaryDetailProps) {
  return (
    <section aria-labelledby="detail-heading" className="space-y-6">
      {/* No inner tab bar.
          This whole component is now the CONTENT of one outer tab, and tabs
          inside tabs is the nesting that makes a doctor hunt for where a thing
          lives. Recovery and record simply stack. */}
      {/* No DetailBlock wrapper any more.
          Every card below is a CardShell, which renders its own eyebrow and
          its own <h3>. Wrapping each one in a second heading printed the title
          twice — "Diet & lifestyle" above a card headed "Diet & lifestyle",
          and the same for the safety disclosures. The cards title themselves. */}
      <div className="space-y-6">
        {consultation.treatmentPlan.expectedTimeline.length > 0 && (
          <TimelineCard
            milestones={consultation.treatmentPlan.expectedTimeline}
          />
        )}

        <LifestyleCard
          general={consultation.patientEducation.generalLifestyle}
          conditionMapped={consultation.patientEducation.conditionLifestyle}
        />

        {consultation.followUp && <FollowUpCard followUp={consultation.followUp} />}
      </div>

      <div className="hd-divide-t space-y-6 pt-6">
        <SafetyCard consultation={consultation} />
      </div>
    </section>
  );
}
