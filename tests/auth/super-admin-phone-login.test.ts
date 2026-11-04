// Phone-OTP login authorization — regression cover for the SUPER_ADMIN login
// blocker and the role paths around it.
//
// ── The defect ──────────────────────────────────────────────────────────────
// /api/auth/phone-login/link was called unconditionally after a successful
// phone OTP and always tried to resolve a Doctor row. A platform SUPER_ADMIN
// has none, so a legitimate operator verified their OTP and was then signed
// straight back out as "unregistered". The fix lets exactly SUPER_ADMIN skip
// Doctor linking, while every other role — and a missing role claim — still
// goes through Doctor resolution, which fails closed.
//
// These tests pin the four cases that matter: SUPER_ADMIN (skips, allowed,
// audited), DOCTOR (resolved as before), roleless (no bypass — resolved and
// refused), and unauthorized (no session — 401). They drive resolvePhoneLogin
// with injected deps, so no Supabase session or Next request is needed and the
// exact status/body contract the client depends on is asserted directly.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  decidePhoneLogin,
  resolvePhoneLogin,
  type PhoneLoginDeps,
} from "@/lib/auth/phoneLoginAuthorization";
import type { PhoneDoctorLinkResult } from "@/lib/auth/phoneDoctorLink";
import type { SystemRole } from "@/lib/auth/roles";

const SUPER_ADMIN_UID = "38ddfd21-super-admin";
const DOCTOR_UID = "10e985c1-doctor";
const PHONE = "+919876543210";

// ── decidePhoneLogin — the pure rule ────────────────────────────────────────
describe("decidePhoneLogin", () => {
  it("skips Doctor linking for exactly SUPER_ADMIN", () => {
    expect(decidePhoneLogin("SUPER_ADMIN")).toEqual({
      action: "skip_doctor_link",
      role: "SUPER_ADMIN",
    });
  });

  it("requires Doctor linking for every clinic-facing role", () => {
    const clinicRoles: SystemRole[] = [
      "ORG_ADMIN",
      "CLINIC_ADMIN",
      "DOCTOR",
      "STAFF",
      "PATIENT",
    ];
    for (const role of clinicRoles) {
      expect(decidePhoneLogin(role), `${role} must not skip linking`).toEqual({
        action: "require_doctor_link",
      });
    }
  });

  it("requires Doctor linking when the role claim is missing or invalid", () => {
    // A roleless account must NEVER bypass authorization — it falls through to
    // Doctor resolution, which refuses it.
    expect(decidePhoneLogin(null)).toEqual({ action: "require_doctor_link" });
    expect(decidePhoneLogin(undefined)).toEqual({ action: "require_doctor_link" });
  });
});

// ── resolvePhoneLogin — the HTTP contract per role ──────────────────────────
// Only getUser/getVerifiedClaims vary per test; resolveDoctor and the audit
// sink are the exposed spies so every test asserts on the exact function the
// code called. Tests shape their return values with mockResolvedValue(...).
type DepOverrides = Partial<
  Pick<PhoneLoginDeps, "getUser" | "getVerifiedClaims">
>;

function makeDeps(over: DepOverrides = {}): {
  deps: PhoneLoginDeps;
  resolveDoctor: ReturnType<typeof vi.fn>;
  audit: ReturnType<typeof vi.fn>;
} {
  const resolveDoctor = vi.fn(
    async (): Promise<PhoneDoctorLinkResult> => ({
      ok: true,
      doctorId: "doctor-1",
      clinicId: "clinic-1",
      alreadyLinked: false,
    }),
  );
  const audit = vi.fn(async () => {});
  const deps: PhoneLoginDeps = {
    getUser: async () => ({ id: DOCTOR_UID, phone: PHONE }),
    getVerifiedClaims: async () => ({ role: "DOCTOR", sub: DOCTOR_UID }),
    resolveDoctor: resolveDoctor as unknown as PhoneLoginDeps["resolveDoctor"],
    auditSuperAdminLogin: audit as unknown as PhoneLoginDeps["auditSuperAdminLogin"],
    ...over,
  };
  return { deps, resolveDoctor, audit };
}

describe("resolvePhoneLogin — SUPER_ADMIN", () => {
  it("allows the login, skips Doctor resolution, and audits it", async () => {
    const { deps, resolveDoctor, audit } = makeDeps({
      getUser: async () => ({ id: SUPER_ADMIN_UID, phone: PHONE }),
      getVerifiedClaims: async () => ({ role: "SUPER_ADMIN", sub: SUPER_ADMIN_UID }),
    });

    const res = await resolvePhoneLogin(deps);

    expect(res).toEqual({
      status: 200,
      body: { ok: true, role: "SUPER_ADMIN", linked: false },
    });
    expect(resolveDoctor).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(SUPER_ADMIN_UID);
  });

  it("still allows the login when the audit write fails (audit is best-effort)", async () => {
    const { deps, resolveDoctor, audit } = makeDeps({
      getUser: async () => ({ id: SUPER_ADMIN_UID, phone: PHONE }),
      getVerifiedClaims: async () => ({ role: "SUPER_ADMIN", sub: SUPER_ADMIN_UID }),
    });
    audit.mockRejectedValue(new Error("audit sink down"));

    const res = await resolvePhoneLogin(deps);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, role: "SUPER_ADMIN" });
    expect(resolveDoctor).not.toHaveBeenCalled();
  });

  it("does NOT grant the skip when the JWT subject is a different user", async () => {
    // Defense-in-depth: a SUPER_ADMIN role claim whose `sub` is not the
    // authenticated user must never skip Doctor linking. It falls through to
    // Doctor resolution (fails closed) and is not audited as an admin login.
    const { deps, resolveDoctor, audit } = makeDeps({
      getUser: async () => ({ id: SUPER_ADMIN_UID, phone: PHONE }),
      getVerifiedClaims: async () => ({ role: "SUPER_ADMIN", sub: "a-different-user" }),
    });
    resolveDoctor.mockResolvedValue({ ok: false, reason: "unregistered" });

    const res = await resolvePhoneLogin(deps);

    expect(audit).not.toHaveBeenCalled();
    expect(resolveDoctor).toHaveBeenCalledWith({
      supabaseUserId: SUPER_ADMIN_UID,
      verifiedPhone: PHONE,
    });
    expect(res).toEqual({
      status: 403,
      body: { ok: false, reason: "unregistered" },
    });
  });
});

describe("resolvePhoneLogin — DOCTOR", () => {
  it("resolves the Doctor row and passes its result through unchanged", async () => {
    const { deps, resolveDoctor, audit } = makeDeps({
      getUser: async () => ({ id: DOCTOR_UID, phone: PHONE }),
      getVerifiedClaims: async () => ({ role: "DOCTOR", sub: DOCTOR_UID }),
    });

    const res = await resolvePhoneLogin(deps);

    expect(resolveDoctor).toHaveBeenCalledWith({
      supabaseUserId: DOCTOR_UID,
      verifiedPhone: PHONE,
    });
    expect(res).toEqual({
      status: 200,
      body: {
        ok: true,
        doctorId: "doctor-1",
        clinicId: "clinic-1",
        alreadyLinked: false,
      },
    });
    expect(audit).not.toHaveBeenCalled();
  });

  it("maps a conflict to 409 and other refusals to 403", async () => {
    const conflict = makeDeps();
    conflict.resolveDoctor.mockResolvedValue({ ok: false, reason: "conflict" });
    expect(await resolvePhoneLogin(conflict.deps)).toEqual({
      status: 409,
      body: { ok: false, reason: "conflict" },
    });

    const inactive = makeDeps();
    inactive.resolveDoctor.mockResolvedValue({ ok: false, reason: "inactive" });
    expect(await resolvePhoneLogin(inactive.deps)).toEqual({
      status: 403,
      body: { ok: false, reason: "inactive" },
    });
  });
});

describe("resolvePhoneLogin — roleless (no valid role claim)", () => {
  it("does NOT bypass authorization: it is resolved and refused as unregistered", async () => {
    const { deps, resolveDoctor, audit } = makeDeps({
      getUser: async () => ({ id: "stranger-uid", phone: PHONE }),
      getVerifiedClaims: async () => ({ role: null, sub: "stranger-uid" }),
    });
    resolveDoctor.mockResolvedValue({ ok: false, reason: "unregistered" });

    const res = await resolvePhoneLogin(deps);

    expect(resolveDoctor).toHaveBeenCalledOnce();
    expect(audit).not.toHaveBeenCalled();
    expect(res).toEqual({
      status: 403,
      body: { ok: false, reason: "unregistered" },
    });
  });
});

describe("resolvePhoneLogin — unauthorized", () => {
  it("returns 401 and touches nothing when there is no session", async () => {
    const { deps, resolveDoctor, audit } = makeDeps({
      getUser: async () => null,
      getVerifiedClaims: async () => ({ role: null, sub: null }),
    });

    const res = await resolvePhoneLogin(deps);

    expect(res).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(resolveDoctor).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("returns 401 when the session has no verified phone", async () => {
    const { deps, resolveDoctor } = makeDeps({
      getUser: async () => ({ id: SUPER_ADMIN_UID, phone: null }),
      getVerifiedClaims: async () => ({ role: "SUPER_ADMIN", sub: SUPER_ADMIN_UID }),
    });

    const res = await resolvePhoneLogin(deps);

    expect(res.status).toBe(401);
    // A null phone short-circuits before any role branch — no admin skip.
    expect(resolveDoctor).not.toHaveBeenCalled();
  });
});
