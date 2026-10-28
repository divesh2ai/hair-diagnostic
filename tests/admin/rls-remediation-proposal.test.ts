// Clinic-isolation regression guard for the B4 RLS remediation proposal.
//
// This does NOT touch a database. It statically verifies that the proposed
// remediation (prisma/proposals/20261028_rls_remediation_17_tables.PROPOSED.sql)
// covers EVERY table the Supabase advisor flagged as RLS-disabled, and that each
// one gets both RLS enabled AND a clinic-scoped (or super-admin) policy. If a
// future edit drops a table or a policy, this fails — so the proposal cannot
// silently regress to leaving a sensitive table exposed.
//
// The live, DB-level negative tests (anon key sees 0 rows; a clinic-A JWT sees
// 0 clinic-B rows) are listed in the SQL file's "Post-apply verification"
// section and must be run against staging AFTER the migration is applied; they
// require an authenticated PostgREST connection and are out of scope for a unit
// test. This guard protects the thing we can protect now: completeness.
//
// Runner: vitest (`npm test`).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// The 17 tables flagged rls_disabled_in_public by the Supabase advisor (staging).
const FLAGGED_TABLES = [
  "ReportAsset",
  "SupportTicket",
  "SupportMessage",
  "KitOrderPayment",
  "ClinicKitFulfilment",
  "Appointment",
  "Brochure",
  "BrochureHotspot",
  "DoctorAddress",
  "CatalogCart",
  "CatalogCartItem",
  "CatalogOrder",
  "CatalogOrderItem",
  "PaymentTransaction",
  "CatalogShipment",
  "CatalogShipmentEvent",
  "CatalogueEvent",
] as const;

const sql = readFileSync(
  path.resolve(
    process.cwd(),
    "prisma/proposals/20261028_rls_remediation_17_tables.PROPOSED.sql",
  ),
  "utf8",
);

describe("B4 RLS remediation proposal — completeness", () => {
  it("covers exactly the 17 advisor-flagged tables (no more, no fewer)", () => {
    const enabled = [
      ...sql.matchAll(/ALTER TABLE "([A-Za-z]+)" ENABLE ROW LEVEL SECURITY/g),
    ].map((m) => m[1]);
    expect(new Set(enabled)).toEqual(new Set(FLAGGED_TABLES));
  });

  for (const table of FLAGGED_TABLES) {
    it(`${table}: RLS enabled + at least one policy`, () => {
      expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      const policyRe = new RegExp(`CREATE POLICY "[^"]+" ON "${table}"`);
      expect(policyRe.test(sql)).toBe(true);
    });
  }

  it("every policy grants SUPER_ADMIN and scopes the rest to a clinic", () => {
    // Each CREATE POLICY ... USING (...) block must reference the super-admin
    // escape hatch and a clinic-scoping helper — never an unconditional `true`.
    const blocks = sql.split(/CREATE POLICY /).slice(1);
    const policyBlocks = blocks.filter((b) => /\bON "[A-Za-z]+"/.test(b));
    expect(policyBlocks.length).toBeGreaterThanOrEqual(FLAGGED_TABLES.length);
    for (const b of policyBlocks) {
      const head = b.slice(0, 600);
      expect(head).toContain("jwt_is_super_admin()");
      expect(
        /jwt_is_clinic_member\(|jwt_is_member_of_doctor_clinic\(|jwt_is_member_of_order_clinic\(/.test(
          head,
        ),
      ).toBe(true);
    }
  });

  it("is a review-only proposal, not an applied migration", () => {
    // Guard against it being mistaken for an auto-applied migration: it must
    // live under prisma/proposals/ and be labelled NOT APPLIED.
    expect(sql).toMatch(/NOT APPLIED/);
    expect(sql).toMatch(/FOR REVIEW/);
  });
});
