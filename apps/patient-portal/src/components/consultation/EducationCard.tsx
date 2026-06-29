import type { PatientEducation } from "@shared/types/consultation";
import { CardShell } from "./_shell";

export function EducationCard({ education }: { education: PatientEducation }) {
  const s = education.story;
  return (
    <CardShell eyebrow="Patient education" title="Your hair story">
      <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
        <Section heading="Your hair story" body={s.yourHairStory} />
        <Section heading="What we found" body={s.whyThisMayBeHappening} />
        <Section heading="Your recovery plan" body={s.whyThisPlanWasRecommended} />
        <Section heading="What recovery could look like" body={s.whatToExpect} />
      </div>
    </CardShell>
  );
}

function Section({ heading, body }: { heading: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 mb-1">{heading}</p>
      <p>{body}</p>
    </div>
  );
}
