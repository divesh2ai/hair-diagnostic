import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSchemaDriftError } from "@/lib/prismaErrors";
import type {
  KitPurchaseEventType,
  KitPurchaseLineStatus,
} from "./kitPurchaseModel";

// KitPurchaseLine / KitPurchaseEvent persistence, over raw SQL.
//
// Same baseline-freeze reasoning as lib/fulfilment/fulfilmentStore.ts: the
// tables are in schema.prisma and in
// prisma/migrations/20261023_doctor_notes_and_partial_kit, which is NOT applied.
// Raw SQL keeps the module compiling and the app booting whether or not they
// exist; callers get PurchaseNotProvisionedError → 503 with a stable reason.

export const PURCHASE_NOT_PROVISIONED = "purchase_not_provisioned";

export class PurchaseNotProvisionedError extends Error {
  readonly reason = PURCHASE_NOT_PROVISIONED;
  constructor() {
    super(
      "KitPurchaseLine/KitPurchaseEvent are not provisioned. Apply prisma/migrations/20261023_doctor_notes_and_partial_kit.",
    );
    this.name = "PurchaseNotProvisionedError";
  }
}

function isMissing(err: unknown): boolean {
  if (isSchemaDriftError(err)) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    if (meta.code === "42P01" || meta.code === "42703" || meta.code === "42704") return true;
    return /does not exist/i.test(meta.message ?? err.message);
  }
  return false;
}

export async function guardedPurchase<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissing(err)) throw new PurchaseNotProvisionedError();
    throw err;
  }
}

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
  return `c${Date.now().toString(36)}${rand}`.slice(0, 25);
}

export interface PurchaseLineRecord {
  id: string;
  kitOrderIntentId: string;
  clinicId: string;
  assessmentId: string;
  patientId: string;
  kitId: string;
  kitLabel: string;
  recommendedBoxes: number;
  lineStatus: KitPurchaseLineStatus;
  substituteKitId: string | null;
  controlReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseEventRecord {
  id: string;
  kitPurchaseLineId: string;
  clinicId: string;
  assessmentId: string;
  eventType: KitPurchaseEventType;
  boxes: number | null;
  catalogUnitMinor: number | null;
  saleValueMinor: number | null;
  currency: string;
  kitOrderPaymentId: string | null;
  occurredAt: string;
  recordedByDoctorId: string;
  note: string | null;
  clientEventId: string | null;
  createdAt: string;
}

interface LineRaw {
  id: string;
  kitOrderIntentId: string;
  clinicId: string;
  assessmentId: string;
  patientId: string;
  kitId: string;
  kitLabel: string;
  recommendedBoxes: number;
  lineStatus: KitPurchaseLineStatus;
  substituteKitId: string | null;
  controlReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EventRaw {
  id: string;
  kitPurchaseLineId: string;
  clinicId: string;
  assessmentId: string;
  eventType: KitPurchaseEventType;
  boxes: number | null;
  catalogUnitMinor: number | null;
  saleValueMinor: number | null;
  currency: string;
  kitOrderPaymentId: string | null;
  occurredAt: Date;
  recordedByDoctorId: string;
  note: string | null;
  clientEventId: string | null;
  createdAt: Date;
}

const LINE_COLS = Prisma.sql`
  "id", "kitOrderIntentId", "clinicId", "assessmentId", "patientId",
  "kitId", "kitLabel", "recommendedBoxes", "lineStatus"::text AS "lineStatus",
  "substituteKitId", "controlReason", "createdAt", "updatedAt"
`;
const EVENT_COLS = Prisma.sql`
  "id", "kitPurchaseLineId", "clinicId", "assessmentId",
  "eventType"::text AS "eventType", "boxes", "catalogUnitMinor", "saleValueMinor",
  "currency", "kitOrderPaymentId", "occurredAt", "recordedByDoctorId",
  "note", "clientEventId", "createdAt"
`;

function toLine(r: LineRaw): PurchaseLineRecord {
  return {
    id: r.id,
    kitOrderIntentId: r.kitOrderIntentId,
    clinicId: r.clinicId,
    assessmentId: r.assessmentId,
    patientId: r.patientId,
    kitId: r.kitId,
    kitLabel: r.kitLabel,
    recommendedBoxes: Number(r.recommendedBoxes),
    lineStatus: r.lineStatus,
    substituteKitId: r.substituteKitId,
    controlReason: r.controlReason,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toEvent(r: EventRaw): PurchaseEventRecord {
  return {
    id: r.id,
    kitPurchaseLineId: r.kitPurchaseLineId,
    clinicId: r.clinicId,
    assessmentId: r.assessmentId,
    eventType: r.eventType,
    boxes: r.boxes == null ? null : Number(r.boxes),
    catalogUnitMinor: r.catalogUnitMinor == null ? null : Number(r.catalogUnitMinor),
    saleValueMinor: r.saleValueMinor == null ? null : Number(r.saleValueMinor),
    currency: r.currency,
    kitOrderPaymentId: r.kitOrderPaymentId,
    occurredAt: r.occurredAt.toISOString(),
    recordedByDoctorId: r.recordedByDoctorId,
    note: r.note,
    clientEventId: r.clientEventId,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface KitLineSeed {
  kitId: string;
  kitLabel: string;
  recommendedBoxes: number;
}

/**
 * Create one line per recommended kit, exactly once per (order, kit).
 *
 * Idempotent via `ON CONFLICT ("kitOrderIntentId","kitId") DO NOTHING`, so a
 * repeated backfill — two doctors opening the same order, a retried request —
 * never duplicates a line and never resets an existing line's status. Returns
 * the full current set of lines for the order afterwards.
 */
export async function ensurePurchaseLines(input: {
  kitOrderIntentId: string;
  clinicId: string;
  assessmentId: string;
  patientId: string;
  kits: readonly KitLineSeed[];
}): Promise<PurchaseLineRecord[]> {
  return guardedPurchase(async () => {
    for (const kit of input.kits) {
      const id = newId();
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "KitPurchaseLine" (
          "id", "kitOrderIntentId", "clinicId", "assessmentId", "patientId",
          "kitId", "kitLabel", "recommendedBoxes", "lineStatus", "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${input.kitOrderIntentId}, ${input.clinicId}, ${input.assessmentId},
          ${input.patientId}, ${kit.kitId}, ${kit.kitLabel},
          ${Math.max(0, Math.trunc(kit.recommendedBoxes))},
          'RECOMMENDED'::"KitPurchaseLineStatus", NOW(), NOW()
        )
        ON CONFLICT ("kitOrderIntentId", "kitId") DO NOTHING
      `);
    }
    const rows = await prisma.$queryRaw<LineRaw[]>(Prisma.sql`
      SELECT ${LINE_COLS} FROM "KitPurchaseLine"
       WHERE "kitOrderIntentId" = ${input.kitOrderIntentId}
         AND "clinicId" = ${input.clinicId}
       ORDER BY "createdAt" ASC
    `);
    return rows.map(toLine);
  });
}

export async function listLinesByAssessment(
  clinicId: string,
  assessmentId: string,
): Promise<PurchaseLineRecord[]> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<LineRaw[]>(Prisma.sql`
      SELECT ${LINE_COLS} FROM "KitPurchaseLine"
       WHERE "clinicId" = ${clinicId} AND "assessmentId" = ${assessmentId}
       ORDER BY "createdAt" ASC
    `);
    return rows.map(toLine);
  });
}

export async function listEventsByAssessment(
  clinicId: string,
  assessmentId: string,
): Promise<PurchaseEventRecord[]> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<EventRaw[]>(Prisma.sql`
      SELECT ${EVENT_COLS} FROM "KitPurchaseEvent"
       WHERE "clinicId" = ${clinicId} AND "assessmentId" = ${assessmentId}
       ORDER BY "occurredAt" ASC, "createdAt" ASC
    `);
    return rows.map(toEvent);
  });
}

export async function readLine(
  clinicId: string,
  id: string,
): Promise<PurchaseLineRecord | null> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<LineRaw[]>(Prisma.sql`
      SELECT ${LINE_COLS} FROM "KitPurchaseLine"
       WHERE "id" = ${id} AND "clinicId" = ${clinicId}
    `);
    return rows[0] ? toLine(rows[0]) : null;
  });
}

export type AppendEventOutcome =
  | { ok: true; event: PurchaseEventRecord; created: boolean }
  | { ok: false; reason: "line_not_found" };

/**
 * Append one dated event to a line, idempotently.
 *
 * The line is resolved WITH the caller's clinicId in the WHERE, so a doctor
 * cannot record against another tenant's line by guessing its id — the same
 * discipline as transitionFulfilment. When `clientEventId` is supplied, a
 * replayed submit collapses onto the existing row via the unique index rather
 * than creating a duplicate purchase.
 */
export async function appendPurchaseEvent(input: {
  clinicId: string;
  kitPurchaseLineId: string;
  eventType: KitPurchaseEventType;
  boxes?: number | null;
  catalogUnitMinor?: number | null;
  saleValueMinor?: number | null;
  currency?: string;
  kitOrderPaymentId?: string | null;
  occurredAt: Date;
  recordedByDoctorId: string;
  note?: string | null;
  clientEventId?: string | null;
}): Promise<AppendEventOutcome> {
  return guardedPurchase(async () => {
    const line = await readLine(input.clinicId, input.kitPurchaseLineId);
    if (!line) return { ok: false, reason: "line_not_found" } as const;

    const id = newId();
    const inserted = await prisma.$queryRaw<EventRaw[]>(Prisma.sql`
      INSERT INTO "KitPurchaseEvent" (
        "id", "kitPurchaseLineId", "clinicId", "assessmentId", "eventType",
        "boxes", "catalogUnitMinor", "saleValueMinor", "currency",
        "kitOrderPaymentId", "occurredAt", "recordedByDoctorId", "note",
        "clientEventId", "createdAt"
      ) VALUES (
        ${id}, ${line.id}, ${line.clinicId}, ${line.assessmentId},
        ${input.eventType}::"KitPurchaseEventType",
        ${input.boxes ?? null}, ${input.catalogUnitMinor ?? null},
        ${input.saleValueMinor ?? null}, ${input.currency ?? "INR"},
        ${input.kitOrderPaymentId ?? null}, ${input.occurredAt},
        ${input.recordedByDoctorId}, ${input.note ?? null},
        ${input.clientEventId ?? null}, NOW()
      )
      ON CONFLICT ("kitPurchaseLineId", "clientEventId") DO NOTHING
      RETURNING ${EVENT_COLS}
    `);

    if (inserted[0]) return { ok: true, event: toEvent(inserted[0]), created: true } as const;

    // Conflict fired → the same clientEventId already recorded an event; return it.
    const existing = await prisma.$queryRaw<EventRaw[]>(Prisma.sql`
      SELECT ${EVENT_COLS} FROM "KitPurchaseEvent"
       WHERE "kitPurchaseLineId" = ${line.id}
         AND "clientEventId" = ${input.clientEventId ?? null}
       LIMIT 1
    `);
    if (!existing[0]) throw new Error("purchase_event_conflict_without_row");
    return { ok: true, event: toEvent(existing[0]), created: false } as const;
  });
}

/** Set a line's control status (defer/decline/substitute/discontinue), scoped. */
export async function setLineStatus(input: {
  clinicId: string;
  kitPurchaseLineId: string;
  lineStatus: KitPurchaseLineStatus;
  controlReason?: string | null;
  substituteKitId?: string | null;
}): Promise<{ ok: boolean }> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "KitPurchaseLine"
         SET "lineStatus"      = ${input.lineStatus}::"KitPurchaseLineStatus",
             "controlReason"   = ${input.controlReason ?? null},
             "substituteKitId" = ${input.substituteKitId ?? null},
             "updatedAt"       = NOW()
       WHERE "id" = ${input.kitPurchaseLineId} AND "clinicId" = ${input.clinicId}
      RETURNING "id"
    `);
    return { ok: rows.length > 0 };
  });
}
