import { describe, it, expect } from "vitest";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "../../apps/patient-portal/src/lib/invitation-token";

describe("invitation tokens", () => {
  it("returns a base64url string and a hex hash that matches re-hashing", () => {
    const { raw, hash } = generateInvitationToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInvitationToken(raw)).toBe(hash);
  });

  it("generates distinct tokens across calls", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it("hashInvitationToken is deterministic and case-sensitive", () => {
    expect(hashInvitationToken("hello")).toBe(hashInvitationToken("hello"));
    expect(hashInvitationToken("hello")).not.toBe(hashInvitationToken("Hello"));
  });
});
