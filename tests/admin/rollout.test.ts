import { describe, it, expect } from "vitest";
import {
  deriveRolloutChecklist,
  MILESTONE_KEYS,
  type MilestoneKey,
  type MilestoneSignoff,
  type RolloutSignals,
} from "@/lib/admin/opsDashboard/rollout";

// A clinic that is demonstrably working, so each test overrides the one signal
// under examination. No manual sign-offs unless a test adds them.
function signals(overrides: Partial<RolloutSignals> = {}): RolloutSignals {
  return {
    authReadable: true,
    anyDoctorSignedIn: true,
    doctorCount: 2,
    branchesWithQrHandle: 2,
    branchCount: 2,
    assessmentsTotal: 10,
    consultationsTotal: 8,
    dossiersReady: 5,
    kitDecisions: 3,
    deliveryState: "CONNECTED",
    reportsDelivered: 4,
    ...overrides,
  };
}

const NONE = new Map<MilestoneKey, MilestoneSignoff>();

function signoff(overrides: Partial<MilestoneSignoff> = {}): MilestoneSignoff {
  return {
    outcome: "VERIFIED",
    evidence: "watched it work",
    notes: null,
    actorName: "Super Admin",
    actorRole: "SUPER_ADMIN",
    signedOffAt: "2026-11-05T00:00:00.000Z",
    ...overrides,
  };
}

function item(checklist: ReturnType<typeof deriveRolloutChecklist>, key: MilestoneKey) {
  const found = checklist.items.find((i) => i.key === key);
  if (!found) throw new Error(`missing item ${key}`);
  return found;
}

describe("deriveRolloutChecklist — shape", () => {
  it("returns one item per milestone, in order", () => {
    const c = deriveRolloutChecklist(signals(), NONE, "CONNECTED");
    expect(c.items.map((i) => i.key)).toEqual([...MILESTONE_KEYS]);
    expect(c.total).toBe(MILESTONE_KEYS.length);
  });
});

describe("deriveRolloutChecklist — a linked identity is not a login", () => {
  it("DOCTOR_LOGIN auto-satisfies only on a recorded sign-in", () => {
    const yes = item(deriveRolloutChecklist(signals({ anyDoctorSignedIn: true }), NONE, "CONNECTED"), "DOCTOR_LOGIN");
    expect(yes.autoState).toBe("SATISFIED");
    expect(yes.status).toBe("AUTO_SATISFIED");

    const no = item(deriveRolloutChecklist(signals({ anyDoctorSignedIn: false }), NONE, "CONNECTED"), "DOCTOR_LOGIN");
    expect(no.autoState).toBe("NOT_SATISFIED");
    expect(no.status).toBe("NOT_STARTED");
  });

  it("is UNKNOWN (never a confident pass/fail) when sign-in telemetry is unreadable", () => {
    const u = item(
      deriveRolloutChecklist(signals({ authReadable: false, anyDoctorSignedIn: false }), NONE, "CONNECTED"),
      "DOCTOR_LOGIN",
    );
    expect(u.autoState).toBe("UNKNOWN");
    expect(u.status).toBe("UNKNOWN");
  });
});

describe("deriveRolloutChecklist — a QR route is not a scan; pilot is a judgement", () => {
  it("BRANCH_QR and PILOT_ACCEPTANCE are manual-only and never auto-satisfy", () => {
    const c = deriveRolloutChecklist(signals(), NONE, "CONNECTED");
    const qr = item(c, "BRANCH_QR");
    const pilot = item(c, "PILOT_ACCEPTANCE");
    expect(qr.manualOnly).toBe(true);
    expect(qr.autoState).toBe("REQUIRES_MANUAL");
    expect(qr.status).toBe("NOT_STARTED");
    expect(pilot.manualOnly).toBe(true);
    expect(pilot.autoState).toBe("REQUIRES_MANUAL");
    // The auto-evidence still reports branch QR-handle coverage as context.
    expect(qr.autoEvidence).toMatch(/2\/2/);
  });

  it("a manual VERIFIED sign-off makes a manual-only milestone done", () => {
    const signoffs = new Map<MilestoneKey, MilestoneSignoff>([["BRANCH_QR", signoff()]]);
    const qr = item(deriveRolloutChecklist(signals(), signoffs, "CONNECTED"), "BRANCH_QR");
    expect(qr.status).toBe("VERIFIED");
    expect(qr.signoff?.evidence).toBe("watched it work");
  });
});

describe("deriveRolloutChecklist — WhatsApp delivery is provider-confirmed", () => {
  it("auto-satisfies on a confirmed delivery", () => {
    const d = item(deriveRolloutChecklist(signals({ reportsDelivered: 2 }), NONE, "CONNECTED"), "WHATSAPP_DELIVERY");
    expect(d.status).toBe("AUTO_SATISFIED");
  });
  it("is NOT_STARTED with zero confirmed deliveries", () => {
    const d = item(deriveRolloutChecklist(signals({ reportsDelivered: 0 }), NONE, "CONNECTED"), "WHATSAPP_DELIVERY");
    expect(d.autoState).toBe("NOT_SATISFIED");
    expect(d.status).toBe("NOT_STARTED");
  });
  it("is UNKNOWN when delivery is not connected (never a fabricated zero)", () => {
    const d = item(
      deriveRolloutChecklist(signals({ deliveryState: "NOT_CONNECTED", reportsDelivered: null }), NONE, "CONNECTED"),
      "WHATSAPP_DELIVERY",
    );
    expect(d.autoState).toBe("UNKNOWN");
    expect(d.status).toBe("UNKNOWN");
  });
});

describe("deriveRolloutChecklist — manual sign-off is authoritative", () => {
  it("VERIFIED overrides an auto NOT_SATISFIED", () => {
    const signoffs = new Map<MilestoneKey, MilestoneSignoff>([["FIRST_ASSESSMENT", signoff()]]);
    const a = item(deriveRolloutChecklist(signals({ assessmentsTotal: 0 }), signoffs, "CONNECTED"), "FIRST_ASSESSMENT");
    expect(a.autoState).toBe("NOT_SATISFIED");
    expect(a.status).toBe("VERIFIED");
  });
  it("FAILED and BLOCKED become ATTENTION", () => {
    for (const outcome of ["FAILED", "BLOCKED"] as const) {
      const signoffs = new Map<MilestoneKey, MilestoneSignoff>([["FIRST_REPORT", signoff({ outcome })]]);
      const r = item(deriveRolloutChecklist(signals(), signoffs, "CONNECTED"), "FIRST_REPORT");
      expect(r.status).toBe("ATTENTION");
    }
  });
  it("NOT_APPLICABLE is its own status", () => {
    const signoffs = new Map<MilestoneKey, MilestoneSignoff>([["KIT_REVIEW", signoff({ outcome: "NOT_APPLICABLE" })]]);
    const r = item(deriveRolloutChecklist(signals(), signoffs, "CONNECTED"), "KIT_REVIEW");
    expect(r.status).toBe("NOT_APPLICABLE");
  });
});

describe("deriveRolloutChecklist — auto evidence from data", () => {
  it("FIRST_CONSULTATION / FIRST_REPORT / KIT_REVIEW reflect their signals", () => {
    const empty = deriveRolloutChecklist(
      signals({ consultationsTotal: 0, dossiersReady: 0, kitDecisions: 0 }),
      NONE,
      "CONNECTED",
    );
    expect(item(empty, "FIRST_CONSULTATION").autoState).toBe("NOT_SATISFIED");
    expect(item(empty, "FIRST_REPORT").autoState).toBe("NOT_SATISFIED");
    expect(item(empty, "KIT_REVIEW").autoState).toBe("NOT_SATISFIED");

    const full = deriveRolloutChecklist(signals(), NONE, "CONNECTED");
    expect(item(full, "FIRST_CONSULTATION").autoState).toBe("SATISFIED");
    expect(item(full, "FIRST_REPORT").autoState).toBe("SATISFIED");
    expect(item(full, "KIT_REVIEW").autoState).toBe("SATISFIED");
  });
});

describe("deriveRolloutChecklist — sign-off storage capability", () => {
  it("ignores sign-offs and shows auto state when storage is NOT_CONNECTED", () => {
    const signoffs = new Map<MilestoneKey, MilestoneSignoff>([["PILOT_ACCEPTANCE", signoff()]]);
    const c = deriveRolloutChecklist(signals(), signoffs, "NOT_CONNECTED");
    const pilot = item(c, "PILOT_ACCEPTANCE");
    expect(pilot.signoff).toBeNull();
    expect(pilot.status).toBe("NOT_STARTED");
    expect(c.signoffState).toBe("NOT_CONNECTED");
  });
});

describe("deriveRolloutChecklist — tallies", () => {
  it("counts verified and attention items", () => {
    const signoffs = new Map<MilestoneKey, MilestoneSignoff>([
      ["DOCTOR_LOGIN", signoff()],
      ["BRANCH_QR", signoff()],
      ["FIRST_REPORT", signoff({ outcome: "BLOCKED" })],
    ]);
    const c = deriveRolloutChecklist(signals(), signoffs, "CONNECTED");
    expect(c.verifiedCount).toBe(2);
    expect(c.attentionCount).toBe(1);
  });
});
