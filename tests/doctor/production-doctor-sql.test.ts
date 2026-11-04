import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

it("rehearses the exact additive Doctor SQL package with browser writes denied", async () => {
  const pg = await PGlite.create();
  try {
    await pg.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE FUNCTION jwt_user_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'DOCTOR'::text $$;
      CREATE FUNCTION jwt_is_super_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
      CREATE FUNCTION jwt_is_clinic_member(id text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
      CREATE TABLE "Clinic"(id text PRIMARY KEY);
      CREATE TABLE "Doctor"(id text PRIMARY KEY,"clinicId" text);
      CREATE TABLE "Patient"(id text PRIMARY KEY,"clinicId" text);
      CREATE TABLE "Assessment"(id text PRIMARY KEY,"clinicId" text,"patientId" text);
      CREATE TABLE "Consultation"(id text PRIMARY KEY,"clinicId" text,"patientId" text);
      CREATE TABLE "ConsultationVersion"(id text PRIMARY KEY);
      CREATE TABLE "KitOrderIntent"(id text PRIMARY KEY,"clinicId" text,"assessmentId" text,"kitIds" text[]);
    `);
    for (const name of ["01-payment-prerequisite", "02-notes-and-ledger", "03-partial-checkout"]) {
      await pg.exec(readFileSync(`docs/doctor-phase1/${name}.sql`, "utf8"));
    }
    const result = await pg.query<{ name: string; rls: boolean; can_insert: boolean; can_update: boolean; can_delete: boolean }>(`
      SELECT c.relname AS name, c.relrowsecurity AS rls,
        has_table_privilege('authenticated', c.oid, 'INSERT') AS can_insert,
        has_table_privilege('authenticated', c.oid, 'UPDATE') AS can_update,
        has_table_privilege('authenticated', c.oid, 'DELETE') AS can_delete
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('ConsultationNote','KitPurchaseLine','KitPurchaseEvent','KitPurchaseTransaction','KitOrderPayment')
    `);
    expect(result.rows).toHaveLength(5);
    for (const row of result.rows) {
      expect(row.rls).toBe(true);
      expect([row.can_insert, row.can_update, row.can_delete]).toEqual([false, false, false]);
    }
  } finally { await pg.close(); }
}, 30000);
