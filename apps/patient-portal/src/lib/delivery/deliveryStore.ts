import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSchemaDriftError } from "@/lib/prismaErrors";

// Reads and writes of patient delivery records, over raw SQL rather than the
// typed client.
//
// ── Why raw SQL ─────────────────────────────────────────────────────────────
// Same reason as lib/doctor/appointments.ts: the columns this module needs
// (`subject`, `clinicId`, `sentByDoctorId`, `sentAt`, `readAt`,
// `providerStatus`) exist in schema.prisma and in
// prisma/migrations/20260829_post_approval_workflow, but that migration has NOT
// been applied — the 2026-08-20 baseline freeze holds until the canonical
// Supabase environment is chosen. `prisma.whatsappDelivery.create({ data: {
// subject } })` would be a compile error on any checkout where `prisma
// generate` has not run since the schema change, which under a freeze that
// forbids running it is every checkout.
//
// ── What happens before the migration runs ──────────────────────────────────
// Postgres answers "column subject does not exist" (SQLSTATE 42703). That is
// caught here and re-thrown as DeliveryNotProvisionedError, which the API layer
// turns into a 503 with a stable reason code and the doctor UI renders as
// "sending is not switched on yet". An unprovisioned surface and a surface
// where nothing has been sent look identical unless the UI is told which one it
// is looking at.
//
// ── Why WhatsappDelivery and not a new table ────────────────────────────────
// The table already models "a WhatsApp message about an assessment", which is
// exactly what sending a report or cart link is. A second PatientDelivery table
// is how "was the report sent?" acquires two different answers.

export const DELIVERY_NOT_PROVISIONED = "delivery_not_provisioned";

export class DeliveryNotProvisionedError extends Error {
  readonly reason = DELIVERY_NOT_PROVISIONED;
  constructor() {
    super(
      "WhatsappDelivery post-approval columns are not provisioned. Apply prisma/migrations/20260829_post_approval_workflow.",
    );
    this.name = "DeliveryNotProvisionedError";
  }
}

/**
 * Did this fail because the migration has not been applied?
 *
 * 42P01 is undefined_table, 42703 is undefined_column — the latter is the one
 * that actually fires here, since `WhatsappDelivery` itself has existed since
 * the platform's first migration and only its new columns are missing. 42704
 * (undefined_object) covers a cast to a type the database does not have yet.
 */
function isMissing(err: unknown): boolean {
  if (isSchemaDriftError(err)) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    if (meta.code === "42P01" || meta.code === "42703" || meta.code === "42704") {
      return true;
    }
    return /does not exist/i.test(meta.message ?? err.message);
  }
  return false;
}

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissing(err)) throw new DeliveryNotProvisionedError();
    throw err;
  }
}

/**
 * A cuid-shaped identifier. `@default(cuid())` is applied by the Prisma
 * client, which this module bypasses, so ids are generated in the same shape
 * the rest of the platform uses rather than as obvious UUIDs that would mark
 * exactly which rows predate the migration. Randomness from the platform
 * CSPRNG, not Math.random.
 */
function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
  return `c${Date.now().toString(36)}${rand}`.slice(0, 25);
}

export type DeliverySubject = "REPORT" | "CART";

/**
 * The application's delivery states.
 *
 * These are the existing `DeliveryStatus` enum's members, unchanged. PENDING
 * is what the workflow calls QUEUED — the row exists, the provider has not
 * accepted it yet.
 *
 * READ is deliberately NOT an enum member. Adding one would mean an
 * `ALTER TYPE … ADD VALUE`, which Postgres will not run inside the transaction
 * Prisma wraps a migration in, and it would claim a state no transport in this
 * deployment currently reports. Read receipts are recorded as a `readAt`
 * timestamp instead: a null there means "we have never been told", which is
 * true, rather than a status that asserts something about a message nobody has
 * heard back about.
 */
export type DeliveryStatusValue = "PENDING" | "SENT" | "DELIVERED" | "FAILED";

export interface DeliveryRecord {
  id: string;
  assessmentId: string;
  subject: DeliverySubject | null;
  status: DeliveryStatusValue;
  templateId: string | null;
  messageId: string | null;
  providerStatus: string | null;
  attempts: number;
  lastError: string | null;
  sentByDoctorId: string | null;
  /** ISO 8601. */
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

interface RawRow {
  id: string;
  assessmentId: string;
  subject: DeliverySubject | null;
  status: DeliveryStatusValue;
  templateId: string | null;
  messageId: string | null;
  providerStatus: string | null;
  attempts: number;
  lastError: string | null;
  sentByDoctorId: string | null;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
}

function toRecord(r: RawRow): DeliveryRecord {
  return {
    id: r.id,
    assessmentId: r.assessmentId,
    subject: r.subject,
    status: r.status,
    templateId: r.templateId,
    messageId: r.messageId,
    providerStatus: r.providerStatus,
    attempts: r.attempts,
    lastError: r.lastError,
    sentByDoctorId: r.sentByDoctorId,
    createdAt: r.createdAt.toISOString(),
    sentAt: r.sentAt?.toISOString() ?? null,
    deliveredAt: r.deliveredAt?.toISOString() ?? null,
    readAt: r.readAt?.toISOString() ?? null,
  };
}

const SELECT_COLUMNS = Prisma.sql`
  "id", "assessmentId", "subject", "status"::text AS "status", "templateId",
  "messageId", "providerStatus", "attempts", "lastError", "sentByDoctorId",
  "createdAt", "sentAt", "deliveredAt", "readAt"
`;

export interface CreateDeliveryInput {
  assessmentId: string;
  clinicId: string;
  subject: DeliverySubject;
  /** E.164 digits, no '+'. Stored because a delivery must name its recipient. */
  patientPhone: string;
  templateId: string | null;
  sentByDoctorId: string;
}

/**
 * Open a delivery row in PENDING. Written BEFORE the provider is called, on
 * purpose: if the process dies mid-send, the durable record is "we attempted
 * this", which is recoverable, rather than nothing at all, which looks
 * identical to never having tried.
 */
export async function createDelivery(
  input: CreateDeliveryInput,
): Promise<DeliveryRecord> {
  const id = newId();
  return guarded(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      INSERT INTO "WhatsappDelivery" (
        "id", "assessmentId", "clinicId", "subject", "patientPhone",
        "templateId", "status", "attempts", "sentByDoctorId",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${input.assessmentId}, ${input.clinicId}, ${input.subject},
        ${input.patientPhone}, ${input.templateId}, 'PENDING'::"DeliveryStatus", 0,
        ${input.sentByDoctorId}, NOW(), NOW()
      )
      RETURNING ${SELECT_COLUMNS}
    `);
    return toRecord(rows[0]);
  });
}

export interface MarkSentInput {
  deliveryId: string;
  messageId: string | null;
  providerStatus: string | null;
}

/** The provider accepted the message. */
export async function markDeliverySent(
  input: MarkSentInput,
): Promise<DeliveryRecord | null> {
  return guarded(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      UPDATE "WhatsappDelivery"
         SET "status"         = 'SENT'::"DeliveryStatus",
             "messageId"      = ${input.messageId},
             "providerStatus" = ${input.providerStatus},
             "sentAt"         = NOW(),
             "attempts"       = "attempts" + 1,
             "updatedAt"      = NOW()
       WHERE "id" = ${input.deliveryId}
      RETURNING ${SELECT_COLUMNS}
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  });
}

export interface MarkFailedInput {
  /**
   * Our row id, or — when `byMessageId` is set — the PROVIDER's message id.
   *
   * Two callers need this writer and they hold different identifiers. The send
   * path has just created the row and knows its id. An asynchronous provider
   * callback knows only the id the provider issued, because that is the only
   * join key a callback carries.
   */
  deliveryId: string;
  /** Operator-facing reason code. Never the message body or the link. */
  error: string;
  providerStatus: string | null;
  /** Match on `messageId` rather than `id`. Used by the provider webhook. */
  byMessageId?: boolean;
}

export async function markDeliveryFailed(
  input: MarkFailedInput,
): Promise<DeliveryRecord | null> {
  return guarded(async () => {
    const match = input.byMessageId
      ? Prisma.sql`"messageId" = ${input.deliveryId}`
      : Prisma.sql`"id" = ${input.deliveryId}`;
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      UPDATE "WhatsappDelivery"
         SET "status"         = 'FAILED'::"DeliveryStatus",
             "lastError"      = ${input.error},
             "providerStatus" = ${input.providerStatus},
             -- Attempts counts SEND attempts we made. A provider reporting a
             -- late failure is not another attempt by us, so the counter is
             -- only advanced on our own send path.
             "attempts"       = "attempts" + ${input.byMessageId ? 0 : 1},
             "updatedAt"      = NOW()
       WHERE ${match}
      RETURNING ${SELECT_COLUMNS}
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  });
}

/**
 * Apply an asynchronous provider callback (delivered / read).
 *
 * Nothing calls this yet — no provider webhook is wired up — and that is why
 * it exists as a narrow, single-purpose writer rather than as a general
 * "update delivery" function. When a webhook lands it needs exactly this and
 * must not be able to reach anything else on the row.
 *
 * Matched on `messageId`, which is the only identifier a provider callback
 * carries. A callback for an unknown id updates nothing and returns null.
 */
export async function markProviderStatus(input: {
  messageId: string;
  delivered?: boolean;
  read?: boolean;
  providerStatus: string | null;
}): Promise<DeliveryRecord | null> {
  return guarded(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      UPDATE "WhatsappDelivery"
         SET "status"         = CASE WHEN ${input.delivered ?? false}
                                     THEN 'DELIVERED'::"DeliveryStatus"
                                     ELSE "status" END,
             "deliveredAt"    = COALESCE("deliveredAt",
                                  CASE WHEN ${input.delivered ?? false} THEN NOW() END),
             "readAt"         = COALESCE("readAt",
                                  CASE WHEN ${input.read ?? false} THEN NOW() END),
             "providerStatus" = ${input.providerStatus},
             "updatedAt"      = NOW()
       WHERE "messageId" = ${input.messageId}
      RETURNING ${SELECT_COLUMNS}
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  });
}

/**
 * The most recent delivery of each subject for one assessment.
 *
 * "Most recent" is the right question here and not a guess: re-sending a
 * report is a legitimate, expected action (a patient changes phone, a message
 * fails), so an assessment accumulates rows, and what the doctor and the ops
 * queue both want to know is the state of the LATEST attempt. Earlier
 * attempts stay on the table for audit.
 */
export async function readLatestDeliveries(
  assessmentId: string,
): Promise<{ REPORT: DeliveryRecord | null; CART: DeliveryRecord | null }> {
  return guarded(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT DISTINCT ON ("subject") ${SELECT_COLUMNS}
        FROM "WhatsappDelivery"
       WHERE "assessmentId" = ${assessmentId}
         AND "subject" IS NOT NULL
       ORDER BY "subject", "createdAt" DESC
    `);
    const out: { REPORT: DeliveryRecord | null; CART: DeliveryRecord | null } = {
      REPORT: null,
      CART: null,
    };
    for (const r of rows) {
      const rec = toRecord(r);
      if (rec.subject === "REPORT") out.REPORT = rec;
      if (rec.subject === "CART") out.CART = rec;
    }
    return out;
  });
}

export interface FailedDeliveryRow extends DeliveryRecord {
  clinicId: string | null;
  clinicName: string | null;
}

/**
 * Failed sends needing operator attention, newest first.
 *
 * Scoped by clinic when `clinicId` is supplied; unscoped only for the Super
 * Admin action centre, whose caller has already been checked. The scope is a
 * required decision at the call site rather than an optional filter — an
 * "optional" tenant filter is one a caller eventually forgets to pass.
 */
export async function readFailedDeliveries(
  clinicId: string | null,
  limit = 50,
): Promise<FailedDeliveryRow[]> {
  return guarded(async () => {
    const scope = clinicId
      ? Prisma.sql`AND d."clinicId" = ${clinicId}`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<Array<RawRow & { clinicId: string | null; clinicName: string | null }>>(
      Prisma.sql`
        SELECT d."id", d."assessmentId", d."subject", d."status"::text AS "status",
               d."templateId", d."messageId", d."providerStatus", d."attempts",
               d."lastError", d."sentByDoctorId", d."createdAt", d."sentAt",
               d."deliveredAt", d."readAt",
               d."clinicId", c."name" AS "clinicName"
          FROM "WhatsappDelivery" d
          LEFT JOIN "Clinic" c ON c."id" = d."clinicId"
         WHERE d."status" = 'FAILED'::"DeliveryStatus"
           ${scope}
         ORDER BY d."createdAt" DESC
         LIMIT ${limit}
      `,
    );
    return rows.map((r) => ({
      ...toRecord(r),
      clinicId: r.clinicId,
      clinicName: r.clinicName,
    }));
  });
}
