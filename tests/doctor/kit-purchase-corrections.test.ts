import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isSameEventPayload,
  purchaseEventIdempotencyKey,
  type EventPayloadIdentity,
} from "@/lib/commerce/kitPurchaseModel";

// Regression guards for the Step-1 corrections. The behavioural guarantees that
// need a database (association, idempotency conflict, read-only GET) are locked
// in two ways: the pure idempotency comparison is unit-tested directly, and the
// route/store source is asserted to keep the server-side enforcement that the
// corrections added (the same source-contract style as
// tests/post-approval/route-access-contracts and tests/api/doctor-route-scope).

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const PURCHASE_ROUTE = "apps/patient-portal/src/app/api/doctor/orders/[intentId]/purchase/route.ts";
const NOTES_ROUTE = "apps/patient-portal/src/app/api/doctor/consultation-notes/route.ts";
const PURCHASE_STORE = "apps/patient-portal/src/lib/commerce/purchaseStore.ts";
const HISTORY_ROUTE = "apps/patient-portal/src/app/api/doctor/patients/[id]/treatment-history/route.ts";
const TRACKER = "apps/patient-portal/src/components/doctor/KitPurchaseTracker.tsx";

describe("idempotency payload comparison (incl. date + reason)", () => {
  const base: EventPayloadIdentity = {
    eventType: "PURCHASE_CONFIRMED_BY_CLINIC",
    boxes: 1,
    saleValueMinor: null,
    occurredAt: "2026-10-23",
    note: "paid at counter",
  };
  it("identical replay is the same payload", () => {
    expect(isSameEventPayload(base, { ...base })).toBe(true);
    // A date vs its midnight ISO compare equal (date granularity).
    expect(isSameEventPayload(base, { ...base, occurredAt: "2026-10-23T00:00:00.000Z" })).toBe(true);
    // Note compared trimmed.
    expect(isSameEventPayload(base, { ...base, note: "  paid at counter  " })).toBe(true);
  });
  it("same key, different action is a conflict — type, boxes, sale, DATE or REASON", () => {
    expect(isSameEventPayload(base, { ...base, boxes: 2 })).toBe(false);
    expect(isSameEventPayload(base, { ...base, eventType: "DISPENSED" })).toBe(false);
    expect(isSameEventPayload(base, { ...base, saleValueMinor: 5000 })).toBe(false);
    expect(isSameEventPayload(base, { ...base, occurredAt: "2026-10-24" })).toBe(false);
    expect(isSameEventPayload(base, { ...base, note: "insurance" })).toBe(false);
  });
});

describe("stable idempotency key — duplicate network submissions de-duplicate", () => {
  const action = {
    kitId: "HAIR FACT TE GOLD",
    eventType: "PURCHASE_CONFIRMED_BY_CLINIC" as const,
    boxes: 1,
    occurredAt: "2026-10-23",
    reason: "paid at counter",
  };
  it("the SAME action yields the SAME key on every retry", () => {
    const k1 = purchaseEventIdempotencyKey(action);
    const k2 = purchaseEventIdempotencyKey({ ...action });
    // A midnight-ISO date is keyed the same as its date (date granularity).
    const k3 = purchaseEventIdempotencyKey({ ...action, occurredAt: "2026-10-23T00:00:00.000Z" });
    expect(k1).toBe(k2);
    expect(k1).toBe(k3);
    expect(k1).toMatch(/^evt_[0-9a-f]{16}$/);
  });
  it("a DIFFERENT action (date, reason, boxes or type) yields a different key", () => {
    const k = purchaseEventIdempotencyKey(action);
    expect(purchaseEventIdempotencyKey({ ...action, occurredAt: "2026-11-01" })).not.toBe(k);
    expect(purchaseEventIdempotencyKey({ ...action, reason: "insurance" })).not.toBe(k);
    expect(purchaseEventIdempotencyKey({ ...action, boxes: 2 })).not.toBe(k);
    expect(purchaseEventIdempotencyKey({ ...action, eventType: "DISPENSED" })).not.toBe(k);
    expect(purchaseEventIdempotencyKey({ ...action, kitId: "IRON UP GOLD" })).not.toBe(k);
  });
});

describe("purchase route — server-side enforcement is present", () => {
  const src = read(PURCHASE_ROUTE);
  const getBody = src.slice(
    src.indexOf("export async function GET"),
    src.indexOf("export async function POST"),
  );

  it("GET is read-only: it does not materialise lines or append events", () => {
    expect(getBody).not.toContain("ensureLines");
    expect(getBody).not.toContain("ensurePurchaseLines");
    expect(getBody).not.toContain("appendPurchaseEvent");
    expect(getBody).not.toContain("setLineStatus");
  });
  it("rejects a governed price supplied by the client", () => {
    expect(src).toContain("catalog_price_is_server_resolved");
  });
  it("requires a stable idempotency key", () => {
    expect(src).toContain("clientEventId_required");
  });
  it("resolves governed prices server-side via the pricing engine", () => {
    expect(src).toContain("buildDoctorOrderPricing");
    expect(src).toContain("governedUnitMinor");
  });
  it("rejects a kit that is not on this order", () => {
    expect(src).toContain("kit_not_on_order");
    expect(src).toContain("intent.kitIds.includes");
  });
  it("records provenance for governed price vs offline sale value", () => {
    expect(src).toContain("GOVERNED_SERVER");
    expect(src).toContain("CLINIC_OFFLINE");
  });
});

describe("notes route — visit/consultation linkage is validated", () => {
  const src = read(NOTES_ROUTE);
  it("rejects an assessment that is not this patient's / clinic's", () => {
    expect(src).toContain("assessment_mismatch");
    expect(src).toContain("patientId: body.patientId");
  });
  it("rejects a consultation that is not this patient's / clinic's", () => {
    expect(src).toContain("consultation_mismatch");
  });
});

describe("purchase store — writes are scoped to the owning order", () => {
  const src = read(PURCHASE_STORE);
  it("line lookups and status updates include kitOrderIntentId in the WHERE", () => {
    // Both readLine and setLineStatus must constrain by the owning order, not
    // clinic alone, so a line id from another order in the same clinic is
    // rejected.
    const matches = src.match(/AND "kitOrderIntentId" =/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3); // readLine, readLineByKit, setLineStatus
  });
  it("append requires a non-optional clientEventId", () => {
    expect(src).toContain("clientEventId: string;");
    expect(src).toContain("idempotency_conflict");
  });
});

describe("purchase GET reads the exact order, not the whole assessment", () => {
  const src = read(PURCHASE_ROUTE);
  const getBody = src.slice(
    src.indexOf("export async function GET"),
    src.indexOf("export async function POST"),
  );
  it("GET reads lines/events by intent", () => {
    expect(getBody).toContain("listLinesByIntent");
    expect(getBody).toContain("listEventsByIntent");
  });
  it("GET does not read by assessment (which could mix two orders)", () => {
    expect(getBody).not.toContain("listLinesByAssessment");
    expect(getBody).not.toContain("listEventsByAssessment");
  });
  it("the store scopes the by-intent event read through the owning line", () => {
    const store = read(PURCHASE_STORE);
    expect(store).toContain('l."kitOrderIntentId" = ${kitOrderIntentId}');
  });
});

describe("patient treatment history includes approved, unpurchased kits", () => {
  const src = read(HISTORY_ROUTE);
  it("sources recommendations from approved orders, not only the ledger", () => {
    expect(src).toContain("listPatientApprovedOrders");
    expect(src).toContain("order.kits");
  });
  it("still returns recommendations when the ledger is empty or unprovisioned", () => {
    // The ledger read is wrapped so a missing ledger does not blank the history.
    expect(src).toContain("PurchaseNotProvisionedError");
    expect(src).toMatch(/let lines[^\n]*=\s*\[\]/);
  });
});

describe("tracker uses the stable idempotency key, not a random one", () => {
  const src = read(TRACKER);
  it("derives the key from the action via purchaseEventIdempotencyKey", () => {
    expect(src).toContain("purchaseEventIdempotencyKey");
  });
  it("does not mint a fresh random key per submit", () => {
    expect(src).not.toContain("crypto.randomUUID()");
  });
});
