// Partial kit purchase — the pure domain model.
//
// Everything money-, DB-, and request-free lives here so the rules that matter
// can be unit-tested without a database: how purchased boxes are counted, how
// kit COUNT is kept distinct from BOX quantity, which event types are
// authoritative, and which require a reason or a quantity. The raw-SQL store
// (./purchaseStore) and the API route are thin shells over these functions.
//
// ── Two independent dimensions (requirement 1) ──────────────────────────────
// A plan is "4 kits, N boxes each". A patient can buy fewer KITS (2 of 4 lines)
// and/or fewer BOXES of a kit (1 of 2 boxes). The two are tracked separately:
//   • kit count   = number of KitPurchaseLine rows (and how many have any buy)
//   • box quantity= recommendedBoxes per line vs boxes actually bought
//
// ── Distinct events, never conflated (requirement 2) ────────────────────────
// "The patient says they bought it" is NOT "the clinic sold it" is NOT "money
// was taken" is NOT "it was handed over" is NOT "they started it". Each is its
// own event type; only a clinic-confirmed sale counts toward purchased boxes.

export type KitPurchaseEventType =
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

export type KitPurchaseLineStatus =
  | "RECOMMENDED"
  | "PARTIALLY_PURCHASED"
  | "PURCHASED"
  | "DEFERRED"
  | "DECLINED"
  | "SUBSTITUTED"
  | "DISCONTINUED";

export const KIT_PURCHASE_EVENT_TYPES: readonly KitPurchaseEventType[] = [
  "EXTERNALLY_OBTAINED",
  "CONTINUED",
  "PURCHASE_REPORTED_BY_PATIENT",
  "PURCHASE_CONFIRMED_BY_CLINIC",
  "PAYMENT_RECORDED",
  "DISPENSED",
  "TREATMENT_STARTED",
  "DEFERRED",
  "DECLINED",
  "SUBSTITUTED",
  "DISCONTINUED",
  "REFUNDED",
  "RETURNED",
];

/** Control states a line can be moved into; each one requires a reason. */
export const CONTROL_EVENT_TYPES: readonly KitPurchaseEventType[] = [
  "CONTINUED",
  "DEFERRED",
  "DECLINED",
  "SUBSTITUTED",
  "DISCONTINUED",
];

/** Events that carry a box quantity. */
export const QUANTITY_EVENT_TYPES: readonly KitPurchaseEventType[] = [
  "EXTERNALLY_OBTAINED",
  "PURCHASE_REPORTED_BY_PATIENT",
  "PURCHASE_CONFIRMED_BY_CLINIC",
  "DISPENSED",
  "REFUNDED",
  "RETURNED",
];

export function isKitPurchaseEventType(v: unknown): v is KitPurchaseEventType {
  return typeof v === "string" && (KIT_PURCHASE_EVENT_TYPES as string[]).includes(v);
}

export function requiresReason(type: KitPurchaseEventType): boolean {
  return (CONTROL_EVENT_TYPES as string[]).includes(type);
}

export function requiresBoxes(type: KitPurchaseEventType): boolean {
  return (QUANTITY_EVENT_TYPES as string[]).includes(type);
}

/**
 * Whether this event records money and therefore passes through the purchasing
 * kill-switch. Recording quantity/date/clinical state does NOT — a dispensing
 * or defer record is operational, not a charge.
 */
export function isMoneyEvent(type: KitPurchaseEventType, saleValueMinor: number | null): boolean {
  if (type === "PAYMENT_RECORDED") return true;
  return saleValueMinor != null && saleValueMinor > 0;
}

/** A single ledger event, store-agnostic. */
export interface PurchaseEventInput {
  eventType: KitPurchaseEventType;
  boxes?: number | null;
  occurredAt: string; // ISO
}

export interface DerivedLineState {
  externallyObtainedBoxes: number;
  recommendedBoxes: number;
  /** Authoritative: clinic-confirmed purchases net of refunds/returns. */
  purchasedBoxes: number;
  /** Boxes physically handed over (tracked apart from purchase). */
  dispensedBoxes: number;
  /** Patient-stated only — informational, never counted as purchased. */
  patientReportedBoxes: number;
  remainingBoxes: number;
  /** True once at least one TREATMENT_STARTED event exists for the kit. */
  treatmentStarted: boolean;
  /** Earliest treatment-start date for this kit, ISO, or null. */
  treatmentStartedAt: string | null;
  status: KitPurchaseLineStatus;
}

function sumBoxes(events: readonly PurchaseEventInput[], type: KitPurchaseEventType): number {
  return events
    .filter((e) => e.eventType === type)
    .reduce((acc, e) => acc + (typeof e.boxes === "number" && e.boxes > 0 ? e.boxes : 0), 0);
}

/**
 * Derive the purchase state of one line from its recommended box count, its
 * stored control status, and its full event history.
 *
 * Counting rule — deliberate:
 *   purchasedBoxes = confirmed-by-clinic − refunded (never below 0)
 * Patient-reported and dispensed events are surfaced but do NOT add to the
 * purchased total, so an unverified claim can never read as a sale and a
 * confirmed-then-dispensed kit is not counted twice.
 *
 * Status rule: a real purchase outranks a prior control state (a deferred kit
 * later bought reads PURCHASED/PARTIALLY_PURCHASED). With no purchase, the most
 * recent control event wins; absent any, RECOMMENDED.
 */
export function deriveLineState(
  recommendedBoxes: number,
  storedStatus: KitPurchaseLineStatus,
  events: readonly PurchaseEventInput[],
): DerivedLineState {
  const confirmed = sumBoxes(events, "PURCHASE_CONFIRMED_BY_CLINIC");
  const refunded = sumBoxes(events, "REFUNDED");
  const returned = sumBoxes(events, "RETURNED");
  const dispensedBoxes = Math.max(0, sumBoxes(events, "DISPENSED") - returned);
  const externallyObtainedBoxes = sumBoxes(events, "EXTERNALLY_OBTAINED");
  const patientReportedBoxes = sumBoxes(events, "PURCHASE_REPORTED_BY_PATIENT");

  // Returning stock and refunding money are separate actions. Subtracting
  // both would reverse the same purchase twice.
  const purchasedBoxes = Math.max(0, confirmed - refunded);
  const rec = Math.max(0, recommendedBoxes);
  const remainingBoxes = Math.max(0, rec - purchasedBoxes);

  const starts = events
    .filter((e) => e.eventType === "TREATMENT_STARTED")
    .map((e) => e.occurredAt)
    .sort();
  const treatmentStarted = starts.length > 0;
  const treatmentStartedAt = treatmentStarted ? starts[0] : null;

  let status: KitPurchaseLineStatus;
  if (["DISCONTINUED", "SUBSTITUTED", "DECLINED"].includes(storedStatus)) {
    status = storedStatus;
  } else if (purchasedBoxes > 0 && rec > 0 && purchasedBoxes >= rec) {
    status = "PURCHASED";
  } else if (purchasedBoxes > 0) {
    status = "PARTIALLY_PURCHASED";
  } else {
    // No confirmed purchase. Honour a stored control state; otherwise the last
    // control event; otherwise plain RECOMMENDED.
    const controls = events
      .filter((e) => (CONTROL_EVENT_TYPES as string[]).includes(e.eventType))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const lastControl = controls[controls.length - 1]?.eventType as
      | KitPurchaseLineStatus
      | undefined;
    const stored = storedStatus && storedStatus !== "RECOMMENDED" ? storedStatus : undefined;
    status = (lastControl === ("CONTINUED" as string) ? "RECOMMENDED" : lastControl ?? stored ?? "RECOMMENDED") as KitPurchaseLineStatus;
  }

  return {
    externallyObtainedBoxes,
    recommendedBoxes: rec,
    purchasedBoxes,
    dispensedBoxes,
    patientReportedBoxes,
    remainingBoxes,
    treatmentStarted,
    treatmentStartedAt,
    status,
  };
}

export interface LineForSummary {
  recommendedBoxes: number;
  storedStatus: KitPurchaseLineStatus;
  events: readonly PurchaseEventInput[];
}

export interface PlanPurchaseSummary {
  /** Distinct kits on the approved plan — the KIT count. */
  recommendedKits: number;
  /** Kits with at least one confirmed box bought. */
  purchasedKits: number;
  /** Kits fully bought (all recommended boxes). */
  fullyPurchasedKits: number;
  /** Kits deferred / declined / substituted / discontinued, with nothing bought. */
  deferredKits: number;
  declinedKits: number;
  /** Kits still open: recommended, nothing bought, no terminal control state. */
  remainingKits: number;
  /** BOX totals across the whole plan — the BOX dimension. */
  recommendedBoxes: number;
  purchasedBoxes: number;
  remainingBoxes: number;
}

/**
 * Roll the per-line derivation up to a plan-level summary, keeping the kit
 * count and the box quantity as two separate reported dimensions. "Never assume
 * all kits were bought": every number here is derived from events, and a line
 * with no events contributes 0 purchased.
 */
export function summarisePlan(lines: readonly LineForSummary[]): PlanPurchaseSummary {
  let purchasedKits = 0;
  let fullyPurchasedKits = 0;
  let deferredKits = 0;
  let declinedKits = 0;
  let remainingKits = 0;
  let recommendedBoxes = 0;
  let purchasedBoxes = 0;
  let remainingBoxes = 0;

  for (const line of lines) {
    const d = deriveLineState(line.recommendedBoxes, line.storedStatus, line.events);
    recommendedBoxes += d.recommendedBoxes;
    purchasedBoxes += d.purchasedBoxes;
    remainingBoxes += d.remainingBoxes;

    if (d.purchasedBoxes > 0) {
      purchasedKits += 1;
      if (d.status === "PURCHASED") fullyPurchasedKits += 1;
    } else if (d.status === "DEFERRED") {
      deferredKits += 1;
    } else if (
      d.status === "DECLINED" ||
      d.status === "SUBSTITUTED" ||
      d.status === "DISCONTINUED"
    ) {
      declinedKits += 1;
    } else {
      remainingKits += 1;
    }
  }

  return {
    recommendedKits: lines.length,
    purchasedKits,
    fullyPurchasedKits,
    deferredKits,
    declinedKits,
    remainingKits,
    recommendedBoxes,
    purchasedBoxes,
    remainingBoxes,
  };
}

export interface EventPayloadIdentity {
  eventType: KitPurchaseEventType;
  boxes: number | null;
  saleValueMinor: number | null;
  /** ISO or YYYY-MM-DD; compared at date granularity. */
  occurredAt: string;
  /** The reason/note attached to the event. */
  note: string | null;
}

/** Date-granularity normalisation so a date and its midnight ISO compare equal. */
function dayOf(iso: string): string {
  return (iso ?? "").slice(0, 10);
}

/**
 * Whether a replay carrying an idempotency key matches the event already stored
 * under it. A re-send of the identical action is safe (same payload); reusing a
 * key for a DIFFERENT action is a conflict the caller must reject, never
 * silently write or silently ignore.
 *
 * The comparison includes the meaningful fields — type, boxes, sale value, the
 * event DATE, and the reason/note — so two actions that differ only in date or
 * reason are correctly treated as different, not collapsed.
 */
export function isSameEventPayload(a: EventPayloadIdentity, b: EventPayloadIdentity): boolean {
  return (
    a.eventType === b.eventType &&
    (a.boxes ?? null) === (b.boxes ?? null) &&
    (a.saleValueMinor ?? null) === (b.saleValueMinor ?? null) &&
    dayOf(a.occurredAt) === dayOf(b.occurredAt) &&
    (a.note ?? "").trim() === (b.note ?? "").trim()
  );
}

export interface IdempotencyKeyInput {
  kitId: string;
  eventType: KitPurchaseEventType;
  boxes?: number | null;
  /** ISO or YYYY-MM-DD; keyed at date granularity. */
  occurredAt: string;
  reason?: string | null;
}

/**
 * A STABLE idempotency key for one purchase action, derived deterministically
 * from the action's meaningful fields. The same user action produces the same
 * key on every retry (so a double-submit or a network retry de-duplicates),
 * while a different action — a different date, reason, box count or type —
 * produces a different key. Opaque (hashed) so the raw reason text is not
 * embedded in the key. A hash collision is still caught server-side by
 * isSameEventPayload, which rejects a mismatched payload rather than merging.
 */
export function purchaseEventIdempotencyKey(input: IdempotencyKeyInput): string {
  const basis = [
    input.kitId,
    input.eventType,
    String(input.boxes ?? ""),
    (input.occurredAt ?? "").slice(0, 10),
    (input.reason ?? "").trim(),
  ].join("\u0001");

  // Two independent rolling hashes (FNV-1a + djb2) concatenated, for a wide key
  // with negligible collision risk and no dependency on crypto in the browser.
  let fnv = 0x811c9dc5;
  let djb2 = 5381;
  for (let i = 0; i < basis.length; i++) {
    const c = basis.charCodeAt(i);
    fnv ^= c;
    fnv = Math.imul(fnv, 0x01000193);
    djb2 = (Math.imul(djb2, 33) + c) | 0;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `evt_${hex(fnv)}${hex(djb2)}`;
}

/**
 * Validate an incoming event before it is written. Returns an error code or
 * null. The box quantity itself is also DB-CHECK-guarded (>= 0); this is the
 * human-facing, testable gate.
 */
export function validatePurchaseEvent(input: {
  eventType: unknown;
  boxes?: number | null;
  reason?: string | null;
  saleValueMinor?: number | null;
}): string | null {
  if (!isKitPurchaseEventType(input.eventType)) return "invalid_event_type";
  const type = input.eventType;

  if (input.reason != null && (typeof input.reason !== "string" || input.reason.length > 2000)) return "invalid_reason";
  if (requiresReason(type) && !(typeof input.reason === "string" && input.reason.trim().length > 0)) {
    return "reason_required";
  }
  if (requiresBoxes(type)) {
    if (input.boxes == null || !Number.isSafeInteger(input.boxes) || input.boxes <= 0 || input.boxes > 99) {
      return "boxes_required";
    }
  }
  if (input.saleValueMinor != null) {
    if (!Number.isInteger(input.saleValueMinor) || input.saleValueMinor < 0) {
      return "invalid_sale_value";
    }
  }
  return null;
}
