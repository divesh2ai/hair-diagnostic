import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSchemaDriftError } from "@/lib/prismaErrors";
import {
  isSameEventPayload,
  type KitPurchaseEventType,
  type KitPurchaseLineStatus,
  requiresReason,
} from "./kitPurchaseModel";

// KitPurchaseLine / KitPurchaseEvent persistence, over raw SQL.
//
// Same baseline-freeze reasoning as lib/fulfilment/fulfilmentStore.ts: the
// tables are in schema.prisma and in
// prisma/migrations/20261023_doctor_notes_and_partial_kit and the additive
// 20261030_partial_checkout_transactions migration. Provisioning is environment-specific.
// Raw SQL keeps the module compiling and the app booting whether or not they
// exist; callers get PurchaseNotProvisionedError → 503 with a stable reason.

export const PURCHASE_NOT_PROVISIONED = "purchase_not_provisioned";

export class PurchaseNotProvisionedError extends Error {
  readonly reason = PURCHASE_NOT_PROVISIONED;
  constructor() {
    super(
      "Purchase tracking is not provisioned. Check 20261023_doctor_notes_and_partial_kit and 20261030_partial_checkout_transactions.",
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
  substituteKitId: string | null;
  transactionId: string | null;
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
  substituteKitId: string | null;
  transactionId: string | null;
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
  "substituteKitId",
  "transactionId",
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
    substituteKitId: r.substituteKitId,
    transactionId: r.transactionId,
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

/** Lines for ONE order. Scoped to the exact intent, not the assessment — a
 *  re-approval can create a second intent for the same assessment, and reading
 *  by assessment would mix two orders' lines. */
export async function listLinesByIntent(
  clinicId: string,
  kitOrderIntentId: string,
): Promise<PurchaseLineRecord[]> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<LineRaw[]>(Prisma.sql`
      SELECT ${LINE_COLS} FROM "KitPurchaseLine"
       WHERE "clinicId" = ${clinicId} AND "kitOrderIntentId" = ${kitOrderIntentId}
       ORDER BY "createdAt" ASC
    `);
    return rows.map(toLine);
  });
}

/** Events for ONE order, resolved through the line's owning intent (events hold
 *  no intent id of their own), so another order on the same assessment is never
 *  mixed in. */
export async function listEventsByIntent(
  clinicId: string,
  kitOrderIntentId: string,
): Promise<PurchaseEventRecord[]> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<EventRaw[]>(Prisma.sql`
      SELECT ${EVENT_COLS} FROM "KitPurchaseEvent"
       WHERE "clinicId" = ${clinicId}
         AND EXISTS (
           SELECT 1 FROM "KitPurchaseLine" l
            WHERE l."id" = "KitPurchaseEvent"."kitPurchaseLineId"
              AND l."clinicId" = ${clinicId}
              AND l."kitOrderIntentId" = ${kitOrderIntentId}
         )
       ORDER BY "occurredAt" ASC, "createdAt" ASC
    `);
    return rows.map(toEvent);
  });
}

/** All lines for a patient within the clinic, across every visit. */
export async function listLinesByPatient(
  clinicId: string,
  patientId: string,
): Promise<PurchaseLineRecord[]> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<LineRaw[]>(Prisma.sql`
      SELECT ${LINE_COLS} FROM "KitPurchaseLine"
       WHERE "clinicId" = ${clinicId} AND "patientId" = ${patientId}
       ORDER BY "createdAt" ASC
    `);
    return rows.map(toLine);
  });
}

/**
 * All purchase events for a patient, across visits. Events carry no patientId
 * of their own, so the patient scope is enforced by joining to the line — which
 * does carry it — rather than trusting a denormalised copy.
 */
export async function listEventsByPatient(
  clinicId: string,
  patientId: string,
): Promise<PurchaseEventRecord[]> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<EventRaw[]>(Prisma.sql`
      SELECT ${EVENT_COLS} FROM "KitPurchaseEvent"
       WHERE "clinicId" = ${clinicId}
         AND EXISTS (
           SELECT 1 FROM "KitPurchaseLine" l
            WHERE l."id" = "KitPurchaseEvent"."kitPurchaseLineId"
              AND l."clinicId" = ${clinicId}
              AND l."patientId" = ${patientId}
         )
       ORDER BY "occurredAt" ASC, "createdAt" ASC
    `);
    return rows.map(toEvent);
  });
}

/**
 * Resolve a line by its id, scoped to BOTH the clinic AND the owning order.
 *
 * The order scope is the fix for cross-order tampering: a line id that is valid
 * in the same clinic but belongs to a DIFFERENT KitOrderIntent is rejected
 * (returns null), so an event or status change can never land on another
 * order's line by passing a mismatched id.
 */
export async function readLine(
  clinicId: string,
  id: string,
  kitOrderIntentId: string,
): Promise<PurchaseLineRecord | null> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<LineRaw[]>(Prisma.sql`
      SELECT ${LINE_COLS} FROM "KitPurchaseLine"
       WHERE "id" = ${id}
         AND "clinicId" = ${clinicId}
         AND "kitOrderIntentId" = ${kitOrderIntentId}
    `);
    return rows[0] ? toLine(rows[0]) : null;
  });
}

/** Resolve the one line for a kit within a specific order, clinic-scoped. */
export async function readLineByKit(
  clinicId: string,
  kitOrderIntentId: string,
  kitId: string,
): Promise<PurchaseLineRecord | null> {
  return guardedPurchase(async () => {
    const rows = await prisma.$queryRaw<LineRaw[]>(Prisma.sql`
      SELECT ${LINE_COLS} FROM "KitPurchaseLine"
       WHERE "clinicId" = ${clinicId}
         AND "kitOrderIntentId" = ${kitOrderIntentId}
         AND "kitId" = ${kitId}
    `);
    return rows[0] ? toLine(rows[0]) : null;
  });
}

export type AppendEventOutcome =
  | { ok: true; event: PurchaseEventRecord; created: boolean }
  | { ok: false; reason: "line_not_found" | "idempotency_conflict" };

/**
 * Append one dated event to a line, idempotently and association-checked.
 *
 * - The line is resolved by id scoped to BOTH clinic and the owning order
 *   (`kitOrderIntentId`), so an event can never land on another tenant's or
 *   another order's line.
 * - `clientEventId` is REQUIRED: it is the idempotency key. A replay with the
 *   same key and the same payload returns the existing row (`created:false`);
 *   a replay with the same key but a DIFFERENT payload is rejected
 *   (`idempotency_conflict`) rather than silently writing or silently ignoring.
 * - `catalogUnitMinor` is the governed price resolved by the caller
 *   SERVER-SIDE; `saleValueMinor` is the separately-recorded offline sale.
 */
export async function appendPurchaseEvent(input: {
  clinicId: string;
  kitOrderIntentId: string;
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
  clientEventId: string;
  substituteKitId?: string | null;
}): Promise<AppendEventOutcome> {
  return guardedPurchase(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "KitOrderIntent" WHERE id=${input.kitOrderIntentId} AND "clinicId"=${input.clinicId} FOR UPDATE`;
    const [rawLine] = await tx.$queryRaw<LineRaw[]>(Prisma.sql`SELECT ${LINE_COLS} FROM "KitPurchaseLine"
      WHERE id=${input.kitPurchaseLineId} AND "clinicId"=${input.clinicId} AND "kitOrderIntentId"=${input.kitOrderIntentId}`);
    const line = rawLine ? toLine(rawLine) : null;
    if (!line) return { ok: false, reason: "line_not_found" } as const;

    const id = newId();
    const boxes = input.boxes ?? null;
    const saleValueMinor = input.saleValueMinor ?? null;
    const inserted = await tx.$queryRaw<EventRaw[]>(Prisma.sql`
      INSERT INTO "KitPurchaseEvent" (
        "id", "kitPurchaseLineId", "clinicId", "assessmentId", "eventType",
        "boxes", "catalogUnitMinor", "saleValueMinor", "currency",
        "kitOrderPaymentId", "occurredAt", "recordedByDoctorId", "note",
        "clientEventId", "substituteKitId", "createdAt"
      ) VALUES (
        ${id}, ${line.id}, ${line.clinicId}, ${line.assessmentId},
        ${input.eventType}::"KitPurchaseEventType",
        ${boxes}, ${input.catalogUnitMinor ?? null},
        ${saleValueMinor}, ${input.currency ?? "INR"},
        ${input.kitOrderPaymentId ?? null}, ${input.occurredAt},
        ${input.recordedByDoctorId}, ${input.note ?? null},
        ${input.clientEventId}, ${input.substituteKitId ?? null}, NOW()
      )
      ON CONFLICT ("kitPurchaseLineId", "clientEventId") DO NOTHING
      RETURNING ${EVENT_COLS}
    `);

    if (inserted[0]) {
      if (requiresReason(input.eventType)) {
        const status = input.eventType === "CONTINUED" ? "RECOMMENDED" : input.eventType;
        await tx.$executeRaw`UPDATE "KitPurchaseLine" SET "lineStatus"=${status}::"KitPurchaseLineStatus",
          "controlReason"=${input.note ?? null},"substituteKitId"=${input.substituteKitId ?? null},"updatedAt"=NOW()
          WHERE id=${line.id} AND "clinicId"=${input.clinicId}`;
      }
      return { ok: true, event: toEvent(inserted[0]), created: true } as const;
    }

    // Conflict fired → an event with this key already exists on this line.
    const existing = await tx.$queryRaw<EventRaw[]>(Prisma.sql`
      SELECT ${EVENT_COLS} FROM "KitPurchaseEvent"
       WHERE "kitPurchaseLineId" = ${line.id}
         AND "clientEventId" = ${input.clientEventId}
       LIMIT 1
    `);
    if (!existing[0]) throw new Error("purchase_event_conflict_without_row");
    const prior = toEvent(existing[0]);
    if (prior.substituteKitId !== (input.substituteKitId ?? null)) return {ok:false,reason:"idempotency_conflict"} as const;
    if (
      !isSameEventPayload(
        {
          eventType: prior.eventType,
          boxes: prior.boxes,
          saleValueMinor: prior.saleValueMinor,
          occurredAt: prior.occurredAt,
          note: prior.note,
        },
        {
          eventType: input.eventType,
          boxes,
          saleValueMinor,
          occurredAt: input.occurredAt.toISOString(),
          note: input.note ?? null,
        },
      )
    ) {
      return { ok: false, reason: "idempotency_conflict" } as const;
    }
    return { ok: true, event: prior, created: false } as const;
  }));
}

/**
 * Set a line's control status, scoped to clinic AND owning order so a status
 * change cannot be applied to another order's line.
 */
export async function setLineStatus(input: {
  clinicId: string;
  kitOrderIntentId: string;
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
       WHERE "id" = ${input.kitPurchaseLineId}
         AND "clinicId" = ${input.clinicId}
         AND "kitOrderIntentId" = ${input.kitOrderIntentId}
      RETURNING "id"
    `);
    return { ok: rows.length > 0 };
  });
}
