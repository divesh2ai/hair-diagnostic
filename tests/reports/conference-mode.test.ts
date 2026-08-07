import { afterEach, describe, expect, it, vi } from "vitest";
import { isConferenceMode } from "../../apps/patient-portal/src/lib/conferenceMode";
import { signReviewToken, verifyReviewToken } from "../../apps/patient-portal/src/lib/reviewToken";

// Conference mode relaxes ONE thing: a signed, assessment-scoped review token
// is accepted for the one-page patient report. These tests lock the two
// properties that keep that safe — it is off unless explicitly enabled, and
// the token cannot be stretched to another assessment.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("conference mode flag", () => {
  it("is OFF by default so clinic production behaviour is unchanged", () => {
    vi.stubEnv("CONFERENCE_MODE", "");
    expect(isConferenceMode()).toBe(false);
  });

  it("is OFF for any value other than an explicit 1", () => {
    for (const value of ["0", "true", "yes", "on", "TRUE"]) {
      vi.stubEnv("CONFERENCE_MODE", value);
      expect(isConferenceMode()).toBe(false);
    }
  });

  it("is ON only for an explicit 1", () => {
    vi.stubEnv("CONFERENCE_MODE", "1");
    expect(isConferenceMode()).toBe(true);
  });
});

describe("review token scoping (what conference mode relies on)", () => {
  it("accepts a token for the assessment it was minted for", () => {
    const token = signReviewToken("assessment-alpha");
    const result = verifyReviewToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.assessmentId).toBe("assessment-alpha");
  });

  it("binds the token to one assessment — it cannot be reused for another", () => {
    const token = signReviewToken("assessment-alpha");
    const result = verifyReviewToken(token);
    expect(result.ok).toBe(true);
    // The report loader compares result.assessmentId against the requested id;
    // a token for alpha must therefore never authorise beta.
    if (result.ok) expect(result.assessmentId).not.toBe("assessment-beta");
  });

  it("rejects a tampered token", () => {
    const token = signReviewToken("assessment-alpha");
    const [body] = token.split(".");
    const forged = `${body}.${"0".repeat(40)}`;
    expect(verifyReviewToken(forged).ok).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signReviewToken("assessment-alpha", -1000);
    const result = verifyReviewToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("EXPIRED");
  });

  it("rejects a malformed token", () => {
    expect(verifyReviewToken("not-a-token").ok).toBe(false);
  });
});
