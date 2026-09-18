// Mobile OTP is the primary doctor login for the clinic pilot. These tests
// pin the three things that actually broke it, plus the guards around them.
//
// ── The defect ──────────────────────────────────────────────────────────────
// Supabase mints a SEPARATE auth user per channel: the phone user carries
// `phone` and no `email`, the email user the reverse. `Doctor.supabaseUserId`
// names only one of them, so a doctor already linked by email had their mobile
// OTP verify correctly at Supabase and then be refused by
// resolveOrLinkDoctorByPhone as `supabaseUserId_conflict` — verified, then
// signed straight back out. The staging audit trail recorded exactly that.
//
// Doctor now carries a second identity column, `supabasePhoneUserId`, and both
// are resolved together. These tests hold that line: the second channel
// attaches, the first keeps working, and none of the loose-matching the
// function refuses becomes possible on the way.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Prisma stand-in ─────────────────────────────────────────────────────────
// Shaped per test via `state`, so no database is needed.
type DoctorRow = {
  id: string;
  clinicId: string;
  phone: string | null;
  isActive: boolean;
  supabaseUserId: string | null;
  supabasePhoneUserId: string | null;
};

const state: { doctors: DoctorRow[] } = { doctors: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    doctor: {
      findMany: async () => state.doctors.map((d) => ({ ...d })),
      findUnique: async ({ where }: any) => {
        const d = state.doctors.find((x) => x.id === where.id);
        return d ? { ...d } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const matches = state.doctors.filter((d) => {
          if (d.id !== where.id) return false;
          for (const [k, v] of Object.entries(where)) {
            if (k === "id") continue;
            if ((d as any)[k] !== v) return false;
          }
          return true;
        });
        matches.forEach((d) => Object.assign(d, data));
        return { count: matches.length };
      },
    },
  },
}));

const audits: string[] = [];
vi.mock("@/lib/audit/writeAuditLog", () => ({
  writeAuditLog: async (entry: { action: string }) => {
    audits.push(entry.action);
  },
}));

import { resolveOrLinkDoctorByPhone } from "@/lib/auth/phoneDoctorLink";
import { doctorAuthIdentityWhere, isLinkedIdentity } from "@/lib/auth/doctorIdentity";
import { normaliseMobile } from "@/lib/patient/phone";
import { classifyOtpError } from "@/lib/auth/otpErrors";

const EMAIL_UID = "9041f8cf-email-identity";
const PHONE_UID = "10e985c1-phone-identity";
const OTHER_UID = "ffffffff-someone-else";
const CLINIC_A = "clinic-mumbai";
const CLINIC_B = "clinic-pune";

/** The provisioned number, in the canonical form Doctor.phone stores. */
const DOCTOR_E164 = "+919876543210";
/** How Supabase reports the same verified number: digits, no leading '+'. */
const SUPABASE_PHONE = "919876543210";

function doctorRow(over: Partial<DoctorRow> = {}): DoctorRow {
  return {
    id: "doc-1",
    clinicId: CLINIC_A,
    phone: DOCTOR_E164,
    isActive: true,
    supabaseUserId: null,
    supabasePhoneUserId: null,
    ...over,
  };
}

beforeEach(() => {
  state.doctors = [];
  audits.length = 0;
});

// ── 1–3. Canonical E.164, one function, every accepted input shape ──────────
describe("phone normalisation is canonical", () => {
  it("turns a bare 10-digit Indian number into +91 E.164", () => {
    const r = normaliseMobile("9876543210");
    expect(r.ok && r.e164).toBe("+919876543210");
  });

  it("leaves an already-canonical +91 number unchanged", () => {
    const r = normaliseMobile("+919876543210");
    expect(r.ok && r.e164).toBe("+919876543210");
  });

  it("normalises spaced, dashed and 91-prefixed forms to one string", () => {
    for (const input of [
      "91 98765 43210",
      "+91-98765-43210",
      "+91 98765 43210",
      "919876543210",
      "09876543210",
    ]) {
      const r = normaliseMobile(input);
      expect(r.ok && r.e164, `${input} should normalise`).toBe("+919876543210");
    }
  });

  it("never prepends +91 twice", () => {
    const r = normaliseMobile("+919876543210");
    expect(r.ok && r.e164.startsWith("+9191")).toBe(false);
  });

  it("rejects clearly invalid numbers before Supabase is ever contacted", () => {
    for (const bad of ["12345", "5876543210", "98765432101234", "abcdefghij", ""]) {
      expect(normaliseMobile(bad).ok, `${bad} should be rejected`).toBe(false);
    }
  });
});

// ── 7, 8. A verified phone resolves the Doctor, with no email anywhere ───────
describe("doctor resolution from a phone-only identity", () => {
  it("links a first-login doctor whose row has no auth identity yet", async () => {
    state.doctors = [doctorRow()];

    const res = await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });

    expect(res).toMatchObject({ ok: true, clinicId: CLINIC_A, alreadyLinked: false });
    expect(state.doctors[0]!.supabaseUserId).toBe(PHONE_UID);
  });

  it("attaches the phone identity to a doctor already linked by EMAIL", async () => {
    // This is the exact staging case: the code verified, then was refused.
    state.doctors = [doctorRow({ supabaseUserId: EMAIL_UID })];

    const res = await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });

    expect(res.ok).toBe(true);
    expect(state.doctors[0]!.supabasePhoneUserId).toBe(PHONE_UID);
    expect(audits).toContain("DOCTOR_PHONE_IDENTITY_ATTACHED");
  });

  it("keeps the email identity intact, so email stays a working fallback", async () => {
    state.doctors = [doctorRow({ supabaseUserId: EMAIL_UID })];

    await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });

    expect(state.doctors[0]!.supabaseUserId).toBe(EMAIL_UID);
    // Both identities now resolve the same row.
    expect(isLinkedIdentity(state.doctors[0]!, EMAIL_UID)).toBe(true);
    expect(isLinkedIdentity(state.doctors[0]!, PHONE_UID)).toBe(true);
  });

  it("is idempotent — re-login on the attached phone identity writes nothing", async () => {
    state.doctors = [doctorRow({ supabaseUserId: EMAIL_UID, supabasePhoneUserId: PHONE_UID })];

    const res = await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });

    expect(res).toMatchObject({ ok: true, alreadyLinked: true });
    expect(audits).toHaveLength(0);
  });

  it("matches the Supabase form (no '+') against the stored form (with '+')", async () => {
    state.doctors = [doctorRow()];
    const res = await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });
    expect(res.ok).toBe(true);
  });
});

// ── 9, 10, 11. Refusals stay refusals, and stay distinguishable ─────────────
describe("refusals", () => {
  it("refuses a phone that matches no provisioned doctor", async () => {
    state.doctors = [doctorRow({ phone: "+919999988888" })];

    const res = await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });

    expect(res).toEqual({ ok: false, reason: "unregistered" });
    expect(audits).toContain("DOCTOR_PHONE_LOGIN_DENIED_UNREGISTERED");
  });

  it("refuses an INACTIVE doctor distinctly from an unknown number", async () => {
    state.doctors = [doctorRow({ isActive: false })];

    const res = await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });

    expect(res).toEqual({ ok: false, reason: "inactive" });
    expect(audits).toContain("DOCTOR_PHONE_LOGIN_DENIED_INACTIVE");
  });

  it("never lets a second phone identity take over a doctor", async () => {
    state.doctors = [doctorRow({ supabaseUserId: EMAIL_UID, supabasePhoneUserId: OTHER_UID })];

    const res = await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });

    expect(res).toEqual({ ok: false, reason: "conflict" });
    expect(state.doctors[0]!.supabasePhoneUserId).toBe(OTHER_UID);
  });

  it("never matches on a suffix — only a full digit-for-digit number", async () => {
    // Same last 5 digits, different number. The classic loose-match bug.
    state.doctors = [doctorRow({ phone: "+919111143210" })];

    const res = await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });

    expect(res).toEqual({ ok: false, reason: "unregistered" });
  });

  it("preserves clinic isolation — resolution returns the matched row's own clinic", async () => {
    state.doctors = [
      doctorRow({ id: "doc-pune", clinicId: CLINIC_B, phone: "+919000000001" }),
      doctorRow({ id: "doc-mumbai", clinicId: CLINIC_A, phone: DOCTOR_E164 }),
    ];

    const res = await resolveOrLinkDoctorByPhone({
      supabaseUserId: PHONE_UID,
      verifiedPhone: SUPABASE_PHONE,
    });

    expect(res).toMatchObject({ ok: true, doctorId: "doc-mumbai", clinicId: CLINIC_A });
    // The other clinic's doctor is untouched.
    expect(state.doctors[0]!.supabaseUserId).toBeNull();
    expect(state.doctors[0]!.supabasePhoneUserId).toBeNull();
  });
});

// ── The shared resolver both channels go through ────────────────────────────
describe("doctorAuthIdentityWhere", () => {
  it("matches either linked identity", () => {
    expect(doctorAuthIdentityWhere(PHONE_UID)).toEqual({
      OR: [{ supabaseUserId: PHONE_UID }, { supabasePhoneUserId: PHONE_UID }],
    });
  });

  it("cannot degrade into matching every doctor when the uid is missing", () => {
    // An empty `where` would return the first doctor in the table to an
    // unauthenticated caller. It must be an impossible clause instead.
    for (const empty of [null, undefined, ""]) {
      const where = doctorAuthIdentityWhere(empty);
      expect(where).not.toEqual({});
      expect(where.OR).toBeUndefined();
      expect(where.id).toBeDefined();
    }
  });
});

// ── 4, 5, 6, 12. The client contract, asserted against the real source ──────
const LOGIN_PAGE = readFileSync(
  join(__dirname, "../../apps/patient-portal/src/app/login/page.tsx"),
  "utf8",
);

/** The phone half of the login page, excluding the email flow. */
function phoneFlow(): string {
  const start = LOGIN_PAGE.indexOf("const sendPhoneCode");
  const end = LOGIN_PAGE.indexOf("const sendCode");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return LOGIN_PAGE.slice(start, end);
}

describe("login page phone contract", () => {
  it("verifies with type 'sms', never 'email'", () => {
    const flow = phoneFlow();
    expect(flow).toMatch(/type:\s*"sms"/);
    expect(flow).not.toMatch(/type:\s*"email"/);
  });

  it("sends and verifies the SAME stored normalised number", () => {
    const flow = phoneFlow();
    // SEND normalises once and stores the result...
    expect(flow).toMatch(/setVerifiedPhone\(parsed\.e164\)/);
    expect(flow).toMatch(/signInWithOtp\(\{\s*phone:\s*parsed\.e164\s*\}\)/);
    // ...and VERIFY reuses that exact value rather than re-deriving it.
    expect(flow).toMatch(/phone:\s*verifiedPhone/);
    expect(flow).not.toMatch(/verifyOtp\([\s\S]*normaliseMobile/);
  });

  it("passes the OTP as a trimmed string, never coerced through Number", () => {
    const flow = phoneFlow();
    expect(flow).toMatch(/token:\s*phoneCode\.trim\(\)/);
    expect(flow).not.toMatch(/Number\(phoneCode/);
    expect(flow).not.toMatch(/parseInt\(phoneCode/);
  });

  it("clears the previous code and guards against concurrent sends on resend", () => {
    const flow = phoneFlow();
    expect(flow).toMatch(/if \(phoneSubmitting\) return;/);
    expect(flow).toMatch(/setPhoneCode\(""\)/);
  });

  it("drops the bound number when the doctor goes back to edit it", () => {
    // Otherwise a verify could fire against the PREVIOUS number.
    const reset = LOGIN_PAGE.slice(LOGIN_PAGE.indexOf("const resetPhone"));
    expect(reset.slice(0, 400)).toMatch(/setVerifiedPhone\(null\)/);
  });
});

// ── 8. Failures must not all read as "invalid OTP" ──────────────────────────
describe("OTP error classification", () => {
  it("separates the failure kinds a doctor can act on differently", () => {
    expect(classifyOtpError("Token has expired or is invalid", "verify")).toBe("expired");
    expect(classifyOtpError("Invalid token", "verify")).toBe("invalid");
    expect(classifyOtpError("For security purposes, rate limit exceeded", "send")).toBe("rate_limited");
    expect(classifyOtpError("Unsupported phone provider", "send")).toBe("provider_unavailable");
    expect(classifyOtpError("Signups not allowed for otp", "send")).toBe("provider_unavailable");
  });

  it("does not report a send outage as a bad code", () => {
    expect(classifyOtpError("network failure", "send")).toBe("send_failed");
    expect(classifyOtpError("", "send")).toBe("send_failed");
  });
});
