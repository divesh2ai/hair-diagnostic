import type { UniversalRecoveryMilestone } from "../../../../../src/packages/ai-engine/report-engine/types";
import { CardShell } from "./_shell";

export function TimelineCard({ milestones }: { milestones: UniversalRecoveryMilestone[] }) {
  return (
    <CardShell eyebrow="Outlook" title="Expected timeline">
      <ol className="relative border-l border-stone-200 ml-2">
        {milestones.map((m, idx) => (
          <li key={`${m.window}-${idx}`} className="ml-4 pb-4 last:pb-0">
            <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-teal-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{m.window}</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {m.bullets.map((b, i) => (
                <li key={i}>· {b}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}
