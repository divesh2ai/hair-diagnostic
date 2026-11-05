import { describe, it, expect } from "vitest";
import {
  classifyAdoption,
  daysBetween,
  type AdoptionInput,
} from "@/lib/admin/opsDashboard/adoption";

const NOW = new Date("2026-11-05T12:00:00.000Z");
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

// A healthy, actively-using clinic; each test overrides the fact under test.
function base(overrides: Partial<AdoptionInput> = {}): AdoptionInput {
  return {
    status: "ACTIVE",
    authReadable: true,
    hasLinkedLogin: true,
    anySignedIn: true,
    hasDoctorActivity: true,
    assessmentsAllTime: 10,
    lastAssessmentAt: daysAgo(2),
    missingConsultation: false,
    reportDeliveryAttention: false,
    now: NOW,
    ...overrides,
  };
}

describe("daysBetween", () => {
  it("floors and never goes negative", () => {
    expect(daysBetween(daysAgo(3), NOW)).toBe(3);
    expect(daysBetween(new Date(NOW.getTime() + 1000), NOW)).toBe(0);
  });
});

describe("classifyAdoption — assessment-recency windows", () => {
  it("USING within 7 days, with no follow-up", () => {
    const r = classifyAdoption(base({ lastAssessmentAt: daysAgo(3) }));
    expect(r.status).toBe("USING");
    expect(r.daysSinceLastAssessment).toBe(3);
    expect(r.followUp.priority).toBeNull();
  });
  it("NEEDS_ENGAGEMENT at 7–13 days ⇒ priority 3", () => {
    const r = classifyAdoption(base({ lastAssessmentAt: daysAgo(10) }));
    expect(r.status).toBe("NEEDS_ENGAGEMENT");
    expect(r.followUp.priority).toBe(3);
  });
  it("DORMANT at 14+ days ⇒ priority 3", () => {
    const r = classifyAdoption(base({ lastAssessmentAt: daysAgo(30) }));
    expect(r.status).toBe("DORMANT");
    expect(r.followUp.priority).toBe(3);
  });
  it("exact boundary: 7 days is NEEDS_ENGAGEMENT, 13 still engagement, 14 dormant", () => {
    expect(classifyAdoption(base({ lastAssessmentAt: daysAgo(7) })).status).toBe("NEEDS_ENGAGEMENT");
    expect(classifyAdoption(base({ lastAssessmentAt: daysAgo(13) })).status).toBe("NEEDS_ENGAGEMENT");
    expect(classifyAdoption(base({ lastAssessmentAt: daysAgo(14) })).status).toBe("DORMANT");
  });
});

describe("classifyAdoption — onboarding states (no assessments)", () => {
  it("NOT_STARTED when login is linked but no assessments ⇒ priority 5", () => {
    const r = classifyAdoption(
      base({ assessmentsAllTime: 0, lastAssessmentAt: null, hasDoctorActivity: false }),
    );
    expect(r.status).toBe("NOT_STARTED");
    expect(r.daysSinceLastAssessment).toBeNull();
    expect(r.followUp.priority).toBe(5);
  });
  it("LOGIN_PENDING when no linked login ⇒ priority 1", () => {
    const r = classifyAdoption(
      base({
        assessmentsAllTime: 0,
        lastAssessmentAt: null,
        hasLinkedLogin: false,
        anySignedIn: false,
        hasDoctorActivity: false,
      }),
    );
    expect(r.status).toBe("LOGIN_PENDING");
    expect(r.followUp.priority).toBe(1);
  });
  it("UNKNOWN when auth unreadable and no login and no assessments", () => {
    const r = classifyAdoption(
      base({
        assessmentsAllTime: 0,
        lastAssessmentAt: null,
        authReadable: false,
        hasLinkedLogin: false,
        anySignedIn: false,
        hasDoctorActivity: false,
      }),
    );
    expect(r.status).toBe("UNKNOWN");
    expect(r.followUp.priority).toBeNull();
  });
});

describe("classifyAdoption — follow-up priority order", () => {
  it("no-login (P1) beats a pipeline issue", () => {
    const r = classifyAdoption(base({ hasLinkedLogin: false, missingConsultation: true }));
    expect(r.followUp.priority).toBe(1);
  });
  it("pipeline/report block (P2) beats recency and no-activity, even when USING", () => {
    const r = classifyAdoption(base({ missingConsultation: true }));
    expect(r.status).toBe("USING");
    expect(r.followUp.priority).toBe(2);
  });
  it("logged in but no doctor activity (P4) when recent and no pipeline issue", () => {
    const r = classifyAdoption(base({ hasDoctorActivity: false }));
    expect(r.status).toBe("USING");
    expect(r.followUp.priority).toBe(4);
  });
  it("archived ⇒ UNKNOWN and no follow-up", () => {
    const r = classifyAdoption(base({ status: "ARCHIVED", missingConsultation: true }));
    expect(r.status).toBe("UNKNOWN");
    expect(r.followUp.priority).toBeNull();
  });
});
