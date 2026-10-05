import { describe, it, expect } from "vitest";
import { guardOutcome, isAdminArea, type GuardOutcome } from "@/lib/auth/routeGuard";

// Authorization for the Super Admin console (/admin, /api/admin).
//
// Contract the deployment must honour:
//   anonymous      → login            (login_next, carries ?next)
//   SUPER_ADMIN    → admin            (allow)
//   any other role → forbidden        (login_forbidden, ?reason=forbidden)
//   NEVER → /q/drfact-mumbai-test     (the guard can only return the three
//                                       outcomes below; it never yields a
//                                       clinic/questionnaire redirect)
//
// The guard is the pure decision used by proxy.ts. Keeping it here lets us
// assert the matrix without booting Next.

const ADMIN_PATHS = [
  "/admin",
  "/admin/network",
  "/admin/action-centre",
  "/admin/clinics",
  "/api/admin/orders",
];

describe("isAdminArea", () => {
  it("matches the console and its API, including the bare /admin", () => {
    for (const p of ADMIN_PATHS) expect(isAdminArea(p)).toBe(true);
    expect(isAdminArea("/admin")).toBe(true);
    expect(isAdminArea("/api/admin")).toBe(true);
  });

  it("does not match non-admin areas", () => {
    for (const p of ["/", "/login", "/doctor", "/clinic", "/q/drfact-mumbai-test", "/adminfoo"]) {
      expect(isAdminArea(p)).toBe(false);
    }
  });
});

describe("guardOutcome — /admin access matrix", () => {
  it("anonymous → login (with next), not forbidden", () => {
    expect(guardOutcome("/admin", null)).toBe("login_next");
    expect(guardOutcome("/admin", undefined)).toBe("login_next");
  });

  it("SUPER_ADMIN → allow", () => {
    expect(guardOutcome("/admin", "SUPER_ADMIN")).toBe("allow");
  });

  it("DOCTOR → forbidden", () => {
    expect(guardOutcome("/admin", "DOCTOR")).toBe("login_forbidden");
  });

  it("CLINIC_ADMIN → forbidden", () => {
    expect(guardOutcome("/admin", "CLINIC_ADMIN")).toBe("login_forbidden");
  });

  it("ORG_ADMIN and STAFF → forbidden (admin console is SUPER_ADMIN-only)", () => {
    expect(guardOutcome("/admin", "ORG_ADMIN")).toBe("login_forbidden");
    expect(guardOutcome("/admin", "STAFF")).toBe("login_forbidden");
  });

  it("authenticated session with absent/unknown role → forbidden", () => {
    expect(guardOutcome("/admin", "")).toBe("login_forbidden");
    expect(guardOutcome("/admin", "PATIENT")).toBe("login_forbidden");
    expect(guardOutcome("/admin", "nonsense")).toBe("login_forbidden");
  });
});

describe("guardOutcome — deep admin routes", () => {
  for (const p of ["/admin/network", "/admin/action-centre", "/admin/clinics"]) {
    it(`SUPER_ADMIN ${p} → allow`, () => {
      expect(guardOutcome(p, "SUPER_ADMIN")).toBe("allow");
    });
    it(`DOCTOR ${p} → forbidden`, () => {
      expect(guardOutcome(p, "DOCTOR")).toBe("login_forbidden");
    });
    it(`CLINIC_ADMIN ${p} → forbidden`, () => {
      expect(guardOutcome(p, "CLINIC_ADMIN")).toBe("login_forbidden");
    });
  }
});

describe("guardOutcome — non-admin gated areas are unchanged", () => {
  it("DOCTOR can still reach /doctor", () => {
    expect(guardOutcome("/doctor", "DOCTOR")).toBe("allow");
    expect(guardOutcome("/doctor/settings", "DOCTOR")).toBe("allow");
  });
  it("SUPER_ADMIN may traverse other staff areas", () => {
    expect(guardOutcome("/doctor", "SUPER_ADMIN")).toBe("allow");
    expect(guardOutcome("/clinic", "SUPER_ADMIN")).toBe("allow");
  });
  it("a non-staff role is forbidden from any gated area", () => {
    expect(guardOutcome("/doctor", "PATIENT")).toBe("login_forbidden");
  });
});

describe("guard never emits a clinic/questionnaire redirect", () => {
  it("only ever returns one of the three safe outcomes", () => {
    const allowed = new Set<GuardOutcome>(["allow", "login_next", "login_forbidden"]);
    const roles = [null, undefined, "", "SUPER_ADMIN", "DOCTOR", "CLINIC_ADMIN", "ORG_ADMIN", "STAFF", "PATIENT"];
    for (const p of [...ADMIN_PATHS, "/", "/doctor", "/clinic"]) {
      for (const r of roles) {
        expect(allowed.has(guardOutcome(p, r as string | null | undefined))).toBe(true);
      }
    }
  });
});
