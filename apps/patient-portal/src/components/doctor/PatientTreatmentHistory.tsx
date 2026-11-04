"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EVENT_LABEL, type PurchaseEvent } from "./purchaseLedger";

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
  dispensedBoxes: number;
  patientReportedBoxes: number;
  externallyObtainedBoxes:number;
  recommendedBoxes: number;
  purchasedBoxes: number;
  remainingBoxes: number;
  treatmentStarted: boolean;
  treatmentStartedAt: string | null;
  status: LineStatus;
}
interface LineView {
  events: PurchaseEvent[];
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
  intentId:string;
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
  const [error, setError] = useState(false);
  const [ledgerAvailable, setLedgerAvailable] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setUnavailable(false);
    setOverall(null);
    setVisits([]);
    (async () => {
      try {
        const res = await fetch(`/api/doctor/patients/${patientId}/treatment-history`);
        if (!active) return;
        if (res.status === 503) {
          setUnavailable(true);
          return;
        }
        if (!res.ok) throw new Error("history_unavailable");
        const data = (await res.json()) as { overall: Summary; assessments: VisitHistory[]; ledgerAvailable?: boolean };
        if (!active) return;
        setLedgerAvailable(data.ledgerAvailable !== false);
        setOverall(data.overall);
        setVisits(data.assessments);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [patientId, attempt]);

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
      <h3 className="font-semibold text-slate-800">Previous consultation / treatment history</h3>
      {error || unavailable ? (
        <div role="alert" className="text-sm text-rose-700">
          <p>Treatment history could not be loaded. Purchase status is unknown.</p>
          <button type="button" className="min-h-11 underline" onClick={() => setAttempt((n) => n + 1)}>Retry history</button>
        </div>
      ) : loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : !overall || overall.recommendedKits === 0 ? (
        <p className="text-xs text-slate-400">No recorded kit purchases yet.</p>
      ) : (
        <>
          {!ledgerAvailable && <p role="status" className="text-sm text-amber-800">Recommendations are available. The purchase ledger is not enabled; purchase and dispensing status are unverified.</p>}
          {ledgerAvailable && <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            <span><strong className="text-slate-900">{overall.purchasedKits}/{overall.recommendedKits}</strong> kits purchased</span>
            <span><strong className="text-slate-900">{overall.purchasedBoxes}/{overall.recommendedBoxes}</strong> boxes</span>
            <span>{overall.remainingKits} remaining · {overall.deferredKits} deferred · {overall.declinedKits} declined</span>
          </div>}
          <ul className="space-y-4">
            {visits.map((v) => {
              const date = assessmentDates[v.assessmentId];
              return (
                <li key={v.intentId} className="border-t border-stone-100 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                    Visit {date ? new Date(date).toLocaleDateString() : ""}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {v.lines.map((l) => (
                      <li key={l.kitId} className="text-xs text-slate-700">
                        <span className="font-medium">{l.kitLabel}</span> — {l.recommendedBoxes} boxes recommended
                        {ledgerAvailable && <span> · {l.derived.purchasedBoxes} clinic confirmed · {STATUS_LABEL[l.derived.status]}</span>}
                        {ledgerAvailable && l.derived.remainingBoxes > 0 && !["DECLINED","SUBSTITUTED","DISCONTINUED"].includes(l.derived.status) && (
                          <span className="text-slate-500"> · {l.derived.remainingBoxes} remaining</span>
                        )}
                        {l.derived.treatmentStarted && l.derived.treatmentStartedAt && (
                          <span className="text-emerald-700"> · started {new Date(l.derived.treatmentStartedAt).toLocaleDateString()}</span>
                        )}
                        {l.derived.externallyObtainedBoxes>0 && <span> · externally obtained {l.derived.externallyObtainedBoxes} (no clinic charge)</span>}
                        {ledgerAvailable && <span> · patient reported {l.derived.patientReportedBoxes} · dispensed {l.derived.dispensedBoxes}</span>}
                        {l.controlReason && <span className="text-stone-400"> · {l.controlReason}</span>}
                        {l.events?.length > 0 && (
                          <ul className="ml-3 mt-1 space-y-1 border-l pl-3">
                            {l.events.map((event) => <li key={event.id}>{new Date(event.occurredAt).toLocaleString()} · {EVENT_LABEL[event.eventType]}{event.boxes != null ? ` · ${event.boxes} boxes` : ""}{event.note ? ` · ${event.note}` : ""}</li>)}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                  {/*
                    The dashboard history is read-only, but the doctor must be able
                    to act on it in one step at the next visit — continue, revise or
                    discontinue the kits that are still open or deferred. Recording
                    lives on the review screen's KitPurchaseTracker, so this is the
                    direct route to it, shown only when there is something to act on
                    (an open or deferred kit). A min 44px touch target keeps it usable
                    on a phone at the chairside.
                  */}
                  {(v.summary.remainingKits > 0 || v.summary.deferredKits > 0) && (
                    <Link
                      href={`/doctor/reports/${v.assessmentId}`}
                      className="mt-2 inline-flex min-h-[44px] items-center text-xs font-medium text-sky-600 hover:text-sky-700"
                    >
                      Continue, revise or discontinue remaining kits →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
