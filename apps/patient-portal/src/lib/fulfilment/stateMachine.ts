// The clinic kit fulfilment state machine.
//
// ── Why this is a separate, pure module ─────────────────────────────────────
// A Postgres enum constrains the VALUE a column may hold. It cannot constrain
// the PATH between values, and the path is the part that matters: nothing in
// the type system stops `UPDATE … SET status = 'DELIVERED'` on a request that
// was created ten seconds ago and never packed. Recorded that way, the
// timestamps that ops later reconcile against a courier bill are fiction.
//
// So the legal moves live here, in one table, with no database and no request
// context, which means they can be exhaustively tested and cannot drift
// between the two endpoints that perform transitions.

export type FulfilmentStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "PACKED"
  | "DISPATCHED"
  | "DELIVERED"
  | "ACKNOWLEDGED"
  | "CANCELLED";

export const FULFILMENT_STATUSES: readonly FulfilmentStatus[] = [
  "REQUESTED",
  "CONFIRMED",
  "PACKED",
  "DISPATCHED",
  "DELIVERED",
  "ACKNOWLEDGED",
  "CANCELLED",
];

/**
 * Legal successors for each state.
 *
 * ── The shape, and what it forbids ──────────────────────────────────────────
 * The happy path is a straight line, and every state has exactly one forward
 * move. There is deliberately no "skip ahead" edge — not even
 * CONFIRMED → DISPATCHED, which ops will eventually ask for on a day the
 * packing step was done off-system. Allowing it would make PACKED optional,
 * and an optional state is one the SLA report cannot rely on. The answer to
 * that request is two clicks, not a wider graph.
 *
 * There are no backward edges either. A request that was marked DISPATCHED in
 * error is not un-dispatched; the record of what was claimed, and when, is the
 * point of keeping it. Correcting a mistake is CANCELLED plus a new request,
 * which leaves both facts visible.
 *
 * ── Where cancellation is allowed ───────────────────────────────────────────
 * From any state that has not physically left the building. Once DISPATCHED,
 * stock is with a courier and the honest terminal states are DELIVERED or a
 * human writing a note — "cancelled" would assert that nothing shipped.
 *
 * ACKNOWLEDGED and CANCELLED are terminal.
 */
const TRANSITIONS: Record<FulfilmentStatus, readonly FulfilmentStatus[]> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: [],
  CANCELLED: [],
};

/**
 * The timestamp column each state stamps on entry.
 *
 * REQUESTED is absent because `requestedAt` is written at creation, not by a
 * transition — a request cannot transition INTO the state it was born in.
 */
export const STATUS_TIMESTAMP_COLUMN: Record<
  Exclude<FulfilmentStatus, "REQUESTED">,
  string
> = {
  CONFIRMED: "confirmedAt",
  PACKED: "packedAt",
  DISPATCHED: "dispatchedAt",
  DELIVERED: "deliveredAt",
  ACKNOWLEDGED: "acknowledgedAt",
  CANCELLED: "cancelledAt",
};

export function isFulfilmentStatus(value: unknown): value is FulfilmentStatus {
  return (
    typeof value === "string" &&
    (FULFILMENT_STATUSES as readonly string[]).includes(value)
  );
}

export type TransitionVerdict =
  | { ok: true }
  | { ok: false; reason: "terminal" | "illegal"; allowed: readonly FulfilmentStatus[] };

/**
 * May a request in `from` move to `to`?
 *
 * A no-op transition (`from === to`) is rejected as illegal rather than
 * silently accepted. Two operators pressing "Mark packed" on the same request
 * is a real race, and answering the second one "already packed" is more useful
 * than answering "done" and stamping `packedAt` twice — the second stamp would
 * overwrite the first with a later time, quietly moving the timestamp ops
 * measures against.
 */
export function canTransition(
  from: FulfilmentStatus,
  to: FulfilmentStatus,
): TransitionVerdict {
  const allowed = TRANSITIONS[from];
  if (allowed.length === 0) return { ok: false, reason: "terminal", allowed };
  if (!allowed.includes(to)) return { ok: false, reason: "illegal", allowed };
  return { ok: true };
}

/** The forward moves available from a state, for rendering ops controls. */
export function allowedTransitions(
  from: FulfilmentStatus,
): readonly FulfilmentStatus[] {
  return TRANSITIONS[from];
}

/** Terminal states need no controls and no SLA clock. */
export function isTerminal(status: FulfilmentStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * States where the clinic is still waiting on Ops.
 *
 * Used by the action centre to count what needs a human. DELIVERED is included
 * because it is waiting on the CLINIC to acknowledge receipt, which is still an
 * open loop — just one owned by the other side.
 */
export function isOpen(status: FulfilmentStatus): boolean {
  return status !== "ACKNOWLEDGED" && status !== "CANCELLED";
}

/** Ops vocabulary for one state. Kept out of components so both the admin
 *  table and the doctor's journey strip say the same word. */
export const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered to clinic",
  ACKNOWLEDGED: "Received by clinic",
  CANCELLED: "Cancelled",
};

/** The verb for the control that performs each move. */
export const TRANSITION_LABEL: Record<FulfilmentStatus, string> = {
  REQUESTED: "Reopen",
  CONFIRMED: "Confirm request",
  PACKED: "Mark packed",
  DISPATCHED: "Mark dispatched",
  DELIVERED: "Mark delivered",
  ACKNOWLEDGED: "Confirm receipt",
  CANCELLED: "Cancel",
};
