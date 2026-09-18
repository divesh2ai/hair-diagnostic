// /post-login is the gate a doctor passes through immediately after OTP
// verification, and it was the last place still reading one identity column.
//
// ── The live failure these tests pin ────────────────────────────────────────
// Dr Divesh Shah at drfact-mumbai was linked by EMAIL, so his Doctor row held
// the email uid in `supabaseUserId` and, after the phone-link route ran, the
// phone uid in `supabasePhoneUserId`. His mobile OTP verified, the link route
// succeeded, and /post-login then looked him up by `supabaseUserId: ctx.userId`
// — with ctx.userId being the PHONE uid. No row matched, `hasDoctorRow` was
// false, and the DOCTOR branch fell through to /login?reason=forbidden:
//
//   "Your account doesn't have access. Contact your clinic admin if this
//    looks wrong."
//
// Verified, linked, and then refused by the screen after the one that let him
// in. These tests hold both identities open and keep every refusal that should
// still refuse.
//
// The prisma stand-in below EVALUATES the where clause rather than recording
// it, so a regression that silently drops `isActive`/`deletedAt`, or that
// widens the identity match into "any doctor", fails here rather than passing
// because the right helper was called.

import { describe, it, expect, vi, beforeEach } from "vitest";

const EMAIL_UID = "11111111-email-identity";
const PHONE_UID = "22222222-phone-identity";
const STRANGER_UID = "33333333-unknown-identity";

type DoctorRow = {
  id: string;
  clinicId: string;
  supabaseUserId: string | null;
  supabasePhoneUserId: string | null;
  isActive: boolean;
  deletedAt: Date | null;
};

// vi.mock factories are hoisted above every top-level binding, so everything
// they close over has to be hoisted with them.
const h = vi.hoisted(() => {
  const state: { doctors: any[] } = { doctors: [] };

  const ctxState: { userId: string; role: string; clinicId: string | null } = {
    userId: "22222222-phone-identity",
    role: "DOCTOR",
    clinicId: "clinic-1",
  };

  /** The subset of Prisma's where language these call sites actually use. */
  function matches(row: any, where: any): boolean {
    if (!where) return true;
    for (const [key, value] of Object.entries(where)) {
      if (key === "OR") {
        if (!(value as any[]).some((clause) => matches(row, clause))) return false;
        continue;
      }
      if (key === "AND") {
        if (!(value as any[]).every((clause) => matches(row, clause))) return false;
        continue;
      }
      const actual = row[key];
      if (value !== null && typeof value === "object" && "equals" in (value as any)) {
        if (actual !== (value as any).equals) return false;
        continue;
      }
      if (actual !== value) return false;
    }
    return true;
  }

  class UnauthorizedError extends Error {}

  return { state, ctxState, matches, UnauthorizedError };
});

const { state, ctxState } = h;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    doctor: {
      findFirst: async ({ where }: any) => {
        const hit = h.state.doctors.find((d) => h.matches(d, where));
        return hit ? { id: hit.id } : null;
      },
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getClinicContext: async () => ({ ...h.ctxState }),
  UnauthorizedError: h.UnauthorizedError,
}));

// `next/navigation` is deliberately NOT mocked: the page resolves it from the
// app's own node_modules, so a mock here never intercepts it. Using the real
// `redirect()` is the more faithful test anyway — it throws Next's actual
// control-flow error, and the destination is read back off the digest below.

import PostLoginPage from "@/app/post-login/page";

/**
 * Run the page and report where it sent the caller.
 *
 * Next signals a redirect by throwing an error whose `digest` is
 * `NEXT_REDIRECT;<kind>;<url>;<status>;` — that url is the assertion surface.
 */
async function landingFor(next?: string): Promise<string> {
  try {
    await PostLoginPage({
      searchParams: Promise.resolve(next ? { next } : {}),
    } as any);
  } catch (err) {
    const digest = (err as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";")[2];
    }
    throw err;
  }
  throw new Error("post-login returned without redirecting");
}

const liveDoctor = (over: Partial<DoctorRow> = {}): DoctorRow => ({
  id: "doctor-1",
  clinicId: "clinic-1",
  supabaseUserId: EMAIL_UID,
  supabasePhoneUserId: PHONE_UID,
  isActive: true,
  deletedAt: null,
  ...over,
});

beforeEach(() => {
  state.doctors = [];
  ctxState.userId = PHONE_UID;
  ctxState.role = "DOCTOR";
  ctxState.clinicId = "clinic-1";
});

describe("/post-login — doctor identity resolution", () => {
  it("admits the real case: email-linked doctor arriving on their phone uid", async () => {
    // The exact live row and the exact live session.
    state.doctors = [liveDoctor()];
    ctxState.userId = PHONE_UID;

    expect(await landingFor("/doctor")).toBe("/doctor");
  });

  it("does not bounce that doctor to /login?reason=forbidden", async () => {
    state.doctors = [liveDoctor()];
    ctxState.userId = PHONE_UID;

    const landing = await landingFor("/doctor");
    expect(landing).not.toContain("reason=forbidden");
  });

  it("routes the phone session to /doctor by role priority with no ?next", async () => {
    state.doctors = [liveDoctor()];
    ctxState.userId = PHONE_UID;

    expect(await landingFor()).toBe("/doctor");
  });

  it("still admits the email identity — the original channel is unbroken", async () => {
    state.doctors = [liveDoctor()];
    ctxState.userId = EMAIL_UID;

    expect(await landingFor("/doctor")).toBe("/doctor");
  });

  it("admits a phone-first doctor whose only identity is the phone column", async () => {
    // Never linked by email: supabaseUserId is still null.
    state.doctors = [liveDoctor({ supabaseUserId: null })];
    ctxState.userId = PHONE_UID;

    expect(await landingFor("/doctor")).toBe("/doctor");
  });
});

describe("/post-login — refusals that must keep refusing", () => {
  it("refuses an inactive doctor on the phone identity", async () => {
    state.doctors = [liveDoctor({ isActive: false })];
    ctxState.userId = PHONE_UID;

    expect(await landingFor("/doctor")).toBe("/login?reason=forbidden");
  });

  it("refuses a soft-deleted doctor on the phone identity", async () => {
    state.doctors = [liveDoctor({ deletedAt: new Date("2026-09-01") })];
    ctxState.userId = PHONE_UID;

    expect(await landingFor("/doctor")).toBe("/login?reason=forbidden");
  });

  it("refuses an auth identity linked to no doctor row", async () => {
    state.doctors = [liveDoctor()];
    ctxState.userId = STRANGER_UID;

    expect(await landingFor("/doctor")).toBe("/login?reason=forbidden");
  });

  it("refuses when no doctor rows exist at all — never matches everything", async () => {
    // Guards the empty-`where` failure mode: a helper that degraded into `{}`
    // would match the first row in the table and let a stranger in.
    state.doctors = [];
    ctxState.userId = PHONE_UID;

    expect(await landingFor("/doctor")).toBe("/login?reason=forbidden");
  });

  it("does not let another clinic's doctor answer for this identity", async () => {
    // Two live rows, neither carrying this uid. Resolution must stay keyed to
    // the identity columns, not fall back to "some active doctor".
    state.doctors = [
      liveDoctor({ id: "other-a", clinicId: "clinic-2", supabaseUserId: "x", supabasePhoneUserId: "y" }),
      liveDoctor({ id: "other-b", clinicId: "clinic-3", supabaseUserId: "p", supabasePhoneUserId: "q" }),
    ];
    ctxState.userId = PHONE_UID;

    expect(await landingFor("/doctor")).toBe("/login?reason=forbidden");
  });
});

describe("/post-login — role routing is unchanged by the identity fix", () => {
  it("sends an admin to /admin and ignores a ?next=/doctor they cannot enter", async () => {
    state.doctors = [];
    ctxState.role = "SUPER_ADMIN";
    ctxState.userId = STRANGER_UID;

    expect(await landingFor("/doctor")).toBe("/admin");
  });

  it("sends a clinic admin to /clinic", async () => {
    state.doctors = [];
    ctxState.role = "CLINIC_ADMIN";
    ctxState.userId = STRANGER_UID;

    expect(await landingFor()).toBe("/clinic");
  });

  it("sends a patient-ish role to /", async () => {
    state.doctors = [];
    ctxState.role = "PATIENT";
    ctxState.userId = STRANGER_UID;

    expect(await landingFor()).toBe("/");
  });

  it("honours ?next=/doctor for a doctor who genuinely has a row", async () => {
    state.doctors = [liveDoctor()];
    ctxState.role = "DOCTOR";
    ctxState.userId = PHONE_UID;

    expect(await landingFor("/doctor/reports")).toBe("/doctor/reports");
  });
});
