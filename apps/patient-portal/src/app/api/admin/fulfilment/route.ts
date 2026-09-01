import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import {
  FULFILMENT_NOT_PROVISIONED,
  FulfilmentNotProvisionedError,
  listFulfilments,
} from "@/lib/fulfilment/fulfilmentStore";
import {
  isFulfilmentStatus,
  type FulfilmentStatus,
} from "@/lib/fulfilment/stateMachine";

// GET /api/admin/fulfilment?status=REQUESTED,CONFIRMED&clinicId=…
//
// The Ops fulfilment queue. Super Admin only.
//
// ── What this returns, and what it deliberately does not ────────────────────
// Clinic, doctor, order reference, kit COUNT, payment state and fulfilment
// state. No patient name, no phone, no kit lineup, no clinical content.
//
// Ops packs boxes; they do not need — and should not casually hold — the
// clinical record of every patient in the network. The kit lineup lives on
// KitOrderIntent and is reachable from the order reference by someone who
// genuinely needs it, which makes that access a deliberate act rather than a
// side effect of opening a queue.

export const dynamic = "force-dynamic";

/**
 * Default view: everything still moving.
 *
 * ACKNOWLEDGED and CANCELLED are excluded because they are terminal — a queue
 * that accumulates every completed order forever is one operators stop reading
 * within a month. They remain reachable with an explicit `?status=`.
 */
const OPEN_STATUSES: readonly FulfilmentStatus[] = [
  "REQUESTED",
  "CONFIRMED",
  "PACKED",
  "DISPATCHED",
  "DELIVERED",
];

export async function GET(req: Request) {
  try {
    await assertSuperAdmin();
  } catch (err) {
    const response = handleAuthError(err);
    if (response) return response;
    throw err;
  }

  const url = new URL(req.url);

  const rawStatus = url.searchParams.get("status");
  let statuses: readonly FulfilmentStatus[] = OPEN_STATUSES;
  if (rawStatus) {
    const parsed = rawStatus
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(isFulfilmentStatus);
    // An unparseable filter falls back to the default view rather than to "no
    // filter". Silently widening a filter to every row is how a mistyped query
    // string turns a scoped page into a full table scan.
    if (parsed.length > 0) statuses = parsed;
  }

  // Optional tenant narrowing for an operator looking at one clinic. This is a
  // Super Admin surface, so absence means all tenants — which is why the store
  // takes `clinicId: null` explicitly rather than treating undefined as a
  // wildcard.
  const clinicId = url.searchParams.get("clinicId");

  try {
    const rows = await listFulfilments({
      clinicId: clinicId && clinicId.length > 0 ? clinicId : null,
      statuses,
      limit: 200,
    });
    return NextResponse.json({ statuses, items: rows });
  } catch (err) {
    if (err instanceof FulfilmentNotProvisionedError) {
      return NextResponse.json(
        { error: FULFILMENT_NOT_PROVISIONED },
        { status: 503 },
      );
    }
    throw err;
  }
}
