import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSameEventPayload } from "@/lib/commerce/kitPurchaseModel";

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

describe("idempotency payload comparison", () => {
  const base = { eventType: "PURCHASE_CONFIRMED_BY_CLINIC" as const, boxes: 1, saleValueMinor: null };
  it("identical replay is the same payload", () => {
    expect(isSameEventPayload(base, { ...base })).toBe(true);
    expect(isSameEventPayload(base, { eventType: "PURCHASE_CONFIRMED_BY_CLINIC", boxes: 1, saleValueMinor: null })).toBe(true);
  });
  it("same key, different action is a conflict", () => {
    expect(isSameEventPayload(base, { ...base, boxes: 2 })).toBe(false);
    expect(isSameEventPayload(base, { ...base, eventType: "DISPENSED" })).toBe(false);
    expect(isSameEventPayload(base, { ...base, saleValueMinor: 5000 })).toBe(false);
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
