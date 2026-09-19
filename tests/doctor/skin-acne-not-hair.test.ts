import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { reviewHref, isReviewUnavailable } from "@/lib/doctor/reviewHref";

// skin_acne is a fully implemented PATIENT questionnaire with no doctor review
// surface behind it. The danger is not that acne is unreviewable — it is that
// acne answers could reach the HAIR consultation, whose engines, fed inputs
// they do not recognise, once returned a confident "Telogen Effluvium" on a
// skin case.
//
// Two independent barriers have to hold, and this file guards both:
//   1. ROUTING  — nothing sends an acne case to the hair review URL.
//   2. THE READ — the hair payload refuses an acne record even if something did.
//
// Barrier 2 is the one that actually protects the patient. Barrier 1 exists so
// a doctor is never walked into the refusal and left reading it as a fault in
// the record.

const HAIR_REVIEW = /^\/doctor\/reports\/[^/]+$/;

describe("skin_acne routing — barrier 1", () => {
  it("never resolves to the hair consultation", () => {
    const href = reviewHref({ id: "a1", concern: "skin_acne" });
    expect(href).not.toMatch(HAIR_REVIEW);
    expect(href).toBe("/doctor/reports/a1/skin/review-unavailable");
  });

  it("is declared as having no review surface", () => {
    expect(isReviewUnavailable("skin_acne")).toBe(true);
    expect(isReviewUnavailable("hair")).toBe(false);
    expect(isReviewUnavailable("skin_pigmentation")).toBe(false);
    expect(isReviewUnavailable(null)).toBe(false);
  });

  it("still routes the supported skin surfaces to their own pages", () => {
    expect(reviewHref({ id: "a2", concern: "skin_pigmentation" })).toBe(
      "/doctor/reports/a2/skin/pigmentation",
    );
    expect(reviewHref({ id: "a3", concern: "skin_anti_ageing" })).toBe(
      "/doctor/reports/a3/skin/anti-ageing",
    );
  });

  it("keeps hair — and only hair — on the consultation route", () => {
    expect(reviewHref({ id: "a4", concern: "hair" })).toMatch(HAIR_REVIEW);
    // A legacy row with no recorded concern is a hair row; that is what the
    // column's absence meant before the skin tracks existed.
    expect(reviewHref({ id: "a5", concern: null })).toMatch(HAIR_REVIEW);
    expect(reviewHref({ id: "a6" })).toMatch(HAIR_REVIEW);
  });

  it("sends any UNKNOWN skin_* concern somewhere deliberate, never to hair by omission", () => {
    // The old `default:` branch swallowed every unlisted concern into the hair
    // route. If a future skin track is added without a destination, this test
    // is the thing that notices.
    const href = reviewHref({ id: "a7", concern: "skin_rosacea" });
    expect(href).not.toMatch(HAIR_REVIEW);
    expect(href).toBe("/doctor/reports/a7/skin/review-unavailable");
    expect(isReviewUnavailable("skin_rosacea")).toBe(true);
  });
});

describe("skin_acne read path — barrier 2", () => {
  const payload = readFileSync(
    join(process.cwd(), "apps/patient-portal/src/lib/consultation/reviewPayload.ts"),
    "utf8",
  );

  it("refuses every skin_ concern before the engines run", () => {
    expect(payload).toContain('target.concern?.startsWith("skin_")');
    expect(payload).toContain("CONSULTATION_NOT_APPLICABLE");
    // The refusal must come BEFORE the consultation is loaded/composed.
    expect(payload.indexOf('startsWith("skin_")')).toBeLessThan(
      payload.indexOf("loadConsultationReview({"),
    );
  });
});

describe("the acne holding surface", () => {
  const page = join(
    process.cwd(),
    "apps/patient-portal/src/app/doctor/reports/[assessmentId]/skin/review-unavailable/page.tsx",
  );

  it("exists, so the route acne is sent to is real", () => {
    expect(existsSync(page)).toBe(true);
  });

  const src = readFileSync(page, "utf8");

  it("states plainly that the case has not been clinically reviewed", () => {
    expect(src).toContain("doctor review is not available yet");
    expect(src).toContain("This case has not been clinically reviewed");
  });

  it("renders no clinical opinion of its own", () => {
    // Code shapes, not prose — the page's own copy has to stay free to say
    // "grading" and "plan" while explaining their absence. If any of these
    // appear, the holding page has started becoming the product it stands in
    // for.
    for (const forbidden of [
      "primaryDiagnosis",
      "SEVERITY_ANALYSIS",
      "buildConsultation",
      "loadConsultationReview",
      "treatmentPlan",
      "rankedKits",
      "AIArtifact",
    ]) {
      expect(src).not.toContain(forbidden);
    }
  });

  it("scopes to the caller's own clinic and refuses another's", () => {
    // The doctor must be resolved from the AUTHENTICATED caller, never from a
    // route param. That lookup moved into the shared `doctorAuthIdentityWhere`
    // helper when mobile-OTP login landed — a doctor now has two Supabase
    // identities (phone and email) and both must resolve the same row — so the
    // assertion follows it there. The guarantee is unchanged: the claim's
    // `sub`, and nothing else, chooses the doctor.
    expect(src).toContain("doctorAuthIdentityWhere(claims.sub)");
    expect(src).toContain("assessment.clinicId !== doctor.clinicId");
    expect(src).toContain("notFound()");
  });

  it("serves only skin tracks that genuinely have no review surface", () => {
    // Shares the predicate with the router, so a case cannot be routed here
    // and then refused by the page, or vice versa.
    expect(src).toContain("isReviewUnavailable(concern)");
  });

  it("preserves the record rather than mutating it", () => {
    expect(src).not.toMatch(/prisma\.\w+\.(update|delete|create|upsert)/);
  });
});
