// Super Admin information architecture — the sidebar contract.
//
// Locks the approved seven-SECTION command-centre IA so a future change has to
// be deliberate rather than accidental. The nav exposes nine destinations
// across four visual groups: Overview; a "Clinics & Network" group (the clinic
// directory + the India network map, previously reachable only via the
// dashboard embed's "View full" link); a tight block of the four standalone
// primaries (Doctors & Access, Operations, Clinical Governance, Audit &
// Security); and a "Settings" group that also carries Help & Support.
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
  it("exposes exactly nine destinations", () => {
    expect(hrefs).toHaveLength(9);
  });

  it("exposes exactly the agreed destinations, in order", () => {
    expect(hrefs).toEqual([
      "/admin",
      "/admin/clinics",
      "/admin/network",
      "/admin/people",
      "/admin/operations",
      "/admin/clinical-governance",
      "/admin/audit",
      "/admin/settings",
      "/admin/support",
    ]);
  });

  it("surfaces the India clinic network map as a destination", () => {
    // The map was implemented and embedded on the dashboard, but had no
    // sidebar entry — reachable only via the embed's "View full" link. This
    // locks it in as a first-class destination.
    expect(hrefs).toContain("/admin/network");
  });

  it.each([
    ["/admin/action-centre", "its content now leads the Dashboard"],
    ["/admin/orders", "it is a tab inside Operations"],
    ["/admin/fulfilment", "it is a tab inside Operations"],
    ["/admin/knowledge-review", "it belongs under Clinical Governance"],
  ])("does not surface %s as a top-level destination (%s)", (href) => {
    expect(hrefs).not.toContain(href);
  });

  it("groups the nine destinations into the four command-centre blocks", () => {
    // [0] Overview (unlabelled — a single item needs no heading)
    // [1] "Clinics & Network"  (Clinics + India Network)
    // [2] the four standalone primaries (unlabelled, one tight block)
    // [3] "Settings"           (Platform Settings + Help & Support)
    expect(nav).toHaveLength(4);
    expect(nav[0]!.labelKey).toBeNull();
    expect(nav[0]!.items.map((i) => i.href)).toEqual(["/admin"]);

    expect(nav[1]!.labelKey).toBe("nav.sectionNetwork");
    expect(nav[1]!.items.map((i) => i.href)).toEqual([
      "/admin/clinics",
      "/admin/network",
    ]);

    expect(nav[2]!.labelKey).toBeNull();
    expect(nav[2]!.items.map((i) => i.href)).toEqual([
      "/admin/people",
      "/admin/operations",
      "/admin/clinical-governance",
      "/admin/audit",
    ]);

    // The Settings group carries both Platform Settings and Help & Support.
    expect(nav[3]!.items.map((i) => i.href)).toEqual([
      "/admin/settings",
      "/admin/support",
    ]);
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
