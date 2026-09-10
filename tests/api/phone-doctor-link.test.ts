// Phone-OTP doctor login — governance tests for resolveOrLinkDoctorByPhone.
//
// Verifies:
//   A. Registered, active doctor, first login → links supabaseUserId, ACTIVE
//   B. Verified phone with no matching Doctor → unregistered, denied, audited
//   C. Inactive doctor's phone → treated as no match (isActive filter), denied
//   D. Deleted doctor's phone → treated as no match (deletedAt filter), denied
//   E. Second login with the SAME linked identity → idempotent, no re-write
//   F. Verified phone already linked to a DIFFERENT identity → conflict, denied, audited
//   G. Phone format differences (+91 vs bare digits) still match

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const doctorFindMany = jest.fn<() => Promise<Record<string, unknown>[]>>();
const doctorUpdateMany = jest.fn<() => Promise<{ count: number }>>();
const doctorFindUnique = jest.fn<() => Promise<Record<string, unknown> | null>>();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    doctor: {
      findMany: () => doctorFindMany(),
      updateMany: () => doctorUpdateMany(),
      findUnique: () => doctorFindUnique(),
    },
  },
}));

const writeAuditLog = jest.fn<() => Promise<void>>();
jest.mock("@/lib/audit/writeAuditLog", () => ({
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

import { resolveOrLinkDoctorByPhone } from "@/lib/auth/phoneDoctorLink";

const ACTIVE_DOCTOR = {
  id: "doctor-1",
  clinicId: "clinic-1",
  phone: "+919861827000",
  supabaseUserId: null,
};

beforeEach(() => {
  jest.resetAllMocks();
  writeAuditLog.mockResolvedValue(undefined);
});

describe("A — first login for a registered, active doctor", () => {
  it("links supabaseUserId and reports alreadyLinked: false", async () => {
    doctorFindMany.mockResolvedValue([ACTIVE_DOCTOR]);
    doctorUpdateMany.mockResolvedValue({ count: 1 });

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-1",
      verifiedPhone: "919861827000", // Supabase form: no leading '+'
    });

    expect(result).toEqual({
      ok: true,
      doctorId: "doctor-1",
      clinicId: "clinic-1",
      alreadyLinked: false,
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCTOR_PHONE_LOGIN_LINKED", entityId: "doctor-1" }),
    );
  });
});

describe("B — verified phone matches no Doctor row", () => {
  it("returns unregistered and audits the denial", async () => {
    doctorFindMany.mockResolvedValue([ACTIVE_DOCTOR]);

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-stranger",
      verifiedPhone: "919999999999",
    });

    expect(result).toEqual({ ok: false, reason: "unregistered" });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCTOR_PHONE_LOGIN_DENIED_UNREGISTERED" }),
    );
    expect(doctorUpdateMany).not.toHaveBeenCalled();
  });
});

describe("C — inactive doctor's phone is not returned by the live-row query", () => {
  it("is treated identically to unregistered", async () => {
    // requireDoctorContext-style live query already filters isActive:true —
    // this test asserts the caller-visible contract: an inactive doctor's
    // phone simply never appears in `candidates`.
    doctorFindMany.mockResolvedValue([]); // isActive:false row excluded upstream

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-2",
      verifiedPhone: "919861827000",
    });

    expect(result).toEqual({ ok: false, reason: "unregistered" });
  });
});

describe("D — deleted doctor's phone is not returned by the live-row query", () => {
  it("is treated identically to unregistered", async () => {
    doctorFindMany.mockResolvedValue([]); // deletedAt-filtered upstream

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-3",
      verifiedPhone: "919861827000",
    });

    expect(result).toEqual({ ok: false, reason: "unregistered" });
  });
});

describe("E — second login with the same already-linked identity", () => {
  it("is idempotent and does not attempt to re-write the row", async () => {
    doctorFindMany.mockResolvedValue([{ ...ACTIVE_DOCTOR, supabaseUserId: "auth-uid-1" }]);

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-1",
      verifiedPhone: "919861827000",
    });

    expect(result).toEqual({
      ok: true,
      doctorId: "doctor-1",
      clinicId: "clinic-1",
      alreadyLinked: true,
    });
    expect(doctorUpdateMany).not.toHaveBeenCalled();
  });
});

describe("F — verified phone already linked to a DIFFERENT identity", () => {
  it("fails closed with conflict and audits it", async () => {
    doctorFindMany.mockResolvedValue([{ ...ACTIVE_DOCTOR, supabaseUserId: "auth-uid-original" }]);

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-imposter",
      verifiedPhone: "919861827000",
    });

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCTOR_PHONE_LOGIN_DENIED_CONFLICT" }),
    );
    expect(doctorUpdateMany).not.toHaveBeenCalled();
  });
});

describe("G — phone format differences still match", () => {
  it("matches +91XXXXXXXXXX (stored) against bare digits (Supabase form)", async () => {
    doctorFindMany.mockResolvedValue([{ ...ACTIVE_DOCTOR, phone: "+91 98618 27000" }]);
    doctorUpdateMany.mockResolvedValue({ count: 1 });

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-4",
      verifiedPhone: "919861827000",
    });

    expect(result.ok).toBe(true);
  });
});

describe("Race: two concurrent first-login attempts for the same phone", () => {
  it("the loser sees the winner's identity and returns conflict", async () => {
    doctorFindMany.mockResolvedValue([ACTIVE_DOCTOR]);
    doctorUpdateMany.mockResolvedValue({ count: 0 }); // lost the conditional update
    doctorFindUnique.mockResolvedValue({ supabaseUserId: "auth-uid-winner", clinicId: "clinic-1" });

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-loser",
      verifiedPhone: "919861827000",
    });

    expect(result).toEqual({ ok: false, reason: "conflict" });
  });

  it("a caller re-checking their own already-applied write sees alreadyLinked: true", async () => {
    doctorFindMany.mockResolvedValue([ACTIVE_DOCTOR]);
    doctorUpdateMany.mockResolvedValue({ count: 0 });
    doctorFindUnique.mockResolvedValue({ supabaseUserId: "auth-uid-me", clinicId: "clinic-1" });

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-me",
      verifiedPhone: "919861827000",
    });

    expect(result).toEqual({
      ok: true,
      doctorId: "doctor-1",
      clinicId: "clinic-1",
      alreadyLinked: true,
    });
  });
});
