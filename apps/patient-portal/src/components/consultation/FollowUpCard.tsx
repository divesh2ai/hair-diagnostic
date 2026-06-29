import type { FollowUpPlan } from "@shared/types/consultation";
import { CardShell, KeyValue } from "./_shell";

export function FollowUpCard({ followUp }: { followUp: FollowUpPlan }) {
  return (
    <CardShell eyebrow="Follow-up" title={`In ${followUp.cadence}`}>
      <ul className="space-y-1.5">
        {followUp.reviewChecks.map((c, idx) => (
          <li key={idx} className="text-sm text-slate-700">· {c}</li>
        ))}
      </ul>
      {followUp.nextAppointmentAt && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <KeyValue
            label="Next appointment"
            value={new Date(followUp.nextAppointmentAt).toLocaleString()}
          />
        </div>
      )}
    </CardShell>
  );
}
