"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Shared purchase-ledger model, data loading and record form.
//
// Extracted from KitPurchaseTracker so the merged "Clinical Order & Purchases"
// surface and the standalone tracker read the same server-derived purchase
// state and record events the same way. Nothing here mutates the approved plan:
// recording a purchase is a separate, dated fact resolved by (intentId, kitId).
// Governed catalog prices are resolved SERVER-SIDE and never sent from the
// browser.

export type LineStatus =
  | "RECOMMENDED"
  | "PARTIALLY_PURCHASED"
  | "PURCHASED"
  | "DEFERRED"
  | "DECLINED"
  | "SUBSTITUTED"
  | "DISCONTINUED";

export type EventType =
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

export interface PurchaseEvent {
  id: string;
  eventType: EventType;
  boxes: number | null;
  saleValueMinor: number | null;
  occurredAt: string;
  note: string | null;
  transactionId?: string | null;
}

export interface Derived {
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

export interface LineView {
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

export interface Summary {
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

export const STATUS_LABEL: Record<LineStatus, string> = {
  RECOMMENDED: "Recommended",
  PARTIALLY_PURCHASED: "Partly purchased",
  PURCHASED: "Purchased",
  DEFERRED: "Deferred",
  DECLINED: "Declined",
  SUBSTITUTED: "Substituted",
  DISCONTINUED: "Discontinued",
};

export function statusTone(s: LineStatus): string {
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

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();
export const fmtINR = (minor: number | null) =>
  minor == null ? "—" : `₹${(minor / 100).toLocaleString("en-IN")}`;

export const EVENT_LABEL: Record<EventType, string> = {
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

export interface RecordEventBody {
  eventType: string;
  boxes?: number;
  occurredAt: string;
  reason?: string;
  substituteKitId?: string;
}

export interface PurchaseLedgerState {
  /** The order intent this ledger belongs to, or null when there is no order. */
  intentId: string | null;
  summary: Summary | null;
  lines: LineView[];
  /** kitId → line, for joining the ledger onto the approved plan rows. */
  byKitId: Map<string, LineView>;
  loading: boolean;
  unavailable: boolean;
  busy: boolean;
  error: string | null;
  reload: () => Promise<void>;
  postEvent: (kitId: string, body: RecordEventBody) => Promise<void>;
}

/**
 * Load and record the purchase ledger for an order intent.
 *
 * When `intentId` is null (no order yet — the consultation is not approved)
 * the hook stays idle: no fetch, empty state. This lets the merged surface call
 * it unconditionally and simply render no purchase controls until an order
 * exists.
 */
export function usePurchaseLedger(intentId: string | null | undefined): PurchaseLedgerState {
  const pendingEvent = useRef<{ signature: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lines, setLines] = useState<LineView[]>([]);
  const [loading, setLoading] = useState(!!intentId);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!intentId) {
      setLines([]);
      setSummary(null);
      setLoading(false);
      return;
    }
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
    void reload();
  }, [reload]);

  const postEvent = useCallback(
    async (kitId: string, body: RecordEventBody) => {
      if (!intentId || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const signature = JSON.stringify({ kitId, ...body });
        if (pendingEvent.current?.signature !== signature)
          pendingEvent.current = { signature, id: crypto.randomUUID() };
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
        await reload();
      } catch {
        setError("Connection lost. Retry to safely record the same action.");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [intentId, reload],
  );

  const byKitId = useMemo(() => {
    const m = new Map<string, LineView>();
    for (const l of lines) m.set(l.kitId, l);
    return m;
  }, [lines]);

  return {
    intentId: intentId ?? null,
    summary,
    lines,
    byKitId,
    loading,
    unavailable,
    busy,
    error,
    reload,
    postEvent,
  };
}

/**
 * Inline "record what happened" form for one kit. Pure presentation; the parent
 * owns the ledger and persists through `onSubmit`.
 */
export function RecordForm({
  kits,
  currentKitId,
  defaultBoxes,
  busy,
  onSubmit,
  onCancel,
}: {
  kits: { id: string; label: string }[];
  currentKitId: string;
  defaultBoxes: number;
  busy: boolean;
  onSubmit: (payload: RecordEventBody) => void;
  onCancel?: () => void;
}) {
  const [eventType, setEventType] = useState<EventType>("PURCHASE_CONFIRMED_BY_CLINIC");
  const [boxes, setBoxes] = useState(defaultBoxes);
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [substituteKitId, setSubstituteKitId] = useState("");
  const needsReason = ["CONTINUED", "DEFERRED", "DECLINED", "SUBSTITUTED", "DISCONTINUED"].includes(
    eventType,
  );
  const quantityEvent =
    eventType === "PURCHASE_CONFIRMED_BY_CLINIC" ||
    eventType === "PURCHASE_REPORTED_BY_PATIENT" ||
    eventType === "DISPENSED" ||
    eventType === "EXTERNALLY_OBTAINED" ||
    eventType === "RETURNED";

  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2">
      <label className="text-sm text-slate-600">
        What happened
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as EventType)}
          className="mt-0.5 w-full rounded border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm"
        >
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
        <input
          type="date"
          value={occurredAt}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="mt-0.5 w-full rounded border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm"
        />
      </label>
      {quantityEvent && (
        <label className="text-sm text-slate-600">
          Boxes
          <input
            type="number"
            min={1}
            value={boxes}
            onChange={(e) => setBoxes(Math.max(1, Number(e.target.value)))}
            className="mt-0.5 w-full rounded border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm"
          />
        </label>
      )}
      {eventType === "SUBSTITUTED" && (
        <label className="text-sm text-slate-700 sm:col-span-2">
          Replacement already on approved plan
          <select
            value={substituteKitId}
            onChange={(e) => setSubstituteKitId(e.target.value)}
            className="mt-1 min-h-11 w-full rounded border px-2 text-base"
          >
            <option value="">Select approved replacement</option>
            {kits
              .filter((k) => k.id !== currentKitId)
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
          </select>
          <span className="block mt-1">
            For a different kit or revised recommendation, edit and re-approve the treatment plan
            first.
          </span>
        </label>
      )}
      <label className="text-sm text-slate-600 sm:col-span-2">
        {needsReason ? "Reason (required)" : "Note (optional)"}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-0.5 w-full rounded border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm"
        />
      </label>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={
            busy ||
            !occurredAt ||
            (quantityEvent && (!Number.isInteger(boxes) || boxes < 1)) ||
            (needsReason && !note.trim()) ||
            (eventType === "SUBSTITUTED" && !substituteKitId)
          }
          onClick={() =>
            onSubmit({
              eventType,
              boxes: quantityEvent ? boxes : undefined,
              occurredAt: new Date(occurredAt).toISOString(),
              reason: note.trim() || undefined,
              substituteKitId: eventType === "SUBSTITUTED" ? substituteKitId : undefined,
            })
          }
          className="rounded-md border border-sky-300 bg-sky-50 min-h-11 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
        >
          Record
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
