import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { assertDoctorInClinic } from "@/lib/auth/doctorContext";

// Tenant isolation on the doctor surface, asserted two ways:
//
//   1. the guard itself refuses a foreign clinic, and
//   2. no doctor route ever reads a clinic id off the request.
//
// The second is the one that matters for a forged `clinicId`. A guard is only
// as good as the value it is handed, and the whole isolation story here rests
// on that value coming from the authenticated Doctor row rather than from the
// browser. That is a property of the SOURCE, so it is checked against the
// source — a mocked request would only prove the mock.

const OWN = { id: "doc-1", clinicId: "clinic-a", name: "Dr A", email: null, isActive: true };

describe("assertDoctorInClinic", () => {
  it("allows a resource in the doctor's own clinic", () => {
    expect(assertDoctorInClinic(OWN, "clinic-a")).toBeNull();
  });

  it("refuses a resource in another clinic", async () => {
    const res = assertDoctorInClinic(OWN, "clinic-b");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    await expect(res!.json()).resolves.toEqual({
      error: "forbidden",
      reason: "cross_clinic",
    });
  });

  it("refuses even an empty or malformed target clinic", () => {
    expect(assertDoctorInClinic(OWN, "")).not.toBeNull();
    expect(assertDoctorInClinic(OWN, "CLINIC-A")).not.toBeNull();
  });
});

// ── Static guard: no doctor route trusts a browser-supplied clinic ──────────

const DOCTOR_API_DIR = join(
  process.cwd(),
  "apps/patient-portal/src/app/api/doctor",
);

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

describe("no /api/doctor route accepts a clinic id from the request", () => {
  const files = routeFiles(DOCTOR_API_DIR);

  it("finds the doctor routes to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.slice(file.indexOf("api/doctor"));

    it(`${rel} derives its clinic from the authenticated doctor`, () => {
      const src = readFileSync(file, "utf8");

      // Any read of a `clinicId` request parameter is the forged-clinic hole.
      // `?clinicId=` was a real SUPER_ADMIN override here once; it was removed
      // deliberately, and this is what stops it coming back.
      expect(src).not.toMatch(/searchParams\.get\(\s*["'`]clinicId/);
      expect(src).not.toMatch(/\bq\.get\(\s*["'`]clinicId/);
      expect(src).not.toMatch(/body\s*\.\s*clinicId/);

      // And every route that mentions a clinic at all must be resolving the
      // authenticated doctor first.
      if (/clinicId/.test(src)) {
        expect(src).toMatch(/requireDoctorContext\(\)/);
      }
    });
  }
});
