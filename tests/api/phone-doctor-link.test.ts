// Phone-OTP doctor login — governance tests for resolveOrLinkDoctorByPhone.
//
// Verifies:
//   A. Registered, active doctor, first login → links supabaseUserId, ACTIVE
//   B. Verified phone with no matching Doctor → unregistered, denied, audited
//   C. Inactive doctor's phone → denied as `inactive`, distinctly from unknown
//   D. Deleted doctor's phone → treated as no match (deletedAt filter), denied
//   E. Second login with the SAME linked identity → idempotent, no re-write
//   F. Verified phone on a doctor already linked by EMAIL → phone identity
//      ATTACHED alongside it (this is the mobile-login fix), while a second
//      competing PHONE identity still fails closed
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
  isActive: true,
  supabaseUserId: null,
  // Second identity column, added for mobile-OTP login: Supabase mints a
  // separate auth user per channel, so one doctor can hold both a phone uid
  // and an email uid. Liveness is now decided in the function rather than by
  // the query, so the fixture has to carry both fields.
  supabasePhoneUserId: null,
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

describe("C — inactive doctor's phone", () => {
  it("is denied as `inactive`, distinctly from an unknown number", async () => {
    // Liveness is no longer filtered by the query: the row comes back and the
    // function classifies it, so a withdrawn doctor is told their access is
    // closed rather than that their number is unrecognised.
    // this test asserts the caller-visible contract: an inactive doctor's
    // phone simply never appears in `candidates`.
    doctorFindMany.mockResolvedValue([{ ...ACTIVE_DOCTOR, isActive: false }]);

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-2",
      verifiedPhone: "919861827000",
    });

    expect(result).toEqual({ ok: false, reason: "inactive" });
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

describe("F — verified phone on a doctor already linked by another identity", () => {
  // ── Deliberate behaviour change (mobile-OTP launch) ────────────────────────
  // This case used to fail closed, and that is precisely what broke mobile
  // login: Supabase mints a SEPARATE auth user per channel, so a doctor who
  // had already signed in by email arrived here with a genuine second uid for
  // the same person and was refused — the OTP verified, then they were signed
  // straight back out. Staging recorded it as DOCTOR_PHONE_LOGIN_DENIED_CONFLICT.
  //
  // Attaching is safe because the number matched Doctor.phone in FULL, and
  // Doctor.phone is Super-Admin-provisioned: control of that exact number is
  // the same grade of evidence as control of the provisioned email. The
  // takeover this test originally guarded is still guarded, by the second case.
  it("attaches the phone identity beside an existing EMAIL identity", async () => {
    doctorFindMany.mockResolvedValue([{ ...ACTIVE_DOCTOR, supabaseUserId: "auth-uid-email" }]);
    doctorUpdateMany.mockResolvedValue({ count: 1 });

    const result = await resolveOrLinkDoctorByPhone({
      supabaseUserId: "auth-uid-phone",
      verifiedPhone: "919861827000",
    });

    expect(result).toEqual({
      ok: true,
      doctorId: "doctor-1",
      clinicId: "clinic-1",
      alreadyLinked: false,
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCTOR_PHONE_IDENTITY_ATTACHED" }),
    );
  });

  it("still fails closed when a DIFFERENT phone identity already holds the row", async () => {
    // Two distinct auth users both holding the same verified number is a SIM
    // swap or a provisioning error, not one person's second channel.
    doctorFindMany.mockResolvedValue([
      { ...ACTIVE_DOCTOR, supabaseUserId: "auth-uid-email", supabasePhoneUserId: "auth-uid-original" },
    ]);

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
