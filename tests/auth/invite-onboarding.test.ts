// Recipient-facing invitation onboarding — the /invite/[token] page contract.
//
// These lock the two things the P0 journey depends on:
//   1. the page's display/decision logic (which invitations are actionable,
//      how emails are masked and compared), and
//   2. the routing-return contract that lets a brand-new Google user come back
//      to invitation acceptance BEFORE any Doctor UID is linked — i.e. the
//      OAuth `next` target is a same-origin /invite/<token> path that
//      safeReturnPath (used by /auth/callback) accepts, and open-redirects are
//      still refused.

import { describe, it, expect } from "vitest";
import {
  classifyInviteStatus,
  maskEmail,
  emailsMatch,
  inviteRoleLabel,
  inviteCallbackNext,
  decodeJwtClaims,
  hasActivatedRoleClaims,
} from "@/lib/auth/inviteOnboarding";
import { safeReturnPath } from "@/lib/auth/safeReturnPath";

// Build an unsigned JWT-shaped token with the given payload (header.payload.sig).
function jwtWith(payload: Record<string, unknown>): string {
  const b64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.sig`;
}

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

describe("classifyInviteStatus", () => {
  it("is not_found for a missing invitation", () => {
    expect(classifyInviteStatus(null)).toBe("not_found");
    expect(classifyInviteStatus(undefined)).toBe("not_found");
  });
  it("is revoked/accepted regardless of expiry (terminal first)", () => {
    expect(classifyInviteStatus({ status: "REVOKED", expiresAt: future() })).toBe("revoked");
    expect(classifyInviteStatus({ status: "REVOKED", expiresAt: past() })).toBe("revoked");
    expect(classifyInviteStatus({ status: "ACCEPTED", expiresAt: past() })).toBe("accepted");
  });
  it("is expired for a PENDING row past expiresAt (lazy expiry)", () => {
    expect(classifyInviteStatus({ status: "PENDING", expiresAt: past() })).toBe("expired");
  });
  it("is pending only for a live PENDING row", () => {
    expect(classifyInviteStatus({ status: "PENDING", expiresAt: future() })).toBe("pending");
  });
});

describe("maskEmail", () => {
  it("shows up to three local chars then masks, keeping the domain", () => {
    expect(maskEmail("sumitahuja742@gmail.com")).toBe("sum***@gmail.com");
  });
  it("masks a short local part without revealing its length beyond one char", () => {
    expect(maskEmail("abcd@x.com")).toBe("abc***@x.com");
    expect(maskEmail("ab@x.com")).toBe("ab*@x.com");
    expect(maskEmail("a@x.com")).toBe("a*@x.com");
  });
  it("returns null for empty and a safe fallback for a malformed address", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("")).toBeNull();
    expect(maskEmail("no-at-sign")).toBe("***");
  });
});

describe("emailsMatch", () => {
  it("is case-insensitive and whitespace-trimmed", () => {
    expect(emailsMatch("Sumitahuja742@Gmail.com", "  sumitahuja742@gmail.com ")).toBe(true);
  });
  it("is false when either side is missing or they differ", () => {
    expect(emailsMatch(null, "a@b.com")).toBe(false);
    expect(emailsMatch("a@b.com", null)).toBe(false);
    expect(emailsMatch("a@b.com", "c@b.com")).toBe(false);
  });
});

describe("inviteRoleLabel", () => {
  it("humanises known roles and passes through unknowns", () => {
    expect(inviteRoleLabel("DOCTOR")).toBe("Doctor");
    expect(inviteRoleLabel("CLINIC_ADMIN")).toBe("Clinic Admin");
    expect(inviteRoleLabel("WEIRD")).toBe("WEIRD");
  });
});

describe("OAuth return contract (sign in, then back to acceptance, pre-link)", () => {
  it("builds a same-origin /invite/<token> next target", () => {
    expect(inviteCallbackNext("abc.def")).toBe("/invite/abc.def");
  });
  it("url-encodes a token with reserved characters", () => {
    expect(inviteCallbackNext("a/b?c")).toBe("/invite/a%2Fb%3Fc");
  });
  it("is accepted by safeReturnPath, so /auth/callback will honour it", () => {
    const next = inviteCallbackNext("tok123");
    expect(safeReturnPath(next)).toBe(next);
  });
  it("still refuses open-redirects and non-paths", () => {
    expect(safeReturnPath("//evil.example.com")).toBeNull();
    expect(safeReturnPath("https://evil.example.com/invite/x")).toBeNull();
    expect(safeReturnPath("javascript:alert(1)")).toBeNull();
  });
});

describe("post-link claim verification (role-aware; do not navigate before claims)", () => {
  it("decodes clinic and organization claims from a well-formed token", () => {
    expect(decodeJwtClaims(jwtWith({ sub: "uid-1", user_role: "DOCTOR", clinic_id: "clinic-a" }))).toEqual({
      sub: "uid-1",
      user_role: "DOCTOR",
      clinic_id: "clinic-a",
      organization_id: undefined,
    });
    expect(decodeJwtClaims(jwtWith({ user_role: "ORG_ADMIN", organization_id: "org-a" }))).toEqual({
      sub: undefined,
      user_role: "ORG_ADMIN",
      clinic_id: undefined,
      organization_id: "org-a",
    });
  });
  it("returns null for malformed / missing tokens", () => {
    expect(decodeJwtClaims(null)).toBeNull();
    expect(decodeJwtClaims("")).toBeNull();
    expect(decodeJwtClaims("not-a-jwt")).toBeNull();
    expect(decodeJwtClaims("a.b")).toBeNull();
    expect(decodeJwtClaims("a.%%%.c")).toBeNull();
  });
  it("accepts clinic roles (DOCTOR/CLINIC_ADMIN/STAFF) with a clinic_id", () => {
    expect(hasActivatedRoleClaims({ user_role: "DOCTOR", clinic_id: "c" })).toBe(true);
    expect(hasActivatedRoleClaims({ user_role: "CLINIC_ADMIN", clinic_id: "c" })).toBe(true);
    expect(hasActivatedRoleClaims({ user_role: "STAFF", clinic_id: "c" })).toBe(true);
  });
  it("accepts org roles (ORG_ADMIN/SUPER_ADMIN) with an organization_id", () => {
    expect(hasActivatedRoleClaims({ user_role: "ORG_ADMIN", organization_id: "o" })).toBe(true);
    expect(hasActivatedRoleClaims({ user_role: "SUPER_ADMIN", organization_id: "o" })).toBe(true);
  });
  it("rejects tokens whose role has not activated for its surface (the bounce we must avoid)", () => {
    expect(hasActivatedRoleClaims(null)).toBe(false);
    expect(hasActivatedRoleClaims({ sub: "uid-1" })).toBe(false); // no role
    expect(hasActivatedRoleClaims({ user_role: "DOCTOR" })).toBe(false); // clinic role, no clinic_id
    expect(hasActivatedRoleClaims({ user_role: "STAFF", clinic_id: "" })).toBe(false);
    expect(hasActivatedRoleClaims({ user_role: "ORG_ADMIN" })).toBe(false); // org role, no org_id
    expect(hasActivatedRoleClaims({ user_role: "SUPER_ADMIN", clinic_id: "c" })).toBe(false); // wrong scope claim
    expect(hasActivatedRoleClaims({ user_role: "PATIENT", clinic_id: "c" })).toBe(false);
  });
  it("round-trips through decode + verify", () => {
    expect(hasActivatedRoleClaims(decodeJwtClaims(jwtWith({ user_role: "DOCTOR", clinic_id: "x" })))).toBe(true);
    expect(hasActivatedRoleClaims(decodeJwtClaims(jwtWith({ user_role: "ORG_ADMIN", organization_id: "o" })))).toBe(true);
    expect(hasActivatedRoleClaims(decodeJwtClaims(jwtWith({ sub: "only" })))).toBe(false);
  });
});
