import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The isolation claim, checked against every route rather than a sample.
//
// tests/api/doctor-authz.test.ts proves the two helpers behave correctly.
// That proof is only worth as much as its coverage: a single handler that
// forgets to call them, or that takes a clinic id from the request, reopens
// the whole boundary. So this file makes the coverage itself the assertion.
//
// Two properties, and they are the two that decide whether Doctor A can read
// Doctor B's patients by editing a URL:
//
//   1. Every doctor-facing handler resolves the caller's identity server-side.
//   2. No doctor-facing handler ever reads a clinic id OUT of the request.
//
// Property 2 is the one that matters most. A resource id in a path is fine —
// it is looked up and then checked against the caller's own clinic. A CLINIC
// id in a query string or body is not: it is the tenant selector, and a
// handler that accepts one from the caller has handed over the boundary
// however carefully it checks everything else.

const API_ROOT = join(
  process.cwd(),
  "apps",
  "patient-portal",
  "src",
  "app",
  "api",
);

const DOCTOR_SURFACES = ["doctor", "consultation"];

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

const ROUTES = DOCTOR_SURFACES.flatMap((s) => routeFiles(join(API_ROOT, s))).map(
  (path) => ({ path, rel: path.slice(API_ROOT.length + 1), src: readFileSync(path, "utf8") }),
);

// Two ways a handler may establish the caller's clinic, both server-side:
//
//   requireDoctorContext  reads the LIVE Doctor row at request time, so a
//                         doctor deactivated after their token was issued
//                         fails on the next call. The stronger of the two and
//                         the one every clinical handler uses.
//   requireRole           reads the verified JWT's clinic_id claim. Weaker —
//                         the claim can lag a clinic change until the token
//                         refreshes — but still server-side and still scoped.
const IDENTITY_SOURCES = ["requireDoctorContext", "requireRole"];

describe("doctor-facing route coverage", () => {
  it("finds the routes at all (a passing suite over zero files proves nothing)", () => {
    expect(ROUTES.length).toBeGreaterThan(20);
  });

  it.each(ROUTES.map((r) => [r.rel, r.src] as const))(
    "%s resolves the caller's identity server-side",
    (_rel, src) => {
      expect(IDENTITY_SOURCES.some((fn) => src.includes(fn))).toBe(true);
    },
  );

  it.each(ROUTES.map((r) => [r.rel, r.src] as const))(
    "%s never takes a clinic id from the request",
    (_rel, src) => {
      // Query string, route params and request body. A clinic id arriving by
      // any of these is a tenant selector the caller controls.
      const fromRequest = [
        /searchParams\s*\.\s*get\(\s*["'`]clinicId["'`]/,
        /params\s*\.\s*clinicId/,
        /body\s*\.\s*clinicId/,
        /\{\s*[^}]*\bclinicId\b[^}]*\}\s*=\s*(?:await\s+)?(?:body|req\.json\(\)|parsed\.data)/,
      ];
      for (const pattern of fromRequest) {
        expect(src).not.toMatch(pattern);
      }
    },
  );
});

describe("the two isolation helpers are not bypassed", () => {
  it("no doctor-facing route reaches Prisma without an identity check first", () => {
    // Ordering matters: a handler that queries and then authorizes has already
    // read the row. Every file that touches prisma must mention an identity
    // source at an earlier character offset.
    const violations = ROUTES.filter((r) => {
      const prismaAt = r.src.indexOf("prisma.");
      if (prismaAt === -1) return false;
      const identityAt = Math.min(
        ...IDENTITY_SOURCES.map((fn) => {
          // Skip the import line; the call is what matters.
          const idx = r.src.indexOf(`await ${fn}(`);
          return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
        }),
      );
      return identityAt > prismaAt;
    }).map((r) => r.rel);

    expect(violations).toEqual([]);
  });
});
