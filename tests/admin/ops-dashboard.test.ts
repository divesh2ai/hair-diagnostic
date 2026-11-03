import { describe, it, expect } from "vitest";
import { classifyClinic, toGatedKpi, type ClassifyInput } from "@/lib/admin/opsDashboard/classify";
import { resolveWindow } from "@/lib/admin/opsDashboard/window";
import { STATUS_LABEL, formatInrFromMinor, relativeTime } from "@/lib/admin/opsDashboard/format";

// A healthy, actively-using clinic as the baseline; each test overrides the
// one fact under examination.
const NOW = new Date("2026-02-01T12:00:00.000Z");
function base(overrides: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    status: "ACTIVE",
    doctorCount: 2,
    signedInCount: 1,
    authReadable: true,
    assessmentsAllTime: 10,
    approvalsAllTime: 5,
    awaitingReview: 0,
    deliveryConnected: true,
    reportsFailed: 0,
    reportsSent: 5,
    reportsAvailable: 5,
    lastActivityAt: new Date("2026-01-28T00:00:00.000Z"), // 4 days before NOW
    now: NOW,
    ...overrides,
  };
}

describe("classifyClinic — adoption is not activation", () => {
  it("an ACTIVE clinic that nobody has used is NOT actively using", () => {
    const { flags, primaryStatus } = classifyClinic(
      base({ assessmentsAllTime: 0, approvalsAllTime: 0, signedInCount: 0, reportsSent: 0, reportsAvailable: 0 }),
    );
    expect(flags.activelyUsing).toBe(false);
    // ClinicStatus.ACTIVE does not make it "Actively using HairOS".
    expect(primaryStatus).not.toBe("ACTIVELY_USING");
  });

  it("a fully-adopted clinic is activelyUsing", () => {
    const { flags, primaryStatus } = classifyClinic(base());
    expect(flags.activelyUsing).toBe(true);
    expect(primaryStatus).toBe("ACTIVELY_USING");
  });
});

describe("classifyClinic — COMPLETED is not APPROVED", () => {
  it("assessments completed but zero approvals ⇒ not actively using, and pending if awaiting", () => {
    // approvalsAllTime is the APPROVED-consultation count, never COMPLETED. A
    // clinic can have many completed assessments and no doctor sign-off.
    const { flags, primaryStatus } = classifyClinic(
      base({ assessmentsAllTime: 20, approvalsAllTime: 0, awaitingReview: 7, reportsAvailable: 0, reportsSent: 0 }),
    );
    expect(flags.activelyUsing).toBe(false);
    expect(flags.pendingReview).toBe(true);
    expect(primaryStatus).toBe("PENDING_REVIEW");
  });
});

describe("classifyClinic — never logged in", () => {
  it("no doctors ⇒ never logged in (regardless of auth readability)", () => {
    const { flags, primaryStatus } = classifyClinic(base({ doctorCount: 0, signedInCount: 0, authReadable: false }));
    expect(flags.neverLoggedIn).toBe(true);
    expect(primaryStatus).toBe("NEVER_LOGGED_IN");
  });

  it("doctors exist but none signed in, auth readable ⇒ never logged in", () => {
    const { flags } = classifyClinic(base({ signedInCount: 0 }));
    expect(flags.neverLoggedIn).toBe(true);
  });

  it("doctors exist, auth NOT readable ⇒ not asserted as never logged in (unknown)", () => {
    const { flags } = classifyClinic(base({ signedInCount: 0, authReadable: false }));
    expect(flags.neverLoggedIn).toBe(false);
  });
});

describe("classifyClinic — delivery attention only when connected", () => {
  it("failed sends with delivery connected ⇒ attention", () => {
    const { flags } = classifyClinic(base({ reportsFailed: 2 }));
    expect(flags.reportDeliveryAttention).toBe(true);
  });

  it("the same failures with delivery NOT connected ⇒ no attention asserted", () => {
    const { flags } = classifyClinic(base({ reportsFailed: 2, deliveryConnected: false }));
    expect(flags.reportDeliveryAttention).toBe(false);
  });

  it("approved reports but none sent (connected) ⇒ attention", () => {
    const { flags } = classifyClinic(base({ reportsAvailable: 3, reportsSent: 0 }));
    expect(flags.reportDeliveryAttention).toBe(true);
  });
});

describe("classifyClinic — recency and lifecycle", () => {
  it("activity older than 30 days ⇒ not actively using", () => {
    const { flags } = classifyClinic(base({ lastActivityAt: new Date("2025-12-01T00:00:00.000Z") }));
    expect(flags.activelyUsing).toBe(false);
  });

  it("archived clinics carry no operational flags and chip ARCHIVED", () => {
    const { flags, primaryStatus } = classifyClinic(base({ status: "ARCHIVED" }));
    expect(primaryStatus).toBe("ARCHIVED");
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
  });

  it("suspended clinics chip SUSPENDED ahead of operational facets", () => {
    const { primaryStatus } = classifyClinic(base({ status: "SUSPENDED", awaitingReview: 3 }));
    expect(primaryStatus).toBe("SUSPENDED");
  });

  it("pending review outranks delivery attention in the primary chip", () => {
    const { primaryStatus } = classifyClinic(base({ awaitingReview: 2, reportsFailed: 2 }));
    expect(primaryStatus).toBe("PENDING_REVIEW");
  });
});

describe("toGatedKpi — a kit intent is never a paid order; absent data is never zero", () => {
  it("NOT_CONNECTED yields null figures, not 0", () => {
    const k = toGatedKpi("NOT_CONNECTED", 0, 0);
    expect(k.state).toBe("NOT_CONNECTED");
    expect(k.today).toBeNull();
    expect(k.allTime).toBeNull();
  });

  it("CONNECTED carries the real figures", () => {
    const k = toGatedKpi("CONNECTED", 1, 9);
    expect(k).toEqual({ state: "CONNECTED", today: 1, allTime: 9 });
  });
});

describe("resolveWindow — Asia/Kolkata day boundaries", () => {
  it("defaults to today", () => {
    const w = resolveWindow(null, null);
    expect(w.label).toBe("Today");
    expect(new Date(w.fromIso).getTime()).toBeLessThan(new Date(w.toIso).getTime());
  });

  it("an explicit single day maps to IST midnight → next IST midnight", () => {
    const w = resolveWindow("2026-01-01", "2026-01-01");
    // 2026-01-01 00:00 IST = 2025-12-31T18:30:00Z; exclusive end = 2026-01-02 00:00 IST.
    expect(w.fromIso).toBe("2025-12-31T18:30:00.000Z");
    expect(w.toIso).toBe("2026-01-01T18:30:00.000Z");
  });

  it("a reversed range is swapped, not errored", () => {
    const forward = resolveWindow("2026-01-01", "2026-01-03");
    const reversed = resolveWindow("2026-01-03", "2026-01-01");
    expect(reversed.fromIso).toBe(forward.fromIso);
    expect(reversed.toIso).toBe(forward.toIso);
    expect(forward.label).toContain("–");
  });
});

describe("format helpers", () => {
  it("every primary status has a human label", () => {
    for (const key of Object.keys(STATUS_LABEL)) {
      expect(STATUS_LABEL[key as keyof typeof STATUS_LABEL]).toBeTruthy();
    }
  });

  it("paise format to whole rupees", () => {
    expect(formatInrFromMinor(334700)).toBe("₹3,347");
  });

  it("relativeTime handles null", () => {
    expect(relativeTime(null)).toBe("—");
  });
});
