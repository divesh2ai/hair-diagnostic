import { describe, it, expect } from "vitest";
import {
  classifyAuthProvider,
  rollUpClinicAuthProvider,
  type AuthProvider,
} from "@/lib/admin/opsDashboard/authProvider";

describe("classifyAuthProvider — provider from auth.identities, never the column", () => {
  it("UNKNOWN when auth.identities is unreadable", () => {
    expect(classifyAuthProvider({ readable: false, hasLinkedUid: true, providers: ["phone"] })).toBe("UNKNOWN");
  });
  it("NOT_LINKED when no uid is linked", () => {
    expect(classifyAuthProvider({ readable: true, hasLinkedUid: false, providers: [] })).toBe("NOT_LINKED");
  });
  it("GOOGLE when a google identity is present", () => {
    expect(classifyAuthProvider({ readable: true, hasLinkedUid: true, providers: ["google"] })).toBe("GOOGLE");
  });
  it("PHONE_OTP for a phone identity — even though prod stores phone uids in the email column", () => {
    expect(classifyAuthProvider({ readable: true, hasLinkedUid: true, providers: ["phone"] })).toBe("PHONE_OTP");
  });
  it("Google wins when both google and phone are linked (migration target)", () => {
    expect(classifyAuthProvider({ readable: true, hasLinkedUid: true, providers: ["phone", "google"] })).toBe(
      "GOOGLE",
    );
  });
  it("OTHER for an email identity", () => {
    expect(classifyAuthProvider({ readable: true, hasLinkedUid: true, providers: ["email"] })).toBe("OTHER");
  });
  it("OTHER when a uid is linked but no provider rows were found (readable, inconclusive)", () => {
    expect(classifyAuthProvider({ readable: true, hasLinkedUid: true, providers: [] })).toBe("OTHER");
  });
});

describe("rollUpClinicAuthProvider — clinic rollup", () => {
  const cases: [AuthProvider[], AuthProvider][] = [
    [[], "NOT_LINKED"],
    [["GOOGLE", "PHONE_OTP"], "GOOGLE"],
    [["PHONE_OTP", "NOT_LINKED"], "PHONE_OTP"],
    [["OTHER", "NOT_LINKED"], "OTHER"],
    [["NOT_LINKED"], "NOT_LINKED"],
    [["UNKNOWN"], "UNKNOWN"],
  ];
  it.each(cases)("%j rolls up to %s", (input, expected) => {
    expect(rollUpClinicAuthProvider(input)).toBe(expected);
  });
});
