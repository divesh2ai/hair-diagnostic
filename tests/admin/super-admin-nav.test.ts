// Super Admin information architecture — the sidebar contract (HairOS Phase 1).
//
// Phase 1 fixes the console to four primary destinations the operator lives in
// — Overview, Clinics, Doctors & Access, Operations & Reports — plus one
// grouped "Settings & Audit" shelf (clinical governance, audit & security,
// support, platform settings). India Network is deliberately NOT a Phase 1
// destination. This locks that shape so a future change has to be deliberate
// rather than accidental: destinations creep back one at a time, and each one
// always looks individually reasonable.
//
// Runner: JEST. `npm test` is vitest and will mis-report this file.
//   npx jest tests/admin/super-admin-nav.test.ts

import { describe, it, expect } from "@jest/globals";
// Imported from the module rather than the barrel: the barrel also re-exports
// ./icons.tsx, and jest's moduleFileExtensions here does not include tsx.
// Reaching past the barrel keeps this test from depending on global config.
import { navForRole } from "@/lib/navigation/nav";

const nav = navForRole("SUPER_ADMIN");
const hrefs = nav.flatMap((s) => s.items.map((i) => i.href));

describe("Super Admin primary navigation", () => {
  it("exposes exactly eight destinations", () => {
    expect(hrefs).toHaveLength(8);
  });

  it("exposes exactly the agreed destinations, in order", () => {
    expect(hrefs).toEqual([
      "/admin",
      "/admin/clinics",
      "/admin/people",
      "/admin/operations",
      "/admin/clinical-governance",
      "/admin/audit",
      "/admin/support",
      "/admin/settings",
    ]);
  });

  it("leads the Overview with the four primary jobs, in order", () => {
    // Overview, Clinics, Doctors & Access, Operations & Reports — the four
    // destinations the operator lives in, as a single unlabelled group.
    expect(nav[0]!.items.map((i) => i.href)).toEqual([
      "/admin",
      "/admin/clinics",
      "/admin/people",
      "/admin/operations",
    ]);
  });

  it("labels the first four destinations for the Phase 1 jobs", () => {
    const byHref = Object.fromEntries(
      nav.flatMap((s) => s.items).map((i) => [i.href, i.labelKey]),
    );
    expect(byHref["/admin"]).toBe("nav.overview");
    expect(byHref["/admin/clinics"]).toBe("nav.clinics");
    expect(byHref["/admin/people"]).toBe("nav.doctorsAccess");
    expect(byHref["/admin/operations"]).toBe("nav.operationsReports");
  });

  it.each([
    ["/admin/action-centre", "its content now leads the Overview"],
    ["/admin/orders", "it is a tab inside Operations & Reports"],
    ["/admin/fulfilment", "it is a tab inside Operations & Reports"],
    ["/admin/knowledge-review", "it belongs under Clinical Governance"],
    ["/admin/network", "India Network is out of Phase 1 scope"],
  ])("does not surface %s as a top-level destination (%s)", (href) => {
    expect(hrefs).not.toContain(href);
  });

  it("groups destinations into the four primary jobs plus a settings shelf", () => {
    // Two groups: an unlabelled lead group of the four primary destinations,
    // and a labelled "Settings & Audit" shelf for configuration and the audit
    // trail. The first is intentionally unlabelled.
    expect(nav).toHaveLength(2);
    expect(nav[0]!.labelKey).toBeNull();
    expect(nav[1]!.labelKey).toBe("nav.sectionSettingsAudit");
  });

  it("keeps every group non-empty", () => {
    // An empty group renders as a heading with nothing under it.
    expect(nav.every((s) => s.items.length > 0)).toBe(true);
  });

  it("gives every destination a translation key, never a hardcoded label", () => {
    for (const section of nav) {
      for (const item of section.items) {
        expect(typeof item.labelKey).toBe("string");
        expect(item.labelKey.startsWith("nav.")).toBe(true);
      }
    }
  });

  it("renames Audit to the Audit & Security key while keeping its route", () => {
    // Route churn for a label change would break every existing bookmark and
    // deep link for no product benefit.
    const audit = nav
      .flatMap((s) => s.items)
      .find((i) => i.href === "/admin/audit");
    expect(audit?.labelKey).toBe("nav.auditSecurity");
  });

  it("does not regress the other roles", () => {
    // A Super Admin IA change must not leak into the clinic or doctor consoles.
    expect(navForRole("DOCTOR").flatMap((s) => s.items.map((i) => i.href))).toContain(
      "/doctor",
    );
    expect(
      navForRole("CLINIC_ADMIN").flatMap((s) => s.items.map((i) => i.href)),
    ).toContain("/clinic");
  });
});
