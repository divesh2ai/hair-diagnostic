import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSchemaDriftError } from "@/lib/prismaErrors";
import {
  STATUS_TIMESTAMP_COLUMN,
  canTransition,
  type FulfilmentStatus,
} from "./stateMachine";
import type { FulfilmentMode } from "./fulfilmentMode";

// Clinic kit fulfilment persistence, over raw SQL.
//
// Same reasoning as lib/doctor/appointments.ts and lib/delivery/deliveryStore:
// `ClinicKitFulfilment` exists in schema.prisma and in
// prisma/migrations/20260829_post_approval_workflow, but that migration has NOT
// been applied under the 2026-08-20 baseline freeze, so `prisma.clinicKitFulfilment`
// would be a compile error on every checkout. Raw SQL removes the coupling:
// this module compiles and the app boots whether the table exists or not, and
// callers get FulfilmentNotProvisionedError → 503 with a stable reason code
// instead of a stack trace.

export const FULFILMENT_NOT_PROVISIONED = "fulfilment_not_provisioned";

export class FulfilmentNotProvisionedError extends Error {
  readonly reason = FULFILMENT_NOT_PROVISIONED;
  constructor() {
    super(
      "ClinicKitFulfilment is not provisioned. Apply prisma/migrations/20260829_post_approval_workflow.",
    );
    this.name = "FulfilmentNotProvisionedError";
  }
}

function isMissing(err: unknown): boolean {
  if (isSchemaDriftError(err)) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    // 42P01 undefined_table, 42703 undefined_column, 42704 undefined_object
    // (the cast to a missing "KitFulfilmentStatus" enum).
    if (meta.code === "42P01" || meta.code === "42703" || meta.code === "42704") {
      return true;
    }
    return /does not exist/i.test(meta.message ?? err.message);
  }
  return false;
}

export async function guardedFulfilment<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissing(err)) throw new FulfilmentNotProvisionedError();
    throw err;
  }
}

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
  return `c${Date.now().toString(36)}${rand}`.slice(0, 25);
}

export interface FulfilmentRecord {
  id: string;
  kitOrderIntentId: string;
  clinicId: string;
  doctorId: string;
  assessmentId: string;
  mode: FulfilmentMode;
  status: FulfilmentStatus;
  /** ISO 8601. */
  requestedAt: string;
  confirmedAt: string | null;
  packedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  cancelledAt: string | null;
  acknowledgedByDoctorId: string | null;
  notes: string | null;
  updatedAt: string;
}

interface RawRow {
  id: string;
  kitOrderIntentId: string;
  clinicId: string;
  doctorId: string;
  assessmentId: string;
  mode: FulfilmentMode;
  status: FulfilmentStatus;
  requestedAt: Date;
  confirmedAt: Date | null;
  packedAt: Date | null;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  acknowledgedAt: Date | null;
  cancelledAt: Date | null;
  acknowledgedByDoctorId: string | null;
  notes: string | null;
  updatedAt: Date;
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

function toRecord(r: RawRow): FulfilmentRecord {
  return {
    id: r.id,
    kitOrderIntentId: r.kitOrderIntentId,
    clinicId: r.clinicId,
    doctorId: r.doctorId,
    assessmentId: r.assessmentId,
    mode: r.mode,
    status: r.status,
    requestedAt: r.requestedAt.toISOString(),
    confirmedAt: iso(r.confirmedAt),
    packedAt: iso(r.packedAt),
    dispatchedAt: iso(r.dispatchedAt),
    deliveredAt: iso(r.deliveredAt),
    acknowledgedAt: iso(r.acknowledgedAt),
    cancelledAt: iso(r.cancelledAt),
    acknowledgedByDoctorId: r.acknowledgedByDoctorId,
    notes: r.notes,
    updatedAt: r.updatedAt.toISOString(),
  };
}

const COLS = Prisma.sql`
  "id", "kitOrderIntentId", "clinicId", "doctorId", "assessmentId",
  "mode"::text AS "mode", "status"::text AS "status",
  "requestedAt", "confirmedAt", "packedAt", "dispatchedAt", "deliveredAt",
  "acknowledgedAt", "cancelledAt", "acknowledgedByDoctorId", "notes", "updatedAt"
`;

export interface EnsureFulfilmentInput {
  kitOrderIntentId: string;
  clinicId: string;
  doctorId: string;
  assessmentId: string;
  mode: FulfilmentMode;
}

export interface EnsureFulfilmentResult {
  fulfilment: FulfilmentRecord;
  /** False when a request already existed — i.e. this call was a duplicate. */
  created: boolean;
}

/**
 * Create the fulfilment request for an order, exactly once.
 *
 * ── How the idempotency actually works ──────────────────────────────────────
 * `ON CONFLICT ("kitOrderIntentId") DO NOTHING` against the UNIQUE index, not
 * a read-then-write. Two payment webhooks arriving in the same millisecond —
 * the ordinary behaviour of every gateway's retry policy — both run this
 * INSERT; the database serialises them and exactly one gets a row back. The
 * loser reads the winner's row and reports `created: false`.
 *
 * A "check if it exists, then insert" version has a window between the two
 * statements that both callers can pass through, and the failure it produces
 * is two fulfilment requests for one order: ops packs the kit twice.
 *
 * `tx` is accepted so the caller can commit this in the same transaction as
 * the payment row it was triggered by. A fulfilment request that survives a
 * rolled-back payment is a kit shipped for money that never arrived.
 */
export async function ensureFulfilmentRequest(
  input: EnsureFulfilmentInput,
  tx?: Prisma.TransactionClient,
): Promise<EnsureFulfilmentResult> {
  const client = tx ?? prisma;
  const id = newId();

  return guardedFulfilment(async () => {
    const inserted = await client.$queryRaw<RawRow[]>(Prisma.sql`
      INSERT INTO "ClinicKitFulfilment" (
        "id", "kitOrderIntentId", "clinicId", "doctorId", "assessmentId",
        "mode", "status", "requestedAt", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${input.kitOrderIntentId}, ${input.clinicId}, ${input.doctorId},
        ${input.assessmentId}, ${input.mode}::"KitFulfilmentMode",
        'REQUESTED'::"KitFulfilmentStatus", NOW(), NOW(), NOW()
      )
      ON CONFLICT ("kitOrderIntentId") DO NOTHING
      RETURNING ${COLS}
    `);

    if (inserted[0]) {
      return { fulfilment: toRecord(inserted[0]), created: true };
    }

    const existing = await client.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "ClinicKitFulfilment"
       WHERE "kitOrderIntentId" = ${input.kitOrderIntentId}
    `);
    // The conflict fired, so a row is there. If it somehow is not, the
    // constraint has been altered underneath us and silently inventing a
    // success would be worse than the error.
    if (!existing[0]) {
      throw new Error("fulfilment_conflict_without_row");
    }
    return { fulfilment: toRecord(existing[0]), created: false };
  });
}

export async function readFulfilmentByIntent(
  kitOrderIntentId: string,
): Promise<FulfilmentRecord | null> {
  return guardedFulfilment(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "ClinicKitFulfilment"
       WHERE "kitOrderIntentId" = ${kitOrderIntentId}
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  });
}

export async function readFulfilmentByAssessment(
  assessmentId: string,
): Promise<FulfilmentRecord | null> {
  return guardedFulfilment(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "ClinicKitFulfilment"
       WHERE "assessmentId" = ${assessmentId}
       ORDER BY "requestedAt" DESC
       LIMIT 1
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  });
}

export async function readFulfilmentById(
  id: string,
): Promise<FulfilmentRecord | null> {
  return guardedFulfilment(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "ClinicKitFulfilment" WHERE "id" = ${id}
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  });
}

export interface FulfilmentQueueRow extends FulfilmentRecord {
  clinicName: string | null;
  doctorName: string | null;
  kitCount: number;
  paymentStatus: string | null;
  paidAt: string | null;
}

/**
 * The ops queue.
 *
 * `clinicId` is a required parameter with an explicit `null` for "all
 * tenants", rather than an optional filter. An optional tenant filter is one a
 * caller eventually forgets to pass, and the failure mode is a clinic-scoped
 * page rendering every clinic's orders.
 *
 * Joins out for the clinic and doctor NAME, and for the kit COUNT — never the
 * kit lineup, never the patient. Ops needs to know which order to pack and how
 * big it is.
 */
export async function listFulfilments(options: {
  clinicId: string | null;
  statuses?: readonly FulfilmentStatus[];
  limit?: number;
}): Promise<FulfilmentQueueRow[]> {
  const { clinicId, statuses, limit = 100 } = options;

  return guardedFulfilment(async () => {
    const clinicScope = clinicId
      ? Prisma.sql`AND f."clinicId" = ${clinicId}`
      : Prisma.empty;

    const statusScope =
      statuses && statuses.length > 0
        ? Prisma.sql`AND f."status"::text IN (${Prisma.join([...statuses])})`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<
        RawRow & {
          clinicName: string | null;
          doctorName: string | null;
          kitCount: number;
          paymentStatus: string | null;
          paidAt: Date | null;
        }
      >
    >(Prisma.sql`
      SELECT f."id", f."kitOrderIntentId", f."clinicId", f."doctorId",
             f."assessmentId", f."mode"::text AS "mode", f."status"::text AS "status",
             f."requestedAt", f."confirmedAt", f."packedAt", f."dispatchedAt",
             f."deliveredAt", f."acknowledgedAt", f."cancelledAt",
             f."acknowledgedByDoctorId", f."notes", f."updatedAt",
             c."name" AS "clinicName",
             d."name" AS "doctorName",
             COALESCE(array_length(i."kitIds", 1), 0)::int AS "kitCount",
             p."status"::text AS "paymentStatus",
             p."paidAt"
        FROM "ClinicKitFulfilment" f
        LEFT JOIN "Clinic" c         ON c."id" = f."clinicId"
        LEFT JOIN "Doctor" d         ON d."id" = f."doctorId"
        LEFT JOIN "KitOrderIntent" i ON i."id" = f."kitOrderIntentId"
        LEFT JOIN "KitOrderPayment" p ON p."kitOrderIntentId" = f."kitOrderIntentId"
       WHERE TRUE
         ${clinicScope}
         ${statusScope}
       ORDER BY f."requestedAt" ASC
       LIMIT ${limit}
    `);

    return rows.map((r) => ({
      ...toRecord(r),
      clinicName: r.clinicName,
      doctorName: r.doctorName,
      kitCount: Number(r.kitCount ?? 0),
      paymentStatus: r.paymentStatus,
      paidAt: iso(r.paidAt),
    }));
  });
}

export type TransitionOutcome =
  | { ok: true; fulfilment: FulfilmentRecord; from: FulfilmentStatus }
  | { ok: false; reason: "not_found" }
  | {
      ok: false;
      reason: "illegal_transition" | "terminal";
      from: FulfilmentStatus;
      allowed: readonly FulfilmentStatus[];
    }
  | { ok: false; reason: "conflict"; from: FulfilmentStatus };

export interface TransitionInput {
  id: string;
  to: FulfilmentStatus;
  /** Set on ACKNOWLEDGED so the clinic-side receipt is attributable. */
  acknowledgedByDoctorId?: string | null;
  /** Ops context — courier, waybill. Never clinical content. */
  notes?: string | null;
  /**
   * When set, the transition only applies inside this clinic. Supplied by the
   * clinic-side acknowledge endpoint so a doctor cannot advance another
   * tenant's request by guessing its id — the tenant check is part of the
   * same statement rather than a separate read a later edit could drop.
   */
  requireClinicId?: string | null;
}

/**
 * Move one request to a new state, enforcing the state machine.
 *
 * ── Why the guard is in the WHERE clause ────────────────────────────────────
 * The legality check happens twice, and deliberately: once in TypeScript so
 * the caller gets a useful "you cannot go from PACKED to ACKNOWLEDGED, only
 * DISPATCHED or CANCELLED", and once as `AND "status" = <from>` on the UPDATE
 * itself so the decision cannot be invalidated by a concurrent writer between
 * the read and the write.
 *
 * Two operators clicking "Mark dispatched" at the same moment both pass the
 * TypeScript check against the same PACKED row. Without the WHERE guard both
 * UPDATEs succeed and `dispatchedAt` is stamped twice, the second overwriting
 * the first — quietly moving the timestamp the courier SLA is measured
 * against. With it, the second updates zero rows and is reported as a
 * conflict.
 */
export async function transitionFulfilment(
  input: TransitionInput,
): Promise<TransitionOutcome> {
  return guardedFulfilment(async () => {
    const current = await readFulfilmentById(input.id);
    if (!current) return { ok: false, reason: "not_found" };
    if (input.requireClinicId && current.clinicId !== input.requireClinicId) {
      // Reported as not_found, not forbidden. A 403 here would confirm that a
      // fulfilment request with this id exists at some other clinic, which is
      // a disclosure about another tenant's operations.
      return { ok: false, reason: "not_found" };
    }

    const verdict = canTransition(current.status, input.to);
    if (!verdict.ok) {
      return {
        ok: false,
        reason: verdict.reason === "terminal" ? "terminal" : "illegal_transition",
        from: current.status,
        allowed: verdict.allowed,
      };
    }

    // Identifier interpolation. `input.to` has already been proven to be a
    // FulfilmentStatus by canTransition, and the column name is looked up in a
    // fixed table rather than derived from it, so no caller-supplied string
    // reaches Prisma.raw.
    const tsColumn =
      STATUS_TIMESTAMP_COLUMN[input.to as keyof typeof STATUS_TIMESTAMP_COLUMN];
    if (!tsColumn) return { ok: false, reason: "conflict", from: current.status };

    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      UPDATE "ClinicKitFulfilment"
         SET "status" = ${input.to}::"KitFulfilmentStatus",
             ${Prisma.raw(`"${tsColumn}"`)} = COALESCE(${Prisma.raw(`"${tsColumn}"`)}, NOW()),
             "acknowledgedByDoctorId" = COALESCE(${input.acknowledgedByDoctorId ?? null}, "acknowledgedByDoctorId"),
             "notes" = COALESCE(${input.notes ?? null}, "notes"),
             "updatedAt" = NOW()
       WHERE "id" = ${input.id}
         AND "status" = ${current.status}::"KitFulfilmentStatus"
      RETURNING ${COLS}
    `);

    if (!rows[0]) return { ok: false, reason: "conflict", from: current.status };
    return { ok: true, fulfilment: toRecord(rows[0]), from: current.status };
  });
}

/**
 * Record when the patient actually began treatment.
 *
 * Lives on KitOrderIntent, so it is written here over raw SQL for the same
 * reason as everything else in this module: the columns are unapplied.
 *
 * Idempotent in the safe direction — `WHERE "treatmentStartedAt" IS NULL` — so
 * a second submission does not silently move a date that other things are
 * already anchored to. Changing a recorded start is deliberately not possible
 * through this path.
 */
export async function recordTreatmentStart(input: {
  kitOrderIntentId: string;
  clinicId: string;
  startedAt: Date;
  doctorId: string;
  source: string;
}): Promise<{ ok: boolean; alreadyRecorded: boolean; startedAt: string | null }> {
  return guardedFulfilment(async () => {
    const rows = await prisma.$queryRaw<Array<{ treatmentStartedAt: Date | null }>>(
      Prisma.sql`
        UPDATE "KitOrderIntent"
           SET "treatmentStartedAt"   = ${input.startedAt},
               "treatmentStartedBy"   = ${input.doctorId},
               "treatmentStartSource" = ${input.source},
               "updatedAt"            = NOW()
         WHERE "id" = ${input.kitOrderIntentId}
           AND "clinicId" = ${input.clinicId}
           AND "treatmentStartedAt" IS NULL
        RETURNING "treatmentStartedAt"
      `,
    );

    if (rows[0]) {
      return {
        ok: true,
        alreadyRecorded: false,
        startedAt: iso(rows[0].treatmentStartedAt),
      };
    }

    const existing = await prisma.$queryRaw<Array<{ treatmentStartedAt: Date | null }>>(
      Prisma.sql`
        SELECT "treatmentStartedAt" FROM "KitOrderIntent"
         WHERE "id" = ${input.kitOrderIntentId} AND "clinicId" = ${input.clinicId}
      `,
    );
    if (!existing[0]) return { ok: false, alreadyRecorded: false, startedAt: null };
    return {
      ok: true,
      alreadyRecorded: true,
      startedAt: iso(existing[0].treatmentStartedAt),
    };
  });
}

/** Read the treatment-start anchor for one order. */
export async function readTreatmentStart(
  kitOrderIntentId: string,
): Promise<{ startedAt: string | null; startedBy: string | null; source: string | null }> {
  return guardedFulfilment(async () => {
    const rows = await prisma.$queryRaw<
      Array<{
        treatmentStartedAt: Date | null;
        treatmentStartedBy: string | null;
        treatmentStartSource: string | null;
      }>
    >(Prisma.sql`
      SELECT "treatmentStartedAt", "treatmentStartedBy", "treatmentStartSource"
        FROM "KitOrderIntent" WHERE "id" = ${kitOrderIntentId}
    `);
    return {
      startedAt: iso(rows[0]?.treatmentStartedAt ?? null),
      startedBy: rows[0]?.treatmentStartedBy ?? null,
      source: rows[0]?.treatmentStartSource ?? null,
    };
  });
}

/**
 * Stamp an order's fulfilment destination.
 *
 * ── Why this is raw SQL inside the caller's transaction ─────────────────────
 * `approveAndCreateOrder` creates the intent through the TYPED client, which
 * does not know about `fulfilmentMode` — the column is on a migration the
 * generated client predates. Passing `tx` lets the stamp commit atomically
 * with the row it belongs to, so an order can never exist with a null
 * destination just because a second statement failed.
 *
 * `mode` is a FulfilmentMode, not a string: the type is the validation, and
 * the only two producers are the clinic default and a validated API body.
 */
export async function setFulfilmentMode(
  input: {
    kitOrderIntentId: string;
    mode: FulfilmentMode;
    /** When set, the order must belong to this clinic or nothing is written. */
    requireClinicId?: string | null;
  },
  tx?: Prisma.TransactionClient,
): Promise<{ updated: boolean }> {
  const client = tx ?? prisma;
  return guardedFulfilment(async () => {
    const scope = input.requireClinicId
      ? Prisma.sql`AND "clinicId" = ${input.requireClinicId}`
      : Prisma.empty;
    const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "KitOrderIntent"
         SET "fulfilmentMode" = ${input.mode}::"KitFulfilmentMode",
             "updatedAt"      = NOW()
       WHERE "id" = ${input.kitOrderIntentId}
         ${scope}
      RETURNING "id"
    `);
    return { updated: rows.length > 0 };
  });
}

/** The order's recorded destination, or null when never captured. */
export async function readFulfilmentMode(
  kitOrderIntentId: string,
): Promise<string | null> {
  return guardedFulfilment(async () => {
    const rows = await prisma.$queryRaw<Array<{ fulfilmentMode: string | null }>>(
      Prisma.sql`
        SELECT "fulfilmentMode"::text AS "fulfilmentMode"
          FROM "KitOrderIntent" WHERE "id" = ${kitOrderIntentId}
      `,
    );
    return rows[0]?.fulfilmentMode ?? null;
  });
}
