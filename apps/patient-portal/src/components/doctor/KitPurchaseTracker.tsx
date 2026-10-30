"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PartialKitCheckout } from "./PartialKitCheckout";

// Partial-kit purchase tracker, shown beneath the approved treatment plan.
//
// Reads the server-derived purchase state for an order and lets the doctor
// record what the patient actually did — immediately, and reviewable later.
// It never mutates the approved plan: recording a purchase is a separate,
// dated fact. Unpurchased kits stay visible and are labelled "remaining", never
// as an unpaid invoice.

type LineStatus =
  | "RECOMMENDED"
  | "PARTIALLY_PURCHASED"
  | "PURCHASED"
  | "DEFERRED"
  | "DECLINED"
  | "SUBSTITUTED"
  | "DISCONTINUED";

type EventType =
  | "EXTERNALLY_OBTAINED"
  | "CONTINUED"
  | "PURCHASE_REPORTED_BY_PATIENT"
  | "PURCHASE_CONFIRMED_BY_CLINIC"
  | "PAYMENT_RECORDED"
  | "DISPENSED"
  | "TREATMENT_STARTED"
  | "DEFERRED"
  | "DECLINED"
  | "SUBSTITUTED"
  | "DISCONTINUED"
  | "REFUNDED"
  | "RETURNED";

interface PurchaseEvent {
  id: string;
  eventType: EventType;
  boxes: number | null;
  saleValueMinor: number | null;
  occurredAt: string;
  note: string | null;
  transactionId?: string | null;
}

interface Derived {
  externallyObtainedBoxes: number;
  recommendedBoxes: number;
  purchasedBoxes: number;
  dispensedBoxes: number;
  patientReportedBoxes: number;
  remainingBoxes: number;
  treatmentStarted: boolean;
  treatmentStartedAt: string | null;
  status: LineStatus;
}

interface LineView {
  kitId: string;
  lineId: string | null;
  kitLabel: string;
  recommendedBoxes: number;
  lineStatus: LineStatus;
  controlReason: string | null;
  catalogUnitMinor: number | null;
  events: PurchaseEvent[];
  derived: Derived;
}

interface Summary {
  recommendedKits: number;
  purchasedKits: number;
  fullyPurchasedKits: number;
  deferredKits: number;
  declinedKits: number;
  remainingKits: number;
  recommendedBoxes: number;
  purchasedBoxes: number;
  remainingBoxes: number;
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

function statusTone(s: LineStatus): string {
  switch (s) {
    case "PURCHASED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PARTIALLY_PURCHASED":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "DEFERRED":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "DECLINED":
    case "DISCONTINUED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "SUBSTITUTED":
      return "bg-violet-50 text-violet-700 border-violet-200";
    default:
      return "bg-stone-50 text-stone-600 border-stone-200";
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();
const fmtINR = (minor: number | null) =>
  minor == null ? "—" : `₹${(minor / 100).toLocaleString("en-IN")}`;

const EVENT_LABEL: Record<EventType, string> = {
  EXTERNALLY_OBTAINED: "Obtained externally (no clinic charge)",
  CONTINUED: "Recommendation continued",
  PURCHASE_REPORTED_BY_PATIENT: "Patient reported purchase",
  PURCHASE_CONFIRMED_BY_CLINIC: "Clinic confirmed purchase",
  PAYMENT_RECORDED: "Payment recorded",
  DISPENSED: "Dispensed",
  TREATMENT_STARTED: "Treatment started",
  DEFERRED: "Deferred",
  DECLINED: "Declined",
  SUBSTITUTED: "Substituted",
  DISCONTINUED: "Discontinued",
  REFUNDED: "Refunded",
  RETURNED: "Returned",
};

export function KitPurchaseTracker({
  intentId,
  patientId: _patientId,
}: {
  intentId: string;
  patientId?: string;
}) {
  const pendingEvent = useRef<{signature:string;id:string}|null>(null);
  const inFlight = useRef(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lines, setLines] = useState<LineView[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [openKit, setOpenKit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doctor/orders/${intentId}/purchase`);
      if (res.status === 503) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error("Could not load kit history. Refresh to retry.");
      setUnavailable(false);
      const data = (await res.json()) as { summary: Summary; lines: LineView[] };
      setSummary(data.summary);
      setLines(data.lines);
    } catch {
      setError("Could not load kit history. Refresh to retry.");
    } finally {
      setLoading(false);
    }
  }, [intentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const postEvent = useCallback(
    async (
      kitId: string,
      body: {
        eventType: string;
        boxes?: number;
        occurredAt: string;
        reason?: string;
        substituteKitId?: string;
      },
    ) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const signature = JSON.stringify({kitId,...body});
        if (pendingEvent.current?.signature !== signature) pendingEvent.current = {signature,id:crypto.randomUUID()};
        const clientEventId = pendingEvent.current.id;
        const res = await fetch(`/api/doctor/orders/${intentId}/purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kitId, clientEventId, ...body }),
        });
        if (res.status === 403) {
          setError("Recording a sale amount is disabled for this release.");
          return;
        }
        if (res.status === 409) {
          setError("That action was already recorded.");
          return;
        }
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? "Could not record.");
          return;
        }
        pendingEvent.current = null;
        setOpenKit(null);
        await load();
      } catch {
        setError("Connection lost. Retry to safely record the same action.");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [intentId, load],
  );

  if (unavailable) {
    return (
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Kit purchases &amp; treatment</h3>
        <p className="mt-2 text-sm text-slate-500">Purchase tracking is not enabled yet in this environment.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">Kit purchases &amp; treatment</h3>
        <p className="text-sm text-slate-500">
          What the patient actually obtained — recorded separately from the approved plan, which is unchanged.
        </p>
      </div>

      {summary && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          <span><strong className="text-slate-900">{summary.purchasedKits}/{summary.recommendedKits}</strong> kits purchased</span>
          <span><strong className="text-slate-900">{summary.purchasedBoxes}/{summary.recommendedBoxes}</strong> boxes purchased</span>
          <span>{summary.remainingKits} remaining · {summary.deferredKits} deferred · {summary.declinedKits} declined</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {lines.map((line) => (
            <li key={line.kitId} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{line.kitLabel}</p>
                  <p className="text-sm text-slate-500">
                    {line.derived.purchasedBoxes}/{line.recommendedBoxes} boxes · catalog {fmtINR(line.catalogUnitMinor)}/box
                    {line.derived.patientReportedBoxes > 0 && (
                      <> · <span className="text-amber-700">patient-reported {line.derived.patientReportedBoxes} (unconfirmed)</span></>
                    )}
                    {line.derived.externallyObtainedBoxes > 0 && <> · externally obtained {line.derived.externallyObtainedBoxes} (no clinic charge)</>}
                    {line.derived.dispensedBoxes > 0 && <> · dispensed {line.derived.dispensedBoxes}</>}
                    {line.derived.treatmentStarted && line.derived.treatmentStartedAt && (
                      <> · started {fmtDate(line.derived.treatmentStartedAt)}</>
                    )}
                    {line.derived.remainingBoxes > 0 && (
                      <> · <span className="text-slate-600">{line.derived.remainingBoxes} remaining (not yet purchased)</span></>
                    )}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-medium ${statusTone(line.derived.status)}`}>
                  {STATUS_LABEL[line.derived.status]}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" disabled={busy} onClick={() => setOpenKit(openKit === line.kitId ? null : line.kitId)}
                  className="rounded-md border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50 disabled:opacity-50">
                  {openKit === line.kitId ? "Close" : "Record…"}
                </button>
              </div>

              {openKit === line.kitId && (
                <RecordForm
                  kits={lines.map(l=>({id:l.kitId,label:l.kitLabel}))}
                  currentKitId={line.kitId}
                  defaultBoxes={Math.max(1, line.derived.remainingBoxes || line.recommendedBoxes)}
                  busy={busy}
                  onSubmit={(payload) => postEvent(line.kitId, payload)}
                />
              )}

              {line.events.length > 0 && (
                <ul className="mt-2 space-y-1 border-l-2 border-stone-100 pl-3">
                  {[...line.events]
                    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
                    .map((e) => (
                      <li key={e.id} className="text-sm text-slate-600">
                        <span className="text-slate-400">{fmtDate(e.occurredAt)}</span> · {EVENT_LABEL[e.eventType]}
                        {e.boxes != null && <> · {e.boxes} box{e.boxes === 1 ? "" : "es"}</>}
                        {e.saleValueMinor != null && <> · sale {fmtINR(e.saleValueMinor)}</>}
                        {e.transactionId && <span className="break-all"> · transaction {e.transactionId}</span>}
                        {e.note && <> · {e.note}</>}
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {!loading && <PartialKitCheckout endpoint={`/api/doctor/orders/${intentId}/transactions`} doctor quantitiesAreRemaining onChanged={()=>void load()}
        items={lines.map(l=>({kitId:l.kitId,label:l.kitLabel,unitMinor:l.catalogUnitMinor,
          maxBoxes:["DECLINED","DISCONTINUED","SUBSTITUTED"].includes(l.lineStatus)?0:Math.max(0,l.derived.remainingBoxes-(l.derived.externallyObtainedBoxes??0))}))} />}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </section>
  );
}

function RecordForm({
  kits, currentKitId,
  defaultBoxes,
  busy,
  onSubmit,
}: {
  kits: {id:string;label:string}[]; currentKitId:string;
  defaultBoxes: number;
  busy: boolean;
  onSubmit: (payload: { eventType: string; boxes?: number; occurredAt: string; reason?: string; substituteKitId?: string }) => void;
}) {
  const [eventType, setEventType] = useState<EventType>("PURCHASE_CONFIRMED_BY_CLINIC");
  const [boxes, setBoxes] = useState(defaultBoxes);
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [substituteKitId,setSubstituteKitId] = useState("");
  const needsReason = ["CONTINUED","DEFERRED","DECLINED","SUBSTITUTED","DISCONTINUED"].includes(eventType);
  const quantityEvent =
    eventType === "PURCHASE_CONFIRMED_BY_CLINIC" ||
    eventType === "PURCHASE_REPORTED_BY_PATIENT" ||
    eventType === "DISPENSED" || eventType === "EXTERNALLY_OBTAINED" || eventType === "RETURNED";

  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2">
      <label className="text-sm text-slate-600">
        What happened
        <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}
          className="mt-0.5 w-full rounded border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm">
          <option value="PURCHASE_CONFIRMED_BY_CLINIC">Clinic confirmed purchase</option>
          <option value="PURCHASE_REPORTED_BY_PATIENT">Patient reported purchase</option>
          <option value="DISPENSED">Dispensed</option>
          <option value="TREATMENT_STARTED">Treatment started</option>
          <option value="EXTERNALLY_OBTAINED">Obtained externally — no clinic charge</option>
          <option value="RETURNED">Stock returned — no automatic refund</option>
          <option value="CONTINUED">Continue recommendation</option>
          <option value="DEFERRED">Defer recommendation</option>
          <option value="DECLINED">Decline recommendation</option>
          <option value="DISCONTINUED">Discontinue recommendation</option>
          <option value="SUBSTITUTED">Substitute with another approved kit</option>
        </select>
      </label>
      <label className="text-sm text-slate-600">
        Date
        <input type="date" value={occurredAt} max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="mt-0.5 w-full rounded border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm" />
      </label>
      {quantityEvent && (
        <label className="text-sm text-slate-600">
          Boxes
          <input type="number" min={1} value={boxes} onChange={(e) => setBoxes(Math.max(1, Number(e.target.value)))}
            className="mt-0.5 w-full rounded border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm" />
        </label>
      )}
      {eventType === "SUBSTITUTED" && <label className="text-sm text-slate-700 sm:col-span-2">Replacement already on approved plan
        <select value={substituteKitId} onChange={e=>setSubstituteKitId(e.target.value)} className="mt-1 min-h-11 w-full rounded border px-2 text-base">
          <option value="">Select approved replacement</option>{kits.filter(k=>k.id!==currentKitId).map(k=><option key={k.id} value={k.id}>{k.label}</option>)}
        </select><span className="block mt-1">For a different kit or revised recommendation, edit and re-approve the treatment plan first.</span>
      </label>}
      <label className="text-sm text-slate-600 sm:col-span-2">
        {needsReason?"Reason (required)":"Note (optional)"}
        <input value={note} onChange={(e) => setNote(e.target.value)}
          className="mt-0.5 w-full rounded border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm" />
      </label>
      <div className="sm:col-span-2">
        <button type="button" disabled={busy || !occurredAt || (quantityEvent && (!Number.isInteger(boxes) || boxes < 1)) || (needsReason && !note.trim()) || (eventType === "SUBSTITUTED" && !substituteKitId)}
          onClick={() =>
            onSubmit({
              eventType,
              boxes: quantityEvent ? boxes : undefined,
              occurredAt: new Date(occurredAt).toISOString(),
              reason: note.trim() || undefined,
              substituteKitId: eventType === "SUBSTITUTED" ? substituteKitId : undefined,
            })
          }
          className="rounded-md border border-sky-300 bg-sky-50 min-h-11 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50">
          Record
        </button>
      </div>
    </div>
  );
}
