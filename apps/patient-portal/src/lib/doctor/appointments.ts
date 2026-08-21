import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSchemaDriftError } from "@/lib/prismaErrors";

// Appointment reads and writes, over raw SQL rather than the typed client.
//
// ── Why raw SQL ─────────────────────────────────────────────────────────────
// The `Appointment` model exists in schema.prisma and its migration exists at
// prisma/migrations/20260821_appointments, but the migration has NOT been
// applied: the 2026-08-20 baseline freeze holds until the canonical Supabase
// environment is chosen. `prisma.appointment.*` would therefore be a compile
// error on any checkout where `prisma generate` has not run since the schema
// change — which, under a freeze that forbids running it, is every checkout.
//
// Raw SQL removes that coupling entirely. This module compiles and the app
// boots whether the table exists or not; the only difference is what the
// queries below do at runtime, and that difference is handled explicitly.
//
// ── What happens before the migration runs ──────────────────────────────────
// Postgres answers "relation Appointment does not exist" (SQLSTATE 42P01).
// That is caught here and re-thrown as AppointmentsNotProvisionedError, which
// the API layer turns into a 503 with a stable reason code, which the calendar
// renders as "scheduling is not switched on yet" instead of a red error. The
// distinction matters: an empty calendar and an unprovisioned calendar look
// identical to a doctor unless the UI is told which one it is looking at.
//
// Applying the migration is the entire switch-on step. Nothing here changes.

export const APPOINTMENTS_NOT_PROVISIONED = "appointments_not_provisioned";

export class AppointmentsNotProvisionedError extends Error {
  readonly reason = APPOINTMENTS_NOT_PROVISIONED;
  constructor() {
    super(
      "Appointment table is not provisioned. Apply prisma/migrations/20260821_appointments.",
    );
    this.name = "AppointmentsNotProvisionedError";
  }
}

/**
 * Did this query fail because the Appointment table (or its enum type) is not
 * in the database yet?
 *
 * Two shapes have to be recognised. `isSchemaDriftError` covers P2021/P2022,
 * which is what the TYPED client raises — relevant once someone regenerates
 * and a caller switches over. Raw queries do not get that treatment: they
 * surface as P2010 carrying the driver's own SQLSTATE, so the code is matched
 * directly. 42P01 is undefined_table, 42704 is undefined_object, which is what
 * casting to the missing `AppointmentStatus` enum reports.
 */
function isMissingAppointmentTable(err: unknown): boolean {
  if (isSchemaDriftError(err)) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    if (meta.code === "42P01" || meta.code === "42704") return true;
    return /does not exist/i.test(meta.message ?? err.message);
  }
  return false;
}

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissingAppointmentTable(err)) throw new AppointmentsNotProvisionedError();
    throw err;
  }
}

/**
 * A cuid-shaped identifier.
 *
 * `@default(cuid())` in schema.prisma is applied by the Prisma client, which
 * this module deliberately bypasses, so the id has to be supplied with the
 * INSERT. It is generated in the same shape the rest of the platform uses —
 * `c` followed by lowercase base36 — so ids in this column stay
 * indistinguishable from every other table's, rather than this one table
 * carrying obvious UUIDs that mark exactly which rows predate the migration.
 * Randomness comes from the platform CSPRNG, not Math.random.
 */
function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
  return `c${Date.now().toString(36)}${rand}`.slice(0, 25);
}

export type AppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface AppointmentRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  doctorId: string;
  doctorName: string;
  /** ISO 8601, UTC. Render with lib/format/clinicDay. */
  scheduledAt: string;
  durationMinutes: number;
  reason: string | null;
  notes: string | null;
  status: AppointmentStatus;
}

interface RawRow {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  doctorId: string;
  doctorName: string;
  scheduledAt: Date;
  durationMinutes: number;
  reason: string | null;
  notes: string | null;
  status: AppointmentStatus;
}

function toRecord(r: RawRow): AppointmentRecord {
  return { ...r, scheduledAt: r.scheduledAt.toISOString() };
}

/**
 * Every appointment at this clinic inside a UTC window.
 *
 * Cancelled rows are included and carry their status: a doctor looking at a
 * past day needs to see that a slot was booked and called off, not an
 * unexplained gap. Callers that only want live bookings filter on status.
 */
export async function listAppointmentsInWindow(args: {
  clinicId: string;
  fromUtc: Date;
  toUtc: Date;
}): Promise<AppointmentRecord[]> {
  const rows = await guarded(() =>
    prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        a."id",
        a."patientId",
        p."name"  AS "patientName",
        p."phone" AS "patientPhone",
        a."doctorId",
        d."name"  AS "doctorName",
        a."scheduledAt",
        a."durationMinutes",
        a."reason",
        a."notes",
        a."status"::text AS "status"
      FROM "Appointment" a
      JOIN "Patient" p ON p."id" = a."patientId"
      JOIN "Doctor"  d ON d."id" = a."doctorId"
      WHERE a."clinicId" = ${args.clinicId}
        AND a."scheduledAt" >= ${args.fromUtc}
        AND a."scheduledAt" <  ${args.toUtc}
      ORDER BY a."scheduledAt" ASC
    `),
  );
  return rows.map(toRecord);
}

/**
 * The next live booking for each of the given patients.
 *
 * DISTINCT ON is the reason this is one query rather than N: Postgres keeps
 * the first row per patient under the ORDER BY, so the patient list gets its
 * "next visit" column without a query per row.
 */
export async function nextAppointmentByPatient(args: {
  clinicId: string;
  nowUtc?: Date;
}): Promise<Map<string, AppointmentRecord>> {
  const now = args.nowUtc ?? new Date();
  const rows = await guarded(() =>
    prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT DISTINCT ON (a."patientId")
        a."id",
        a."patientId",
        p."name"  AS "patientName",
        p."phone" AS "patientPhone",
        a."doctorId",
        d."name"  AS "doctorName",
        a."scheduledAt",
        a."durationMinutes",
        a."reason",
        a."notes",
        a."status"::text AS "status"
      FROM "Appointment" a
      JOIN "Patient" p ON p."id" = a."patientId"
      JOIN "Doctor"  d ON d."id" = a."doctorId"
      WHERE a."clinicId" = ${args.clinicId}
        AND a."status" = 'SCHEDULED'
        AND a."scheduledAt" >= ${now}
      ORDER BY a."patientId", a."scheduledAt" ASC
    `),
  );
  return new Map(rows.map((r) => [r.patientId, toRecord(r)]));
}

/** Book a future visit. The caller has already authorised clinic + patient. */
export async function createAppointment(args: {
  clinicId: string;
  patientId: string;
  doctorId: string;
  scheduledAt: Date;
  durationMinutes: number;
  reason: string | null;
  notes: string | null;
  createdByDoctorId: string;
}): Promise<AppointmentRecord> {
  const id = newId();
  await guarded(() =>
    prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Appointment" (
        "id", "clinicId", "patientId", "doctorId",
        "scheduledAt", "durationMinutes", "reason", "notes",
        "status", "createdByDoctorId", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${args.clinicId}, ${args.patientId}, ${args.doctorId},
        ${args.scheduledAt}, ${args.durationMinutes}, ${args.reason}, ${args.notes},
        'SCHEDULED', ${args.createdByDoctorId}, NOW(), NOW()
      )
    `),
  );

  const rows = await guarded(() =>
    prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        a."id",
        a."patientId",
        p."name"  AS "patientName",
        p."phone" AS "patientPhone",
        a."doctorId",
        d."name"  AS "doctorName",
        a."scheduledAt",
        a."durationMinutes",
        a."reason",
        a."notes",
        a."status"::text AS "status"
      FROM "Appointment" a
      JOIN "Patient" p ON p."id" = a."patientId"
      JOIN "Doctor"  d ON d."id" = a."doctorId"
      WHERE a."id" = ${id}
    `),
  );
  return toRecord(rows[0]);
}

/**
 * Cancel a booking.
 *
 * A soft transition, not a DELETE. The clinic's record of the day should show
 * that a slot was held and released; erasing the row would make an afternoon
 * that was fully booked and then emptied look like an afternoon nobody ever
 * asked for.
 *
 * `clinicId` is in the WHERE clause, not merely checked beforehand, so a
 * cross-clinic id cannot be cancelled even if a caller forgets to assert it.
 * Returns false when nothing matched — wrong clinic, unknown id, or already
 * cancelled.
 */
export async function cancelAppointment(args: {
  id: string;
  clinicId: string;
}): Promise<boolean> {
  const count = await guarded(() =>
    prisma.$executeRaw(Prisma.sql`
      UPDATE "Appointment"
         SET "status" = 'CANCELLED',
             "cancelledAt" = NOW(),
             "updatedAt" = NOW()
       WHERE "id" = ${args.id}
         AND "clinicId" = ${args.clinicId}
         AND "status" = 'SCHEDULED'
    `),
  );
  return count > 0;
}
