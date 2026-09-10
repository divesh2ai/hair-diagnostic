"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCheck,
  CircleDashed,
  HelpCircle,
  Loader2,
  Minus,
  MessageCircle,
  PlayCircle,
  ShieldOff,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

// "What happened after I approved this patient?"
//
// ── The five-second rule ────────────────────────────────────────────────────
// A doctor opening a case they approved last week needs one glance to know
// whether the patient has the plan, has paid, and has started. So this is a
// single line of state — not a timeline, not an accordion, not a table. Steps
// that have happened carry a tick and a date; steps that have not are quiet.
//
// ── Three states, not two ───────────────────────────────────────────────────
// done / pending / unavailable, and the third is the one that earns its place.
// Three of these stages read tables from a migration that has not been applied
// yet, and "we could not check whether the report was sent" must not render
// identically to "the report was not sent" — a doctor shown the second will
// send it again. Unavailable is drawn as a question mark and says so on hover.
// `not_applicable` (no kit order, or a direct-to-patient order that will never
// have a clinic fulfilment) is drawn as a dash: nothing is outstanding.
//
// ── Sending is deliberate ───────────────────────────────────────────────────
// The two send buttons are secondary controls that name their subject and ask
// for confirmation before messaging a real person. They sit BELOW the state
// line, after the doctor has seen what has already been sent — the common
// mistake this prevents is sending a second copy of something the patient
// already has.

type StageState = "done" | "pending" | "not_applicable" | "unavailable";

interface JourneyStep {
  stage: string;
  state: StageState;
  at: string | null;
  detail: string | null;
}

type OnePagerState =
  | { status: "ready"; generatedAt: string | null }
  | { status: "preparing"; attempts: number }
  | { status: "failed"; errorCode: string | null; attempts: number }
  | { status: "unavailable" }
  | { status: "not_approved" };

/**
 * The compact, persisted REPORT delivery status — mirrors
 * lib/journey/resolveJourney.ts's WhatsappReportStatus. Never inferred: every
 * state here is read straight off the one stored WhatsappDelivery row, and
 * `delivered` / `read` only ever get set by a real provider status webhook.
 */
type WhatsappReportUiStatus =
  | "not_sent"
  | "test_delivery"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "configuration_error"
  | "blocked_no_consent"
  | "unavailable";

interface WhatsappReportStatus {
  status: WhatsappReportUiStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

interface Journey {
  assessmentId: string;
  kitOrderIntentId: string | null;
  fulfilmentMode: "PATIENT" | "CLINIC" | null;
  fulfilmentModeExplicit: boolean;
  cartLifecycle: string;
  steps: JourneyStep[];
  whatsappReport?: WhatsappReportStatus;
  onePager?: OnePagerState;
  degraded: string[];
}

const STAGE_LABEL: Record<string, string> = {
  ASSESSMENT_COMPLETED: "Assessment",
  DOCTOR_APPROVED: "Approved",
  REPORT_SENT: "Report sent",
  REPORT_OPENED: "Report opened",
  CART_SENT: "Cart sent",
  CART_VIEWED: "Cart viewed",
  CHECKOUT_STARTED: "Checkout",
  PAID: "Paid",
  FULFILMENT_REQUESTED: "Kit requested",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  ACKNOWLEDGED: "Received",
  TREATMENT_STARTED: "Treatment",
};

/**
 * How each unavailable reason is said to a doctor who has just sent something.
 *
 * Deliberately not a generic failure sentence. "Still being prepared" is a
 * wait; "could not be produced" is a ticket; "not switched on here" is a
 * deployment step — and a doctor deciding whether to re-send in five minutes
 * needs to know which one they are looking at.
 */
const ONE_PAGER_SEND_NOTE: Record<string, string> = {
  pending: " — link only for now, the one-pager is still being prepared",
  failed: " — link only, the one-pager could not be produced",
  not_provisioned: " — link only, one-pagers are not switched on here",
  not_requested: " — link only, no one-pager was requested for this version",
  bytes_missing: " — link only, the one-pager file could not be read",
  bytes_invalid: " — link only, the stored one-pager failed its check",
};

export function PatientJourney({
  assessmentId,
  canSend,
}: {
  assessmentId: string;
  /**
   * Whether the consultation is approved. The server refuses an unapproved
   * send with 409 regardless — this only decides whether to OFFER the control,
   * so a doctor is not invited to press something that cannot work.
   */
  canSend: boolean;
}) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/doctor/journey/${assessmentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: Journey) => {
        setJourney(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [assessmentId]);

  useEffect(load, [load]);

  async function send(subject: "REPORT" | "CART") {
    const what = subject === "REPORT" ? "report" : "kit order";
    // A native confirm, not a bespoke modal. This messages a real person's
    // phone and cannot be undone; the platform dialog is the one control a
    // doctor cannot mistake for something else, and it costs a deliberate act.
    if (!window.confirm(`Send this patient their ${what} on WhatsApp?`)) return;

    setBusy(subject);
    try {
      const res = await fetch(`/api/consultation/${assessmentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(messageForSendError(body.error));
        return;
      }

      // A UI that cannot distinguish a recorded send from a delivered one will
      // eventually tell a clinician something false. When the transport is the
      // dev one, say so rather than implying the patient's phone buzzed.
      const label = subject === "REPORT" ? "Report" : "Cart";
      // Three facts the doctor needs, in one line: whether a phone actually
      // buzzed, and — for a report — whether the one-page summary travelled
      // with it or the patient only got the link.
      // The one-pager line says which fact it is. "Could not be attached"
      // reads as a fault even when the truthful answer is "it is still being
      // drawn, try again in a moment" — and a doctor who reads a fault picks
      // up the phone to engineering over something that fixes itself.
      const attachment =
        subject === "REPORT"
          ? body.onePagerAttached
            ? " with the one-pager"
            : ONE_PAGER_SEND_NOTE[body.onePagerUnavailable as string] ??
              " — link only, the one-pager could not be attached"
          : "";
      toast.success(
        body.live
          ? `${label} sent${attachment}`
          : `${label} recorded${attachment} — test transport, nothing was sent`,
      );
      load();
    } finally {
      setBusy(null);
    }
  }

  async function recordTreatmentStart(intentId: string) {
    setBusy("TREATMENT");
    try {
      const res = await fetch(`/api/doctor/orders/${intentId}/treatment-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          body.error === "fulfilment_not_provisioned"
            ? "Not switched on yet — the post-approval migration has not been applied."
            : "Could not record the treatment start.",
        );
        return;
      }
      toast.success(
        body.alreadyRecorded ? "Already recorded" : "Treatment start recorded",
      );
      load();
    } finally {
      setBusy(null);
    }
  }

  async function setMode(intentId: string, next: "CLINIC" | "PATIENT") {
    setBusy("MODE");
    try {
      const res = await fetch(`/api/doctor/orders/${intentId}/fulfilment-mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          body.error === "fulfilment_already_started"
            ? "Fulfilment has already started — contact Ops to change the destination."
            : body.error === "fulfilment_not_provisioned"
              ? "Not switched on yet — the post-approval migration has not been applied."
              : "Could not change the destination.",
        );
        // Reload either way: a refusal usually means this page is stale.
        load();
        return;
      }
      toast.success(next === "CLINIC" ? "Supplying to clinic" : "Delivering to patient");
      load();
    } finally {
      setBusy(null);
    }
  }

  if (failed) {
    return (
      <p className="text-[11px] text-stone-500">
        Patient journey is temporarily unavailable.
      </p>
    );
  }
  if (!journey) {
    return <p className="text-[11px] text-stone-500">Loading journey…</p>;
  }

  const visible = journey.steps.filter((s) => s.state !== "not_applicable");
  const notApplicable = journey.steps.filter((s) => s.state === "not_applicable");
  const treatmentStep = journey.steps.find((s) => s.stage === "TREATMENT_STARTED");
  const canRecordStart =
    journey.kitOrderIntentId !== null &&
    treatmentStep?.state === "pending";
  // Ops has been told to pack something. Derived from the journey rather than
  // tracked separately, so the lock and the displayed state cannot disagree.
  const fulfilmentStarted =
    journey.steps.find((s) => s.stage === "FULFILMENT_REQUESTED")?.state === "done";

  return (
    <section aria-labelledby="journey-heading" className="space-y-3">
      <h2
        id="journey-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
      >
        Patient journey
      </h2>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <ol className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {visible.map((s) => (
            <li key={s.stage} className="flex items-center gap-1.5">
              <StateDot state={s.state} />
              <span
                className={
                  s.state === "done"
                    ? "text-[12px] text-stone-800"
                    : "text-[12px] text-stone-400"
                }
              >
                {STAGE_LABEL[s.stage] ?? s.stage}
              </span>
              {s.at && s.state === "done" && (
                <span className="text-[11px] tabular-nums text-stone-400">
                  {formatDate(s.at)}
                </span>
              )}
              {s.detail && s.state !== "done" && (
                <span className="text-[11px] text-stone-400">· {s.detail}</span>
              )}
            </li>
          ))}
        </ol>

        {/* Stated once, quietly, rather than as a row of dashes in the line
            above. "No kit order" is a fact about this case, not a step the
            doctor still has to take. */}
        {notApplicable.length > 0 && notApplicable[0].detail && (
          <p className="mt-2 text-[11px] text-stone-400">
            {notApplicable[0].detail}
          </p>
        )}

        <WhatsappReportStatusLine status={journey.whatsappReport} />

        {/* THE PATIENT'S ONE-PAGER
            Shown before the send controls because it is the fact that decides
            what a Share will actually carry. Silent once ready — a green tick
            for something that is simply working is noise — and explicit in
            every other state, including the state where we could not find out. */}
        {journey.onePager && journey.onePager.status !== "not_approved" &&
          journey.onePager.status !== "ready" && (
            <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
              {journey.onePager.status === "preparing" && (
                <>
                  <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin text-stone-400" />
                  One-pager is being prepared. Sharing now sends the report link
                  on its own.
                </>
              )}
              {journey.onePager.status === "failed" && (
                <>
                  One-pager unavailable — it could not be produced. Report
                  sharing still works and sends the link.
                </>
              )}
              {journey.onePager.status === "unavailable" && (
                <>
                  One-pager status could not be checked. Sharing still works;
                  whether the page travels with it will be reported after
                  sending.
                </>
              )}
            </p>
          )}

        {/* WHERE ARE THE KITS GOING?
            Shown for every order, because it is a fact the doctor is
            accountable for and it used to be invisible. Editable only until
            ops has been told to pack something — after that the honest answer
            is "ring ops", not a control that silently does nothing. */}
        {journey.kitOrderIntentId && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <span className="text-[11px] uppercase tracking-[0.12em] text-stone-500">
              Kits go to
            </span>

            {fulfilmentStarted ? (
              <span className="text-[12px] text-stone-800">
                {journey.fulfilmentMode === "PATIENT" ? "Patient" : "Clinic"}
                <span className="ml-1 text-[11px] text-stone-400">
                  · locked, fulfilment has started
                </span>
              </span>
            ) : (
              <>
                {/* SELECTED means CHOSEN, never merely defaulted.
                    An order with no recorded destination previously rendered
                    "Clinic" in the selected style beside the words "not
                    recorded on this order" — the control contradicted its own
                    caption, and the reading a doctor takes from a filled pill
                    is "somebody decided this". So selection is shown only when
                    the order actually carries a value. */}
                {(["CLINIC", "PATIENT"] as const).map((m) => {
                  const chosen =
                    journey.fulfilmentModeExplicit && journey.fulfilmentMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={busy !== null}
                      aria-pressed={chosen}
                      onClick={() => setMode(journey.kitOrderIntentId!, m)}
                      className={
                        chosen
                          ? "rounded-full border border-stone-800 bg-stone-800 px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50"
                          : "rounded-full border border-stone-200 bg-white px-3 py-1 text-[12px] text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                      }
                    >
                      {m === "CLINIC" ? "Clinic" : "Patient"}
                    </button>
                  );
                })}
                {busy === "MODE" && (
                  <Loader2 className="size-3.5 animate-spin text-stone-400" aria-hidden />
                )}
              </>
            )}

            {/* Only ever shown for a legacy order placed before destinations
                were recorded. New orders are stamped at approval, so this line
                marks genuinely unknown history rather than an ongoing default. */}
            {!journey.fulfilmentModeExplicit && !fulfilmentStarted && (
              <span className="text-[11px] text-stone-400">
                · not recorded on this order — confirm the destination
              </span>
            )}
          </div>
        )}

        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
          {canSend && (
            <p className="text-[11px] text-stone-500">
              {/* Names what separates these controls from the WhatsApp
                  shortcuts above them, which open the doctor's own WhatsApp
                  and leave the server none the wiser. */}
              These send a secure link and record it on the journey above.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {canSend && (
            <>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => send("REPORT")}
                className="hd-btn hd-btn-secondary justify-center sm:justify-start"
              >
                {busy === "REPORT" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <MessageCircle className="size-4" aria-hidden />
                )}
                Send report to patient
              </button>

              {journey.kitOrderIntentId && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => send("CART")}
                  className="hd-btn hd-btn-secondary justify-center sm:justify-start"
                >
                  {busy === "CART" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ShoppingCart className="size-4" aria-hidden />
                  )}
                  Send cart to patient
                </button>
              )}
            </>
          )}

          {canRecordStart && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => recordTreatmentStart(journey.kitOrderIntentId!)}
              className="hd-btn hd-btn-secondary justify-center sm:justify-start"
            >
              {busy === "TREATMENT" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <PlayCircle className="size-4" aria-hidden />
              )}
              Record treatment start
            </button>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The compact, persisted delivery status line — see PHASE 3 of the Meta
 * production readiness gate. Read straight off `journey.whatsappReport`
 * (itself derived from the one WhatsappDelivery row, in
 * deriveWhatsappReportStatus): never a second status source, never an
 * inferred DELIVERED or READ.
 *
 * `test_delivery` is unconditional on the dev transport's own marker
 * (`providerStatus` starting with "dev") — a doctor on staging or in a clinic
 * still on the manual-launch flag must never see "WhatsApp sent" for a
 * message nobody's phone actually received.
 */
function WhatsappReportStatusLine({ status }: { status?: WhatsappReportStatus }) {
  if (!status || status.status === "not_sent") return null;

  if (status.status === "unavailable") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-400">
        <HelpCircle className="size-3.5" aria-hidden />
        WhatsApp delivery status could not be read.
      </p>
    );
  }

  if (status.status === "test_delivery") {
    return (
      <p className="mt-2 text-[11px] text-stone-500">
        Test delivery recorded — no real WhatsApp message was sent.
      </p>
    );
  }

  if (status.status === "sent") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
        <Check className="size-3.5" aria-hidden />
        WhatsApp sent
      </p>
    );
  }

  if (status.status === "delivered") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
        <CheckCheck className="size-3.5" aria-hidden />
        Delivered
      </p>
    );
  }

  if (status.status === "read") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
        <CheckCheck className="size-3.5" aria-hidden />
        Read
      </p>
    );
  }

  if (status.status === "failed") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
        <TriangleAlert className="size-3.5" aria-hidden />
        Delivery failed
      </p>
    );
  }

  if (status.status === "configuration_error") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
        <TriangleAlert className="size-3.5" aria-hidden />
        WhatsApp configuration unavailable
      </p>
    );
  }

  // blocked_no_consent
  return (
    <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
      <ShieldOff className="size-3.5" aria-hidden />
      WhatsApp consent not provided
    </p>
  );
}

function StateDot({ state }: { state: StageState }) {
  if (state === "done") {
    return <Check className="size-3.5 text-emerald-600" aria-label="done" />;
  }
  if (state === "unavailable") {
    // The tooltip carries the distinction the icon can only hint at. A doctor
    // who reads this as "not done" will redo work that may already be done.
    return (
      <span
        title="Status could not be read — this is not the same as “not done”."
        className="inline-flex"
      >
        <HelpCircle
          className="size-3.5 text-stone-400"
          aria-label="status unavailable"
        />
      </span>
    );
  }
  if (state === "not_applicable") {
    return <Minus className="size-3.5 text-stone-300" aria-label="not applicable" />;
  }
  return <CircleDashed className="size-3.5 text-stone-300" aria-label="pending" />;
}

function messageForSendError(code: unknown): string {
  switch (code) {
    case "no_phone":
      return "This patient has no WhatsApp number on their record.";
    case "not_approved":
      return "Approve the consultation before sending it to the patient.";
    case "delivery_not_provisioned":
      return "Sending is not switched on yet — the post-approval migration has not been applied.";
    case "send_failed":
      return "The message could not be sent. It has been recorded as failed.";
    default:
      return "Could not send this to the patient.";
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
