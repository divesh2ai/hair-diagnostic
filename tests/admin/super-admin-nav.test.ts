// Super Admin information architecture — the sidebar contract.
//
// The sidebar had grown to ten top-level entries that described the system's
// internal services rather than the operator's jobs. This locks the
// consolidated shape so a future change has to be deliberate rather than
// accidental: destinations creep back one at a time, and each one always looks
// individually reasonable.
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
  it("exposes exactly seven destinations", () => {
    expect(hrefs).toHaveLength(7);
  });

  it("exposes exactly the agreed destinations, in order", () => {
    expect(hrefs).toEqual([
      "/admin",
      "/admin/clinics",
      "/admin/people",
      "/admin/operations",
      "/admin/clinical-governance",
      "/admin/audit",
      "/admin/settings",
    ]);
  });

  it.each([
    ["/admin/action-centre", "its content now leads the Dashboard"],
    ["/admin/orders", "it is a tab inside Operations"],
    ["/admin/fulfilment", "it is a tab inside Operations"],
    ["/admin/knowledge-review", "it belongs under Clinical Governance"],
  ])("does not surface %s as a top-level destination (%s)", (href) => {
    expect(hrefs).not.toContain(href);
  });

  it("groups destinations rather than listing ten flat items", () => {
    // Five groups: unlabelled Dashboard, Network, Operations, Governance,
    // System. The first is intentionally unlabelled — a single item does not
    // need a heading above it.
    expect(nav).toHaveLength(5);
    expect(nav[0]!.labelKey).toBeNull();
    expect(nav.slice(1).every((s) => s.labelKey !== null)).toBe(true);
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
