import { prisma } from "@/lib/prisma";
import { resolveApprovedOrder } from "@/lib/consultation/approvedOrder";
import { readLatestDeliveries, type DeliveryRecord } from "@/lib/delivery/deliveryStore";
import { readPaymentByIntent, type PaymentRecord } from "@/lib/payments/paymentStore";
import {
  readFulfilmentByIntent,
  readFulfilmentMode,
  readTreatmentStart,
  type FulfilmentRecord,
} from "@/lib/fulfilment/fulfilmentStore";
import { resolveFulfilmentMode } from "@/lib/fulfilment/fulfilmentMode";
import { findOnePagerAsset } from "@/lib/reports/assets/jobService";
import { readPatientOpens, type PatientOpenSummary } from "./events";

// "What happened to this patient after I approved them?"
//
// ══ DERIVED, NOT DUPLICATED ═════════════════════════════════════════════════
//
// PART 5 asks for a cart lifecycle — DRAFT → DOCTOR_APPROVED → SENT_TO_PATIENT
// → VIEWED → CHECKOUT_STARTED → PAID → FULFILMENT_PENDING → FULFILLED. This
// file computes exactly that, and deliberately does NOT persist it as a
// column.
//
// A `cartStatus` enum on KitOrderIntent would be a second source of truth for
// facts that already have one each: approval lives on ConsultationVersion,
// sending on WhatsappDelivery, viewing on AssessmentEvent, payment on
// KitOrderPayment, fulfilment on ClinicKitFulfilment. Every one of those rows
// is written by a different code path, so a denormalised status column is a
// cache with five invalidation triggers — and the first time one of them
// fails, the doctor is shown a lifecycle that contradicts the underlying
// records. Deriving it means the display cannot disagree with the data,
// because there is nothing for it to disagree with.
//
// ══ NEVER THROWS ════════════════════════════════════════════════════════════
//
// Every dependency here is optional, and three of them sit on an unapplied
// migration. A journey strip is a summary panel; it must not be able to take
// down the clinical review page it sits on. Each stage degrades on its own and
// records that it did, so the UI can say "status unavailable" on one row
// instead of claiming a step did not happen — which is the failure that
// matters, because "not sent" and "we could not check" look identical to a
// doctor and only one of them means they should act.

export type JourneyStage =
  | "ASSESSMENT_COMPLETED"
  | "DOCTOR_APPROVED"
  | "REPORT_SENT"
  | "REPORT_OPENED"
  | "CART_SENT"
  | "CART_VIEWED"
  | "CHECKOUT_STARTED"
  | "PAID"
  | "FULFILMENT_REQUESTED"
  | "DISPATCHED"
  | "DELIVERED"
  | "ACKNOWLEDGED"
  | "TREATMENT_STARTED";

export type StageState = "done" | "pending" | "not_applicable" | "unavailable";

export interface JourneyStep {
  stage: JourneyStage;
  state: StageState;
  /** ISO 8601 when `done`. */
  at: string | null;
  /** Short human phrase. Never clinical content. */
  detail: string | null;
}

export interface PatientJourney {
  assessmentId: string;
  /** Null when the assessment has no approved order — the cart never began. */
  kitOrderIntentId: string | null;
  fulfilmentMode: "PATIENT" | "CLINIC" | null;
  fulfilmentModeExplicit: boolean;
  /**
   * The derived cart lifecycle label PART 5 asks for. Computed from the steps
   * below rather than stored — see the module comment.
   */
  cartLifecycle:
    | "NO_ORDER"
    | "DOCTOR_APPROVED"
    | "SENT_TO_PATIENT"
    | "VIEWED"
    | "CHECKOUT_STARTED"
    | "PAID"
    | "FULFILMENT_PENDING"
    | "FULFILLED";
  steps: JourneyStep[];
  /**
   * The compact, persisted REPORT delivery status — see
   * deriveWhatsappReportStatus. Distinct from `steps`, which folds the same
   * fact into a "done"/"pending" timeline entry with a narrative `detail`
   * string; this is the precise state machine the doctor UI's status chip
   * needs (six terminal states, never inferred, always read off the stored
   * row) without parsing that string back apart.
   */
  whatsappReport: WhatsappReportStatus;
  /**
   * The patient's one-pager: whether it exists yet, and if not, why.
   *
   * Its own field rather than a journey step because it is not something that
   * happens TO the patient — it is a property of the artefact the clinic is
   * holding. A doctor needs it before they press Share, which is earlier than
   * any step in the line below.
   */
  onePager: OnePagerState;
  /** Which optional dependencies could not be read, for honest UI messaging. */
  degraded: string[];
}

/**
 * What the doctor may truthfully be told about the one-pager.
 *
 *   ready         the artefact exists and will travel with a Share.
 *   preparing     requested, not finished. Ordinary, and resolves on its own.
 *   failed        rendering is not going to succeed without intervention.
 *   unavailable   we could not find out — an unmigrated deployment, or a read
 *                 that failed. NOT the same as "there isn't one", and drawn
 *                 differently for exactly that reason.
 *   not_approved  nothing has been approved, so nothing has been asked for.
 */
export type OnePagerState =
  | { status: "ready"; generatedAt: string | null }
  | { status: "preparing"; attempts: number }
  | { status: "failed"; errorCode: string | null; attempts: number }
  | { status: "unavailable" }
  | { status: "not_approved" };

/**
 * Run a dependency, converting an unavailable one into a recorded degradation
 * rather than a thrown error. Mirrors `settle` in lib/consultation/meta.
 */
async function optional<T>(
  label: string,
  run: () => Promise<T>,
  degraded: string[],
): Promise<T | null> {
  try {
    return await run();
  } catch {
    degraded.push(label);
    return null;
  }
}

export async function resolveJourney(
  assessmentId: string,
): Promise<PatientJourney> {
  const degraded: string[] = [];

  const assessment = await optional(
    "assessment",
    () =>
      prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: { completedAt: true, submittedAt: true, status: true },
      }),
    degraded,
  );

  const approved = await optional(
    "order",
    () => resolveApprovedOrder(prisma, assessmentId),
    degraded,
  );

  const consultation = await optional(
    "consultation",
    () =>
      prisma.consultation.findUnique({
        where: { assessmentId },
        select: {
          currentVersion: {
            select: { id: true, approvalStatus: true, approvedAt: true, approvedBy: true },
          },
        },
      }),
    degraded,
  );

  const deliveries = await optional(
    "delivery",
    () => readLatestDeliveries(assessmentId),
    degraded,
  );

  const onePager = await resolveOnePagerState(
    consultation?.currentVersion ?? null,
    degraded,
  );

  const reportOpens = await readPatientOpens(assessmentId, "REPORT");
  const cartOpens = await readPatientOpens(assessmentId, "CART");

  const intentId = approved?.intentId ?? null;

  const payment = intentId
    ? await optional("payment", () => readPaymentByIntent(intentId), degraded)
    : null;

  const fulfilment = intentId
    ? await optional("fulfilment", () => readFulfilmentByIntent(intentId), degraded)
    : null;

  const storedMode = intentId
    ? await optional("fulfilmentMode", () => readFulfilmentMode(intentId), degraded)
    : null;

  const treatment = intentId
    ? await optional("treatment", () => readTreatmentStart(intentId), degraded)
    : null;

  const modeResolved = intentId ? resolveFulfilmentMode(storedMode) : null;

  const steps = buildSteps({
    assessment,
    approvalStatus: consultation?.currentVersion?.approvalStatus ?? null,
    approvedAt: consultation?.currentVersion?.approvedAt ?? null,
    hasOrder: Boolean(intentId),
    deliveries,
    reportOpens,
    cartOpens,
    payment,
    fulfilment,
    treatmentStartedAt: treatment?.startedAt ?? null,
    mode: modeResolved?.mode ?? null,
    degraded,
  });

  return {
    assessmentId,
    kitOrderIntentId: intentId,
    fulfilmentMode: modeResolved?.mode ?? null,
    fulfilmentModeExplicit: modeResolved?.explicit ?? false,
    cartLifecycle: deriveCartLifecycle({
      hasOrder: Boolean(intentId),
      cartSent: deliveries?.CART?.status === "SENT",
      cartViewed: cartOpens.openCount > 0,
      checkoutStarted: Boolean(payment?.checkoutStartedAt),
      paid: payment?.status === "PAID",
      fulfilment,
    }),
    steps,
    whatsappReport: deriveWhatsappReportStatus(deliveries?.REPORT, deliveries !== null),
    onePager,
    degraded,
  };
}

/**
 * Read the artefact's state without ever letting it break the journey.
 *
 * `findOnePagerAsset` is already tolerant of an unprovisioned table, so the
 * only thing left to catch is a genuinely failed read — which becomes
 * "unavailable" rather than an absent artefact, because telling a doctor there
 * is no one-pager when we simply could not look is how a doctor ends up
 * telling a patient something false.
 */
async function resolveOnePagerState(
  version: { id: string; approvalStatus: unknown } | null,
  degraded: string[],
): Promise<OnePagerState> {
  if (!version || String(version.approvalStatus) !== "APPROVED") {
    return { status: "not_approved" };
  }
  try {
    const asset = await findOnePagerAsset(version.id);
    if (!asset) return { status: "unavailable" };
    switch (asset.status) {
      case "READY":
        return { status: "ready", generatedAt: asset.generatedAt?.toISOString() ?? null };
      case "FAILED":
        return {
          status: "failed",
          errorCode: asset.errorCode,
          attempts: asset.attemptCount,
        };
      default:
        return { status: "preparing", attempts: asset.attemptCount };
    }
  } catch {
    degraded.push("onePager");
    return { status: "unavailable" };
  }
}

function step(
  stage: JourneyStage,
  state: StageState,
  at: string | null = null,
  detail: string | null = null,
): JourneyStep {
  return { stage, state, at, detail };
}

function buildSteps(input: {
  assessment: { completedAt: Date | null; submittedAt: Date; status: string } | null;
  approvalStatus: string | null;
  approvedAt: Date | null;
  hasOrder: boolean;
  deliveries: { REPORT: DeliveryRecord | null; CART: DeliveryRecord | null } | null;
  reportOpens: PatientOpenSummary;
  cartOpens: PatientOpenSummary;
  payment: PaymentRecord | null;
  fulfilment: FulfilmentRecord | null;
  treatmentStartedAt: string | null;
  mode: "PATIENT" | "CLINIC" | null;
  degraded: string[];
}): JourneyStep[] {
  const steps: JourneyStep[] = [];

  // ── Assessment ────────────────────────────────────────────────────────────
  if (!input.assessment) {
    steps.push(step("ASSESSMENT_COMPLETED", "unavailable"));
  } else {
    const done =
      input.assessment.status === "COMPLETED" ||
      input.assessment.status === "CLINICAL_READY" ||
      Boolean(input.assessment.completedAt);
    steps.push(
      step(
        "ASSESSMENT_COMPLETED",
        done ? "done" : "pending",
        (input.assessment.completedAt ?? input.assessment.submittedAt).toISOString(),
      ),
    );
  }

  // ── Doctor approval ───────────────────────────────────────────────────────
  const approved = input.approvalStatus === "APPROVED";
  steps.push(
    step(
      "DOCTOR_APPROVED",
      input.approvalStatus === null ? "unavailable" : approved ? "done" : "pending",
      input.approvedAt?.toISOString() ?? null,
      approved ? null : labelForApproval(input.approvalStatus),
    ),
  );

  // ── Report sent / opened ──────────────────────────────────────────────────
  //
  // `unavailable` when the delivery table could not be read, which under the
  // baseline freeze is the normal state until the migration is applied. It is
  // NOT reported as "not sent": a doctor told "report not sent" will send it
  // again, and a doctor told "status unavailable" will ask why.
  if (!input.deliveries) {
    steps.push(step("REPORT_SENT", "unavailable"));
  } else {
    const d = input.deliveries.REPORT;
    steps.push(
      step(
        "REPORT_SENT",
        d?.status === "SENT" || d?.status === "DELIVERED" ? "done" : "pending",
        d?.sentAt ?? null,
        describeDelivery(d),
      ),
    );
  }

  steps.push(
    step(
      "REPORT_OPENED",
      input.reportOpens.openCount > 0 ? "done" : "pending",
      input.reportOpens.firstOpenedAt,
      input.reportOpens.openCount > 1
        ? `Opened ${input.reportOpens.openCount} times`
        : null,
    ),
  );

  // ── Cart ──────────────────────────────────────────────────────────────────
  //
  // With no approved order there is no cart, and every downstream step is
  // `not_applicable` rather than `pending`. A row of grey "pending" ticks for
  // a patient who was never prescribed a kit reads as work outstanding, which
  // is the opposite of true.
  if (!input.hasOrder) {
    steps.push(step("CART_SENT", "not_applicable", null, "No kit order"));
    steps.push(step("CART_VIEWED", "not_applicable"));
    steps.push(step("CHECKOUT_STARTED", "not_applicable"));
    steps.push(step("PAID", "not_applicable"));
    steps.push(step("FULFILMENT_REQUESTED", "not_applicable"));
    steps.push(step("TREATMENT_STARTED", "not_applicable"));
    return steps;
  }

  if (!input.deliveries) {
    steps.push(step("CART_SENT", "unavailable"));
  } else {
    const d = input.deliveries.CART;
    steps.push(
      step(
        "CART_SENT",
        d?.status === "SENT" || d?.status === "DELIVERED" ? "done" : "pending",
        d?.sentAt ?? null,
        describeDelivery(d),
      ),
    );
  }

  steps.push(
    step(
      "CART_VIEWED",
      input.cartOpens.openCount > 0 ? "done" : "pending",
      input.cartOpens.firstOpenedAt,
    ),
  );

  // ── Payment ───────────────────────────────────────────────────────────────
  if (input.degraded.includes("payment")) {
    steps.push(step("CHECKOUT_STARTED", "unavailable"));
    steps.push(step("PAID", "unavailable"));
  } else {
    steps.push(
      step(
        "CHECKOUT_STARTED",
        input.payment?.checkoutStartedAt ? "done" : "pending",
        input.payment?.checkoutStartedAt ?? null,
      ),
    );
    steps.push(
      step(
        "PAID",
        input.payment?.status === "PAID" ? "done" : "pending",
        input.payment?.paidAt ?? null,
        // Where the money was taken. Meaningful to a doctor deciding whether
        // to chase a patient or the front desk.
        input.payment?.source === "CLINIC_COUNTER" ? "At clinic" : null,
      ),
    );
  }

  // ── Fulfilment ────────────────────────────────────────────────────────────
  //
  // A patient-delivery order has no clinic fulfilment, and says so, rather than
  // showing a permanently pending row for a request that will never exist.
  if (input.mode === "PATIENT") {
    steps.push(
      step("FULFILMENT_REQUESTED", "not_applicable", null, "Direct to patient"),
    );
  } else if (input.degraded.includes("fulfilment")) {
    steps.push(step("FULFILMENT_REQUESTED", "unavailable"));
  } else {
    const f = input.fulfilment;
    steps.push(
      step(
        "FULFILMENT_REQUESTED",
        f ? "done" : "pending",
        f?.requestedAt ?? null,
        f ? null : "Starts when payment is confirmed",
      ),
    );
    if (f) {
      steps.push(
        step("DISPATCHED", f.dispatchedAt ? "done" : "pending", f.dispatchedAt),
      );
      steps.push(
        step("DELIVERED", f.deliveredAt ? "done" : "pending", f.deliveredAt),
      );
      steps.push(
        step(
          "ACKNOWLEDGED",
          f.acknowledgedAt ? "done" : "pending",
          f.acknowledgedAt,
        ),
      );
    }
  }

  // ── Treatment ─────────────────────────────────────────────────────────────
  steps.push(
    step(
      "TREATMENT_STARTED",
      input.degraded.includes("treatment")
        ? "unavailable"
        : input.treatmentStartedAt
          ? "done"
          : "pending",
      input.treatmentStartedAt,
      input.treatmentStartedAt ? null : "Not started",
    ),
  );

  return steps;
}

/**
 * The one-line truth about a delivery attempt.
 *
 * ── Why "test transport" is surfaced on the step, not just in a toast ───────
 * A toast is seen once, by the person who pressed the button. The claim
 * "report sent" then persists on the page for everyone who opens the case
 * afterwards — including the doctor who returns a week later and reasonably
 * concludes the patient has it. On a staging or unconfigured deployment that
 * would be false: nothing was sent to anybody.
 *
 * So the step itself carries the qualifier for as long as the claim does. In a
 * live deployment `providerStatus` is the provider's own string and this
 * returns null, leaving the step to read plainly as sent.
 *
 * READ is reported in preference to DELIVERED because it is the stronger fact
 * and both are recorded independently of `status` — see deliveryStore on why
 * READ is a timestamp rather than an enum member.
 */
function describeDelivery(d: DeliveryRecord | null | undefined): string | null {
  if (!d) return null;
  if (d.status === "FAILED") return "Send failed";
  if (d.providerStatus?.startsWith("dev")) return "Test delivery — no message sent";
  if (d.readAt) return "Read by patient";
  if (d.deliveredAt) return "Delivered to phone";
  return null;
}

/**
 * The compact, persisted status the doctor UI renders under a sent report —
 * see PatientJourney.whatsappReport and DecisionBar's PersistedDeliveryStatus.
 *
 * Deliberately derived from the SAME `DeliveryRecord` `describeDelivery`
 * already reads (same dev-transport detector: `providerStatus?.startsWith("dev")`)
 * — this is not a second status source, it is a second, more granular VIEW of
 * the one WhatsappDelivery row. DELIVERED and READ are never inferred: they
 * come straight off `deliveredAt` / `readAt`, which only a provider status
 * webhook ever sets (see deliveryStore.markProviderStatus).
 */
export type WhatsappReportUiStatus =
  | "not_sent"
  | "test_delivery"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "configuration_error"
  | "blocked_no_consent"
  | "unavailable";

export interface WhatsappReportStatus {
  status: WhatsappReportUiStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export function deriveWhatsappReportStatus(
  d: DeliveryRecord | null | undefined,
  readable: boolean,
): WhatsappReportStatus {
  const base = { sentAt: d?.sentAt ?? null, deliveredAt: d?.deliveredAt ?? null, readAt: d?.readAt ?? null };
  if (!readable) return { status: "unavailable", ...base };
  if (!d) return { status: "not_sent", ...base };
  if (d.status === "BLOCKED_NO_CONSENT") return { status: "blocked_no_consent", ...base };
  if (d.status === "CONFIGURATION_ERROR") return { status: "configuration_error", ...base };
  if (d.status === "FAILED") return { status: "failed", ...base };
  // SENT or DELIVERED from here — the only statuses a provider send can end in.
  //
  // The dev-transport check is on `messageId`, NOT `providerStatus`: the
  // webhook route overwrites `providerStatus` on every callback with the
  // provider's own raw status word ("delivered", "read", ...) — see
  // deliveryStore.markProviderStatus — so it stops meaning "which transport
  // sent this" the moment a callback lands. `messageId` is written once, at
  // send time, and never touched again; the dev provider always mints one
  // prefixed `dev_` (see whatsappProvider.ts), so it survives for the life of
  // the row. Caught live: a synthetic webhook naming a dev-issued message id
  // used to flip this to "read" via the (mutable) providerStatus check.
  if (d.messageId?.startsWith("dev_")) return { status: "test_delivery", ...base };
  if (d.readAt) return { status: "read", ...base };
  if (d.deliveredAt || d.status === "DELIVERED") return { status: "delivered", ...base };
  return { status: "sent", ...base };
}

function labelForApproval(status: string | null): string | null {
  switch (status) {
    case "REVISION_REQUESTED":
      return "Revision requested";
    case "REJECTED":
      return "Rejected";
    case "PENDING_REVIEW":
    case "DRAFT":
      return "Awaiting review";
    default:
      return null;
  }
}

/**
 * The single lifecycle label, taken from the furthest stage actually reached.
 *
 * Read from the END backwards on purpose: the lifecycle is the deepest thing
 * that is true, not the shallowest thing that is missing. A patient who paid
 * without our recording a cart view (they opened it on a device that blocked
 * the request, or the doctor took payment at the counter before they ever
 * looked) is PAID — reporting them as "SENT_TO_PATIENT" because the view event
 * is absent would be a worse answer than the one the money gives.
 */
export function deriveCartLifecycle(input: {
  hasOrder: boolean;
  cartSent: boolean;
  cartViewed: boolean;
  checkoutStarted: boolean;
  paid: boolean;
  fulfilment: FulfilmentRecord | null;
}): PatientJourney["cartLifecycle"] {
  if (!input.hasOrder) return "NO_ORDER";
  if (input.fulfilment) {
    return input.fulfilment.status === "ACKNOWLEDGED" ||
      input.fulfilment.status === "DELIVERED"
      ? "FULFILLED"
      : "FULFILMENT_PENDING";
  }
  if (input.paid) return "PAID";
  if (input.checkoutStarted) return "CHECKOUT_STARTED";
  if (input.cartViewed) return "VIEWED";
  if (input.cartSent) return "SENT_TO_PATIENT";
  return "DOCTOR_APPROVED";
}
