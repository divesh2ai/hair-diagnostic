import { afterEach, describe, expect, it, vi } from "vitest";
import { DOCTOR_IDLE_MS, DOCTOR_SESSION_SECONDS, isDoctorSessionCurrent } from "../../apps/patient-portal/src/lib/auth/doctorSessionPolicy";
import { doctorScreenCookie, doctorScreenIsUnlocked, googleSessionBinding, matchesGoogleSessionBinding } from "../../apps/patient-portal/src/lib/auth/googleSessionBinding";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("doctor session deadlines", () => {
  it("expires exactly 30 days from creation regardless of token refresh", () => {
    vi.useFakeTimers();
    const createdAt = new Date("2026-11-13T09:00:00Z");
    vi.setSystemTime(createdAt);
    vi.advanceTimersByTime(DOCTOR_SESSION_SECONDS * 1000 - 1);
    expect(isDoctorSessionCurrent(createdAt)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isDoctorSessionCurrent(createdAt)).toBe(false);
  });

  it("expires the idle cookie independently and binds it to the originating session", () => {
    vi.stubEnv("REVIEW_TOKEN_SECRET", "test-session-signing-secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T09:00:00Z"));
    const binding = googleSessionBinding("session-a");
    const screen = doctorScreenCookie(binding);
    expect(matchesGoogleSessionBinding("session-b", binding)).toBe(false);
    expect(doctorScreenIsUnlocked(googleSessionBinding("session-b"), screen)).toBe(false);
    expect(doctorScreenIsUnlocked(binding, screen + "x")).toBe(false);
    vi.advanceTimersByTime(DOCTOR_IDLE_MS - 1);
    expect(doctorScreenIsUnlocked(binding, screen)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(doctorScreenIsUnlocked(binding, screen)).toBe(false);
  });
});
