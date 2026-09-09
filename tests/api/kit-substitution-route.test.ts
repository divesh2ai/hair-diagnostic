// POST /api/consultation/[assessmentId]/kit-substitution contract tests.
//
// This is the ONLY path a budget substitution can reach a Consultation
// through, and it is the enforcement point for the one rule the feature
// exists for: canonicalKitId + alternativeKitId must be the EXACT approved
// pair (lib/commerce/budgetSubstitution.ts), and price is ALWAYS resolved
// server-side, never accepted from the client. This suite proves:
//   • the approved pair (MPHL -> M4+) is accepted and persisted correctly;
//   • every other pair — wrong alternative, unmapped kit, arbitrary product —
//     is rejected before orchestrator.revise is ever called;
//   • a client-submitted price is ignored; the audited price always comes
//     from the governed table;
//   • restore reconstructs the original phase from its own preserved
//     snapshot, not from a client-supplied value;
//   • the orchestrator's stale-version error still surfaces as 409.
//
// budgetSubstitution.ts and the kit registry are used for REAL here (not
// mocked) — the point of this suite is to prove the route enforces what
// those modules define, not to re-describe them.
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const requireDoctorContext = jest.fn<() => Promise<unknown>>();
const assertDoctorInClinic = jest.fn<(...a: unknown[]) => unknown>();

jest.mock("@/lib/auth", () => ({
  requireDoctorContext: () => requireDoctorContext(),
  assertDoctorInClinic: (...a: unknown[]) => assertDoctorInClinic(...a),
}));

class OrchestratorError extends Error {
  constructor(public code: "not_found" | "forbidden" | "invalid" | "not_composable", msg: string) {
    super(msg);
  }
}

const revise = jest.fn<(args: Record<string, unknown>) => Promise<unknown>>();
const getOrCreateDetailed = jest.fn<() => Promise<unknown>>();

jest.mock("@hairos/packages/consultation-orchestrator", () => ({
  makeOrchestrator: () => ({ revise, getOrCreateDetailed }),
  OrchestratorError,
}));

const findUniqueAssessment = jest.fn<(...a: unknown[]) => Promise<unknown>>();
jest.mock("@/lib/prisma", () => ({
  prisma: { assessment: { findUnique: (...a: unknown[]) => findUniqueAssessment(...a) } },
}));

jest.mock("@/lib/consultation/loadReview", () => ({ newRequestId: () => "req-test" }));

const writeAuditLog = jest.fn<(...a: unknown[]) => Promise<unknown>>();
jest.mock("@/lib/audit/writeAuditLog", () => ({
  writeAuditLog: (...a: unknown[]) => writeAuditLog(...a),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require("../../apps/patient-portal/src/app/api/consultation/[assessmentId]/kit-substitution/route");

const ASSESSMENT_ID = "asm-1";
const DOCTOR_CTX = {
  doctor: { id: "doc-A", clinicId: "clinic-1" },
  authUserId: "auth-A",
  authRole: "DOCTOR",
  mode: "doctor",
};

function req(body: unknown): Request {
  return new Request(`http://localhost/api/consultation/${ASSESSMENT_ID}/kit-substitution`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const withAsm = () => ({ params: Promise.resolve({ assessmentId: ASSESSMENT_ID }) });

const MPHL_PHASE = {
  phase: 1,
  kitId: "MPHL",
  displayName: "MPHL Pro",
  whySelected: "Engine-selected for androgenetic pattern.",
  supportingConditions: ["AGA_PATTERN_MALE"],
  keyIngredients: ["Saw Palmetto"],
  mechanismOfAction: ["DHT suppression"],
  formulationGroups: [],
};

function consultationWithPhases(phases: unknown[]) {
  return {
    consultationId: "cons-1",
    contentVersion: 5,
    content: { treatmentPlan: { kitPhases: phases, topicals: [], topicalCautions: [] } },
  };
}

beforeEach(() => {
  requireDoctorContext.mockReset();
  assertDoctorInClinic.mockReset();
  revise.mockReset();
  getOrCreateDetailed.mockReset();
  findUniqueAssessment.mockReset();
  writeAuditLog.mockReset();

  requireDoctorContext.mockResolvedValue(DOCTOR_CTX);
  assertDoctorInClinic.mockReturnValue(null);
  findUniqueAssessment.mockResolvedValue({ clinicId: "clinic-1" });
  writeAuditLog.mockResolvedValue(undefined);
  getOrCreateDetailed.mockResolvedValue(consultationWithPhases([MPHL_PHASE]));
  revise.mockImplementation(async (args: Record<string, unknown>) => ({
    consultationId: "cons-1",
    contentVersion: 6,
    content: (args.edits as { treatmentPlan: unknown }).treatmentPlan,
  }));
});

describe("SUBSTITUTE — the approved pair", () => {
  it("MPHL -> M4+ is accepted, persisted with the governed price, and audited", async () => {
    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "MPHL", alternativeKitId: "M4_PLUS", expectedContentVersion: 5 }),
      withAsm(),
    );
    expect(res.status).toBe(200);
    expect(revise).toHaveBeenCalledTimes(1);

    const edits = revise.mock.calls[0]![0] as { edits: { treatmentPlan: { kitPhases: Array<Record<string, unknown>> } } };
    const newPhase = edits.edits.treatmentPlan.kitPhases[0]!;
    expect(newPhase.kitId).toBe("M4_PLUS");
    expect(newPhase.displayName).toBe("M4+");
    const meta = newPhase.meta as { substitution: Record<string, unknown> };
    expect(meta.substitution.type).toBe("BUDGET");
    expect(meta.substitution.reason).toBe("BUDGET_AFFORDABILITY");
    expect(meta.substitution.originalKitId).toBe("MPHL");
    expect((meta.substitution.originalPhase as { kitId: string }).kitId).toBe("MPHL");
    // Governed prices (rupeesToMinor(3637), rupeesToMinor(1655)), never a
    // client-supplied or invented amount.
    expect(meta.substitution.priceAtSubstitutionMinor).toEqual({ canonical: 363700, alternative: 165500 });

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "KIT_BUDGET_SUBSTITUTION_APPLIED",
        metadata: expect.objectContaining({
          originalKitId: "MPHL",
          alternativeKitId: "M4_PLUS",
          canonicalPriceMinor: 363700,
          alternativePriceMinor: 165500,
          savingMinor: 363700 - 165500,
        }),
      }),
    );
  });

  it("ignores any price the client sends — the audited amount is always the governed one", async () => {
    await POST(
      req({
        action: "SUBSTITUTE",
        originalKitId: "MPHL",
        alternativeKitId: "M4_PLUS",
        expectedContentVersion: 5,
        // Not a field the route schema reads at all — proves there is no
        // channel for a submitted price to reach persistence.
        priceMinor: 1,
        canonicalPriceMinor: 999999999,
      }),
      withAsm(),
    );
    const edits = revise.mock.calls[0]![0] as { edits: { treatmentPlan: { kitPhases: Array<Record<string, unknown>> } } };
    const meta = edits.edits.treatmentPlan.kitPhases[0]!.meta as { substitution: Record<string, unknown> };
    expect(meta.substitution.priceAtSubstitutionMinor).toEqual({ canonical: 363700, alternative: 165500 });
  });
});

describe("SUBSTITUTE — everything else is rejected before revise is called", () => {
  it("rejects MPHL -> F4+ (the wrong alternative for this canonical kit)", async () => {
    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "MPHL", alternativeKitId: "F4_PLUS" }),
      withAsm(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("SUBSTITUTION_NOT_APPROVED");
    expect(revise).not.toHaveBeenCalled();
  });

  it("rejects an arbitrary, unmapped alternative product", async () => {
    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "MPHL", alternativeKitId: "SOME_OTHER_KIT" }),
      withAsm(),
    );
    expect(res.status).toBe(400);
    expect(revise).not.toHaveBeenCalled();
  });

  it("rejects a substitution on an UNCHANGED kit that has no approved alternative", async () => {
    getOrCreateDetailed.mockResolvedValue(
      consultationWithPhases([{ ...MPHL_PHASE, kitId: "HEALTHY_9", displayName: "HEALTHY-9" }]),
    );
    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "HEALTHY_9", alternativeKitId: "M4_PLUS" }),
      withAsm(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("SUBSTITUTION_NOT_APPROVED");
    expect(revise).not.toHaveBeenCalled();
  });

  it("rejects when the named original kit is not in the current lineup", async () => {
    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "TE_GOLD", alternativeKitId: "SHED_CONTROL" }),
      withAsm(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("KIT_NOT_IN_LINEUP");
    expect(revise).not.toHaveBeenCalled();
  });

  it("rejects an unresolvable raw kitId, even one that names a real-sounding product", async () => {
    getOrCreateDetailed.mockResolvedValue(
      consultationWithPhases([{ ...MPHL_PHASE, kitId: "SOME UNGOVERNED KIT", displayName: "Some Ungoverned Kit" }]),
    );
    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "SOME UNGOVERNED KIT", alternativeKitId: "M4_PLUS" }),
      withAsm(),
    );
    expect(res.status).toBe(400);
    expect(revise).not.toHaveBeenCalled();
  });
});

describe("SUBSTITUTE — the 12th pair (TTM_SUPPORT -> STRESS_BUST_3), corrected 2026-09-09", () => {
  // The 2026-09-08 pass read the governance workbook's alternative-price
  // cell for this row as empty and withheld the pair. A direct re-read of
  // the same workbook found ₹1,457 present, so this pair is now approved
  // exactly like the other 11 — this test proves it reaches the route.
  it("HAIR FACT TTM (OCD) -> STRESS_BUST_3 is accepted, with the governed prices audited", async () => {
    const rawPhase = { ...MPHL_PHASE, kitId: "HAIR FACT TTM (OCD)", displayName: "HAIR FACT TTM (OCD)" };
    getOrCreateDetailed.mockResolvedValue(consultationWithPhases([rawPhase]));

    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "HAIR FACT TTM (OCD)", alternativeKitId: "STRESS_BUST_3" }),
      withAsm(),
    );
    expect(res.status).toBe(200);
    const edits = revise.mock.calls[0]![0] as { edits: { treatmentPlan: { kitPhases: Array<Record<string, unknown>> } } };
    const newPhase = edits.edits.treatmentPlan.kitPhases[0]!;
    expect(newPhase.kitId).toBe("STRESS_BUST_3");
    expect(newPhase.displayName).toBe("PRO FACT STRESS BUST 3");
    const meta = newPhase.meta as { substitution: Record<string, unknown> };
    expect(meta.substitution.priceAtSubstitutionMinor).toEqual({ canonical: 285800, alternative: 145700 });
  });
});

describe("SUBSTITUTE — the raw clinical spelling, as real consultations actually store it", () => {
  // Verified live against a staging Consultation on 2026-09-08: kitPhases
  // carried kitId "HAIR FACT TE GOLD", not "TE_GOLD". This is the case the
  // budgetSubstitution.ts "ForKitId" resolving wrappers exist for.
  it("HAIR FACT TE GOLD -> SHED_CONTROL is accepted", async () => {
    const rawPhase = {
      ...MPHL_PHASE,
      kitId: "HAIR FACT TE GOLD",
      displayName: "HAIR FACT TE GOLD",
    };
    getOrCreateDetailed.mockResolvedValue(consultationWithPhases([rawPhase]));

    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "HAIR FACT TE GOLD", alternativeKitId: "SHED_CONTROL" }),
      withAsm(),
    );
    expect(res.status).toBe(200);
    const edits = revise.mock.calls[0]![0] as { edits: { treatmentPlan: { kitPhases: Array<Record<string, unknown>> } } };
    const newPhase = edits.edits.treatmentPlan.kitPhases[0]!;
    expect(newPhase.kitId).toBe("SHED_CONTROL");
    expect(newPhase.displayName).toBe("Dr. FACT SHED CONTROL");
    const meta = newPhase.meta as { substitution: Record<string, unknown> };
    expect(meta.substitution.priceAtSubstitutionMinor).toEqual({ canonical: 299600, alternative: 155200 });
  });

  it("still rejects a raw spelling that does not resolve to the claimed pair", async () => {
    const rawPhase = { ...MPHL_PHASE, kitId: "HAIR FACT TE GOLD", displayName: "HAIR FACT TE GOLD" };
    getOrCreateDetailed.mockResolvedValue(consultationWithPhases([rawPhase]));

    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "HAIR FACT TE GOLD", alternativeKitId: "PRO_IMMUNE_1" }),
      withAsm(),
    );
    expect(res.status).toBe(400);
    expect(revise).not.toHaveBeenCalled();
  });
});

describe("multi-kit independence", () => {
  it("substituting one line leaves the other lines in the lineup untouched", async () => {
    const teGoldPhase = { ...MPHL_PHASE, kitId: "TE_GOLD", displayName: "HAIR FACT TE GOLD" };
    getOrCreateDetailed.mockResolvedValue(consultationWithPhases([MPHL_PHASE, teGoldPhase]));

    await POST(
      req({ action: "SUBSTITUTE", originalKitId: "MPHL", alternativeKitId: "M4_PLUS" }),
      withAsm(),
    );
    const edits = revise.mock.calls[0]![0] as { edits: { treatmentPlan: { kitPhases: Array<Record<string, unknown>> } } };
    const phases = edits.edits.treatmentPlan.kitPhases;
    expect(phases[0]!.kitId).toBe("M4_PLUS");
    // Untouched — same object, not even re-serialised with different content.
    expect(phases[1]).toEqual(teGoldPhase);
  });
});

describe("RESTORE", () => {
  it("restores the exact original phase from its own preserved snapshot", async () => {
    const substitutedPhase = {
      ...MPHL_PHASE,
      kitId: "M4_PLUS",
      displayName: "M4+",
      meta: {
        substitution: {
          type: "BUDGET",
          reason: "BUDGET_AFFORDABILITY",
          originalKitId: "MPHL",
          originalPhase: MPHL_PHASE,
          changedBy: "doc-A",
          changedAt: "2026-09-08T00:00:00.000Z",
          priceAtSubstitutionMinor: { canonical: 363700, alternative: 165500 },
        },
      },
      doctorEdited: true,
    };
    getOrCreateDetailed.mockResolvedValue(consultationWithPhases([substitutedPhase]));

    const res = await POST(req({ action: "RESTORE", currentKitId: "M4_PLUS" }), withAsm());
    expect(res.status).toBe(200);
    const edits = revise.mock.calls[0]![0] as { edits: { treatmentPlan: { kitPhases: Array<Record<string, unknown>> } } };
    expect(edits.edits.treatmentPlan.kitPhases[0]).toEqual(MPHL_PHASE);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "KIT_BUDGET_SUBSTITUTION_RESTORED" }),
    );
  });

  it("rejects a restore on a kit that was never substituted", async () => {
    const res = await POST(req({ action: "RESTORE", currentKitId: "MPHL" }), withAsm());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("NOT_SUBSTITUTED");
    expect(revise).not.toHaveBeenCalled();
  });
});

describe("optimistic concurrency and auth", () => {
  it("maps a stale expectedContentVersion to 409", async () => {
    revise.mockRejectedValueOnce(new OrchestratorError("invalid", "stale"));
    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "MPHL", alternativeKitId: "M4_PLUS", expectedContentVersion: 1 }),
      withAsm(),
    );
    expect(res.status).toBe(409);
  });

  it("401 when the caller is not authenticated", async () => {
    const { NextResponse } = require("next/server");
    requireDoctorContext.mockResolvedValue(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "MPHL", alternativeKitId: "M4_PLUS" }),
      withAsm(),
    );
    expect(res.status).toBe(401);
    expect(revise).not.toHaveBeenCalled();
  });

  it("404 across a clinic boundary, before the orchestrator is touched", async () => {
    const { NextResponse } = require("next/server");
    assertDoctorInClinic.mockReturnValue(NextResponse.json({ error: "forbidden" }, { status: 403 }));
    findUniqueAssessment.mockResolvedValue({ clinicId: "other-clinic" });
    const res = await POST(
      req({ action: "SUBSTITUTE", originalKitId: "MPHL", alternativeKitId: "M4_PLUS" }),
      withAsm(),
    );
    expect(res.status).toBe(404);
    expect(getOrCreateDetailed).not.toHaveBeenCalled();
  });
});
