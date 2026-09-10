import { describe, it, expect } from "vitest";
import {
  FULFILMENT_STATUSES,
  allowedTransitions,
  canTransition,
  isFulfilmentStatus,
  isOpen,
  isTerminal,
  STATUS_TIMESTAMP_COLUMN,
  type FulfilmentStatus,
} from "@/lib/fulfilment/stateMachine";
import {
  requiresClinicFulfilment,
  resolveFulfilmentMode,
  WAVE_0_DEFAULT_MODE,
} from "@/lib/fulfilment/fulfilmentMode";

// The state machine is the guarantee that a fulfilment record's timestamps
// mean what an ops reconciliation assumes they mean. A request that can jump
// to DELIVERED has a `deliveredAt` that proves nothing.

describe("fulfilment state machine", () => {
  describe("the happy path", () => {
    it("walks REQUESTED → CONFIRMED → PACKED → DISPATCHED → DELIVERED → ACKNOWLEDGED", () => {
      const path: FulfilmentStatus[] = [
        "REQUESTED",
        "CONFIRMED",
        "PACKED",
        "DISPATCHED",
        "DELIVERED",
        "ACKNOWLEDGED",
      ];
      for (let i = 0; i < path.length - 1; i++) {
        expect(canTransition(path[i], path[i + 1]).ok).toBe(true);
      }
    });
  });

  describe("skipping steps — the defect this exists to prevent", () => {
    it("REJECTS REQUESTED → DELIVERED", () => {
      const v = canTransition("REQUESTED", "DELIVERED");
      expect(v.ok).toBe(false);
      if (!v.ok) {
        expect(v.reason).toBe("illegal");
        expect(v.allowed).toEqual(["CONFIRMED", "CANCELLED"]);
      }
    });

    it("REJECTS REQUESTED → ACKNOWLEDGED", () => {
      expect(canTransition("REQUESTED", "ACKNOWLEDGED").ok).toBe(false);
    });

    it("REJECTS CONFIRMED → DISPATCHED, even though ops will ask for it", () => {
      // Deliberate. Allowing it would make PACKED optional, and an optional
      // state is one the SLA report cannot rely on.
      expect(canTransition("CONFIRMED", "DISPATCHED").ok).toBe(false);
    });

    it("REJECTS DELIVERED → DISPATCHED and every other backward move", () => {
      expect(canTransition("DELIVERED", "DISPATCHED").ok).toBe(false);
      expect(canTransition("PACKED", "CONFIRMED").ok).toBe(false);
      expect(canTransition("DISPATCHED", "PACKED").ok).toBe(false);
      expect(canTransition("CONFIRMED", "REQUESTED").ok).toBe(false);
    });
  });

  describe("no-op transitions", () => {
    it("REJECTS a state moving to itself", () => {
      // Two operators pressing "Mark packed" on the same row is a real race.
      // Accepting the second would restamp packedAt with a later time, quietly
      // moving the instant ops measures against.
      for (const s of FULFILMENT_STATUSES) {
        expect(canTransition(s, s).ok).toBe(false);
      }
    });
  });

  describe("terminal states", () => {
    it("lets nothing out of ACKNOWLEDGED or CANCELLED", () => {
      for (const terminal of ["ACKNOWLEDGED", "CANCELLED"] as const) {
        expect(isTerminal(terminal)).toBe(true);
        expect(allowedTransitions(terminal)).toEqual([]);
        for (const to of FULFILMENT_STATUSES) {
          const v = canTransition(terminal, to);
          expect(v.ok).toBe(false);
          if (!v.ok) expect(v.reason).toBe("terminal");
        }
      }
    });

    it("treats every other state as open work", () => {
      expect(isOpen("REQUESTED")).toBe(true);
      // DELIVERED is still open: it is waiting on the CLINIC to confirm
      // receipt, which is what puts it in the action centre.
      expect(isOpen("DELIVERED")).toBe(true);
      expect(isOpen("ACKNOWLEDGED")).toBe(false);
      expect(isOpen("CANCELLED")).toBe(false);
    });
  });

  describe("cancellation", () => {
    it("is available before dispatch and not after", () => {
      expect(canTransition("REQUESTED", "CANCELLED").ok).toBe(true);
      expect(canTransition("CONFIRMED", "CANCELLED").ok).toBe(true);
      expect(canTransition("PACKED", "CANCELLED").ok).toBe(true);
      // Once stock is with a courier, "cancelled" would assert that nothing
      // shipped, which is false.
      expect(canTransition("DISPATCHED", "CANCELLED").ok).toBe(false);
      expect(canTransition("DELIVERED", "CANCELLED").ok).toBe(false);
    });
  });

  describe("structural invariants", () => {
    it("gives every non-initial state a timestamp column", () => {
      // The SQL writer looks the column up in this table rather than deriving
      // it from the target, so a missing entry would be a silent no-op write.
      for (const s of FULFILMENT_STATUSES) {
        if (s === "REQUESTED") continue;
        expect(
          STATUS_TIMESTAMP_COLUMN[s as keyof typeof STATUS_TIMESTAMP_COLUMN],
        ).toBeTruthy();
      }
    });

    it("never allows a transition INTO REQUESTED", () => {
      // A request cannot be re-born; `requestedAt` is written at creation and
      // there is no column for a second one.
      for (const s of FULFILMENT_STATUSES) {
        expect(canTransition(s, "REQUESTED").ok).toBe(false);
      }
    });

    it("only recognises real statuses", () => {
      expect(isFulfilmentStatus("PACKED")).toBe(true);
      expect(isFulfilmentStatus("packed")).toBe(false);
      expect(isFulfilmentStatus("SHIPPED")).toBe(false);
      expect(isFulfilmentStatus(null)).toBe(false);
      expect(isFulfilmentStatus(undefined)).toBe(false);
      expect(isFulfilmentStatus(7)).toBe(false);
    });
  });
});

describe("fulfilment mode", () => {
  it("reads an explicitly recorded destination and marks it explicit", () => {
    expect(resolveFulfilmentMode("PATIENT")).toEqual({
      mode: "PATIENT",
      explicit: true,
    });
    expect(resolveFulfilmentMode("CLINIC")).toEqual({
      mode: "CLINIC",
      explicit: true,
    });
  });

  it("defaults an unrecorded destination to the Wave-0 mode, and says it defaulted", () => {
    // `explicit: false` is the part that matters — it is what lets the doctor's
    // journey view say "clinic supply (default)" instead of claiming somebody
    // chose it.
    for (const absent of [null, undefined, "", "NONSENSE"]) {
      const r = resolveFulfilmentMode(absent as string | null);
      expect(r.mode).toBe(WAVE_0_DEFAULT_MODE);
      expect(r.explicit).toBe(false);
    }
  });

  it("creates a clinic fulfilment request for CLINIC and never for PATIENT", () => {
    // The acceptance criterion "a patient-delivery order creates no clinic
    // fulfilment request" is exactly this predicate.
    expect(requiresClinicFulfilment("CLINIC")).toBe(true);
    expect(requiresClinicFulfilment("PATIENT")).toBe(false);
  });
});
