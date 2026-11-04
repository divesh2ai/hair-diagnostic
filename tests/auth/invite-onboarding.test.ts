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
} from "@/lib/auth/inviteOnboarding";
import { safeReturnPath } from "@/lib/auth/safeReturnPath";

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
