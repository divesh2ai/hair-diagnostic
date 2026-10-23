"use client";

import { useEffect, useState } from "react";

// Read-only treatment/purchase history for the patient profile, across visits.
// Lets a doctor open a patient and see what was actually obtained, when
// treatment started, and which kits remain — without opening each review
// screen. It never writes; recording happens on the review screen's tracker.

type LineStatus =
  | "RECOMMENDED"
  | "PARTIALLY_PURCHASED"
  | "PURCHASED"
  | "DEFERRED"
  | "DECLINED"
  | "SUBSTITUTED"
  | "DISCONTINUED";

interface Derived {
  recommendedBoxes: number;
  purchasedBoxes: number;
  remainingBoxes: number;
  treatmentStarted: boolean;
  treatmentStartedAt: string | null;
  status: LineStatus;
}
interface LineView {
  kitId: string;
  kitLabel: string;
  recommendedBoxes: number;
  lineStatus: LineStatus;
  controlReason: string | null;
  derived: Derived;
}
interface Summary {
  recommendedKits: number;
  purchasedKits: number;
  deferredKits: number;
  declinedKits: number;
  remainingKits: number;
  recommendedBoxes: number;
  purchasedBoxes: number;
  remainingBoxes: number;
}
interface VisitHistory {
  assessmentId: string;
  summary: Summary;
  lines: LineView[];
}

const STATUS_LABEL: Record<LineStatus, string> = {
  RECOMMENDED: "Recommended",
  PARTIALLY_PURCHASED: "Partly purchased",
  PURCHASED: "Purchased",
  DEFERRED: "Deferred",
  DECLINED: "Declined",
  SUBSTITUTED: "Substituted",
  DISCONTINUED: "Discontinued",
};

export function PatientTreatmentHistory({
  patientId,
  assessmentDates = {},
}: {
  patientId: string;
  assessmentDates?: Record<string, string | null>;
}) {
  const [overall, setOverall] = useState<Summary | null>(null);
  const [visits, setVisits] = useState<VisitHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/doctor/patients/${patientId}/treatment-history`);
        if (!active) return;
        if (res.status === 503) {
          setUnavailable(true);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { overall: Summary; assessments: VisitHistory[] };
        setOverall(data.overall);
        setVisits(data.assessments);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [patientId]);

  if (unavailable) return null; // Quietly absent until the migration is applied.

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
      <h3 className="font-semibold text-slate-800">Treatment &amp; purchases</h3>
      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : !overall || overall.recommendedKits === 0 ? (
        <p className="text-xs text-slate-400">No recorded kit purchases yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            <span><strong className="text-slate-900">{overall.purchasedKits}/{overall.recommendedKits}</strong> kits purchased</span>
            <span><strong className="text-slate-900">{overall.purchasedBoxes}/{overall.recommendedBoxes}</strong> boxes</span>
            <span>{overall.remainingKits} remaining · {overall.deferredKits} deferred · {overall.declinedKits} declined</span>
          </div>
          <ul className="space-y-4">
            {visits.map((v) => {
              const date = assessmentDates[v.assessmentId];
              return (
                <li key={v.assessmentId} className="border-t border-stone-100 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                    Visit {date ? new Date(date).toLocaleDateString() : ""}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {v.lines.map((l) => (
                      <li key={l.kitId} className="text-xs text-slate-700">
                        <span className="font-medium">{l.kitLabel}</span> — {l.derived.purchasedBoxes}/{l.recommendedBoxes} boxes ·{" "}
                        {STATUS_LABEL[l.derived.status]}
                        {l.derived.remainingBoxes > 0 && l.derived.status !== "DECLINED" && (
                          <span className="text-slate-500"> · {l.derived.remainingBoxes} remaining</span>
                        )}
                        {l.derived.treatmentStarted && l.derived.treatmentStartedAt && (
                          <span className="text-emerald-700"> · started {new Date(l.derived.treatmentStartedAt).toLocaleDateString()}</span>
                        )}
                        {l.controlReason && <span className="text-stone-400"> · {l.controlReason}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
