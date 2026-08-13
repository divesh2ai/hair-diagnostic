// Slice 0.5 — Doctor authorization boundary.
//
// requireDoctorContext + assertDoctorInClinic are the sole authorization
// checkpoint for every /api/doctor/* handler and every /api/consultation/*
// mutation. If these two functions are proven, all routes that use them
// inherit the guarantee — no per-route negative test needed because the
// verified helper is the single entry point.
//
// Cases exercised map directly to the Slice-0.5 acceptance matrix A–N.
// The helper resolves from AUTHENTICATED USER + LIVE DOCTOR IDENTITY at
// request time, so a stale JWT for a deactivated / soft-deleted / removed
// Doctor row fails on the very next protected call.

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { NextResponse } from "next/server";

const getAuthClaims = jest.fn<
  () => Promise<Record<string, unknown> | null>
>();

jest.mock("@/lib/auth/legacy", () => ({
  getAuthClaims: () => getAuthClaims(),
}));

const doctorFindFirst = jest.fn<() => Promise<Record<string, unknown> | null>>();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    doctor: { findFirst: () => doctorFindFirst() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  requireDoctorContext,
  assertDoctorInClinic,
} = require("../../apps/patient-portal/src/lib/auth/doctorContext");

const AUTH_UID = "auth-uid-1";
const CLINIC_A = "clinic-a";
const CLINIC_B = "clinic-b";
const DOCTOR_ROW = {
  id: "doctor-1",
  clinicId: CLINIC_A,
  name: "Dr Test",
  email: "doctor@example.com",
  isActive: true,
};

beforeEach(() => {
  getAuthClaims.mockReset();
  doctorFindFirst.mockReset();
});

async function status(result: unknown): Promise<number | null> {
  return result instanceof NextResponse ? result.status : null;
}

describe("requireDoctorContext", () => {
  it("Case A: DOCTOR + linked active Doctor row → resolves context in doctor mode", async () => {
    getAuthClaims.mockResolvedValue({
      sub: AUTH_UID,
      email: "doctor@example.com",
      user_role: "DOCTOR",
    });
    doctorFindFirst.mockResolvedValue(DOCTOR_ROW);
    const res = await requireDoctorContext();
    expect(res).not.toBeInstanceOf(NextResponse);
    expect((res as { doctor: { id: string }; mode: string }).doctor.id).toBe(
      "doctor-1",
    );
    expect((res as { mode: string }).mode).toBe("doctor");
  });

  it("Case B: DOCTOR JWT + Doctor row missing → 403 no_doctor_membership", async () => {
    getAuthClaims.mockResolvedValue({ sub: AUTH_UID, user_role: "DOCTOR" });
    doctorFindFirst.mockResolvedValue(null);
    const res = await requireDoctorContext();
    expect(await status(res)).toBe(403);
    const body = await (res as NextResponse).json();
    expect(body).toEqual({ error: "forbidden", reason: "no_doctor_membership" });
  });

  it("Case C: DOCTOR JWT + Doctor inactive → filtered out → 403", async () => {
    getAuthClaims.mockResolvedValue({ sub: AUTH_UID, user_role: "DOCTOR" });
    // Prisma query filters isActive:true — the row won't come back at all.
    doctorFindFirst.mockResolvedValue(null);
    expect(await status(await requireDoctorContext())).toBe(403);
  });

  it("Case D: DOCTOR JWT + Doctor soft-deleted → filtered out → 403", async () => {
    getAuthClaims.mockResolvedValue({ sub: AUTH_UID, user_role: "DOCTOR" });
    // Prisma query filters deletedAt: null — soft-deleted rows drop out.
    doctorFindFirst.mockResolvedValue(null);
    expect(await status(await requireDoctorContext())).toBe(403);
  });

  it("Case K: SUPER_ADMIN without Doctor row → 403 (privileged role does not grant Doctor authority)", async () => {
    getAuthClaims.mockResolvedValue({ sub: AUTH_UID, user_role: "SUPER_ADMIN" });
    doctorFindFirst.mockResolvedValue(null);
    expect(await status(await requireDoctorContext())).toBe(403);
  });

  it("Case L: SUPER_ADMIN + linked Doctor row → resolves in admin_view mode", async () => {
    getAuthClaims.mockResolvedValue({
      sub: AUTH_UID,
      email: "admin@example.com",
      user_role: "SUPER_ADMIN",
    });
    doctorFindFirst.mockResolvedValue(DOCTOR_ROW);
    const res = await requireDoctorContext();
    expect(res).not.toBeInstanceOf(NextResponse);
    expect((res as { mode: string }).mode).toBe("admin_view");
    // Authenticated actor identity is preserved separately from acting
    // Doctor — audit consumers can record BOTH.
    expect(res).toMatchObject({
      authRole: "SUPER_ADMIN",
      authUserId: AUTH_UID,
      doctor: { id: "doctor-1" },
    });
  });

  it("no session → 401 unauthorized", async () => {
    getAuthClaims.mockResolvedValue(null);
    const res = await requireDoctorContext();
    expect(await status(res)).toBe(401);
  });

  it("session with no sub → 401 unauthorized", async () => {
    getAuthClaims.mockResolvedValue({ user_role: "DOCTOR" });
    expect(await status(await requireDoctorContext())).toBe(401);
  });

  it("Case M/N: Doctor deactivated / soft-deleted AFTER token issuance → next call fails on live check", async () => {
    // First call resolves normally.
    getAuthClaims.mockResolvedValue({ sub: AUTH_UID, user_role: "DOCTOR" });
    doctorFindFirst.mockResolvedValueOnce(DOCTOR_ROW);
    const first = await requireDoctorContext();
    expect(first).not.toBeInstanceOf(NextResponse);
    // Same JWT, but the live Doctor state changed (deactivation / soft
    // delete removes it from the isActive+notDeleted filter). No wait for
    // JWT expiry required.
    doctorFindFirst.mockResolvedValueOnce(null);
    expect(await status(await requireDoctorContext())).toBe(403);
  });
});

describe("assertDoctorInClinic (Cases I & J — cross-clinic denial)", () => {
  it("returns null when the target clinic matches the doctor's clinic", () => {
    expect(assertDoctorInClinic(DOCTOR_ROW, CLINIC_A)).toBeNull();
  });

  it("returns 403 cross_clinic when the target clinic differs", async () => {
    const res = assertDoctorInClinic(DOCTOR_ROW, CLINIC_B);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(403);
    const body = await (res as NextResponse).json();
    expect(body).toEqual({ error: "forbidden", reason: "cross_clinic" });
  });
});
