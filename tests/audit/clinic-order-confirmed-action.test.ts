import { describe, it, expect } from "vitest";
import {
  isKnownAuditAction,
  AUDIT_ACTIONS,
} from "../../apps/patient-portal/src/lib/audit/actions";

// The doctor-only Clinic Order confirmation endpoint
// (api/cart/[assessmentId]/confirm/route.ts) writes CLINIC_ORDER_CONFIRMED via
// writeAuditLog, which requires a canonical AuditAction. Registering the event
// in lib/audit/actions.ts is what makes it a valid action at build time (the
// union) AND at runtime (the picker / API validator). This pins that it stays
// registered, so the confirm route keeps type-checking and the event keeps
// being filterable in the audit console.
describe("audit action registry", () => {
  it("recognises the clinic order confirmation event", () => {
    expect(isKnownAuditAction("CLINIC_ORDER_CONFIRMED")).toBe(true);
    expect(AUDIT_ACTIONS).toContain("CLINIC_ORDER_CONFIRMED");
  });
});
