import { describe, it, expect, vi, beforeEach } from "vitest";

// The three-state journey model, under failure.
//
// ══ THE DEFECT THIS GUARDS ══════════════════════════════════════════════════
//
// "We could not check whether the report was sent" and "the report was not
// sent" are different facts that a two-state UI renders identically. A doctor
// shown the second sends the report again — a second clinical message to a
// real patient, caused by a database read failing.
//
// So every stage that cannot be read must resolve to `unavailable`, never to
// `pending`. This is the state the whole workflow was in before the migration
// was applied, and it is the state any deployment falls back to if a table
// becomes unreadable, so it has to be correct rather than incidental.
//
// Mocked at the STORE boundary — the three modules that talk to the
// post-approval tables — because that is exactly where a missing table or a
// lost connection actually surfaces.

const NOT_PROVISIONED = "not provisioned";

vi.mock("@/lib/delivery/deliveryStore", () => ({
  readLatestDeliveries: vi.fn(async () => {
    throw new Error(NOT_PROVISIONED);
  }),
}));

vi.mock("@/lib/payments/paymentStore", () => ({
  readPaymentByIntent: vi.fn(async () => {
    throw new Error(NOT_PROVISIONED);
  }),
}));

vi.mock("@/lib/fulfilment/fulfilmentStore", () => ({
  readFulfilmentByIntent: vi.fn(async () => {
    throw new Error(NOT_PROVISIONED);
  }),
  readFulfilmentMode: vi.fn(async () => {
    throw new Error(NOT_PROVISIONED);
  }),
  readTreatmentStart: vi.fn(async () => {
    throw new Error(NOT_PROVISIONED);
  }),
}));

// An approved case carrying an order, so every downstream stage is genuinely
// applicable and the only reason a stage could be non-`done` is the failure.
vi.mock("@/lib/consultation/approvedOrder", () => ({
  resolveApprovedOrder: vi.fn(async () => ({
    intentId: "intent-1",
    status: "READY_FOR_FULFILMENT",
    kitIds: ["K1"],
    quantities: null,
    consultationId: "consultation-1",
    consultationVersionId: "version-1",
    contentVersion: 1,
  })),
}));

vi.mock("@/lib/journey/events", () => ({
  readPatientOpens: vi.fn(async () => ({
    firstOpenedAt: null,
    lastOpenedAt: null,
    openCount: 0,
  })),
  tokenFingerprint: vi.fn(() => "deadbeefcafe"),
  recordPatientOpen: vi.fn(async () => ({ recorded: false })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    assessment: {
      findUnique: vi.fn(async () => ({
        completedAt: new Date("2026-08-01T00:00:00.000Z"),
        submittedAt: new Date("2026-08-01T00:00:00.000Z"),
        status: "COMPLETED",
      })),
    },
    consultation: {
      findUnique: vi.fn(async () => ({
        currentVersion: {
          approvalStatus: "APPROVED",
          approvedAt: new Date("2026-08-02T00:00:00.000Z"),
          approvedBy: "doctor-1",
        },
      })),
    },
  },
}));

import { resolveJourney } from "@/lib/journey/resolveJourney";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("patient journey under store failure", () => {
  it("reports UNAVAILABLE for every unreadable stage — never 'pending'", async () => {
    const journey = await resolveJourney("assessment-1");
    const state = (stage: string) =>
      journey.steps.find((s) => s.stage === stage)?.state;

    // The stages backed by the failing stores.
    expect(state("REPORT_SENT")).toBe("unavailable");
    expect(state("CART_SENT")).toBe("unavailable");
    expect(state("CHECKOUT_STARTED")).toBe("unavailable");
    expect(state("PAID")).toBe("unavailable");
    expect(state("FULFILMENT_REQUESTED")).toBe("unavailable");
    expect(state("TREATMENT_STARTED")).toBe("unavailable");

    // None of them may be reported as an outstanding action.
    for (const stage of [
      "REPORT_SENT",
      "CART_SENT",
      "CHECKOUT_STARTED",
      "PAID",
      "FULFILMENT_REQUESTED",
      "TREATMENT_STARTED",
    ]) {
      expect(state(stage)).not.toBe("pending");
    }
  });

  it("does not throw — a summary panel cannot take down the review page", async () => {
    await expect(resolveJourney("assessment-1")).resolves.toBeTruthy();
  });

  it("names which dependencies failed, so the failure is diagnosable", async () => {
    const journey = await resolveJourney("assessment-1");
    // Not a bare `catch {}`: a silent null and a genuinely absent row are
    // different facts and only one is worth waking someone for.
    expect(journey.degraded).toEqual(
      expect.arrayContaining(["delivery", "payment", "fulfilment", "treatment"]),
    );
  });

  it("still reports the stages it CAN read", async () => {
    const journey = await resolveJourney("assessment-1");
    const state = (stage: string) =>
      journey.steps.find((s) => s.stage === stage)?.state;
    // Degradation is per-stage. The clinical facts, which come from tables that
    // are fine, are still stated.
    expect(state("ASSESSMENT_COMPLETED")).toBe("done");
    expect(state("DOCTOR_APPROVED")).toBe("done");
  });

  it("never claims a lifecycle it cannot substantiate", async () => {
    const journey = await resolveJourney("assessment-1");
    // With payment and fulfilment unreadable, the deepest PROVEN fact is the
    // doctor's approval. It must not report PAID or FULFILLED on absent data.
    expect(journey.cartLifecycle).toBe("DOCTOR_APPROVED");
  });
});
