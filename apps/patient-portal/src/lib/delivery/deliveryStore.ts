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
 * Thrown by `createDelivery` when a concurrent request already opened (or
 * completed) a delivery for the exact same (assessmentId, subject,
 * consultationVersionId) — see
 * prisma/migrations/20260908_whatsapp_delivery_idempotency_index. The
 * application-level idempotency check (`findExistingSuccessfulDelivery`) is a
 * SELECT-then-branch and cannot by itself stop two simultaneous requests from
 * both passing it before either has written a row; this is the database
 * closing that window. `existingDeliveryId` is provided so the loser can look
 * up what the winner actually did, rather than guessing.
 */
export class DeliveryRaceLostError extends Error {
  constructor(readonly existingDeliveryId: string) {
    super("A concurrent request already claimed this delivery.");
    this.name = "DeliveryRaceLostError";
  }
}

/**
 * Did this fail because the migration has not been applied?
 *
 * 42P01 is undefined_table, 42703 is undefined_column — the latter is the one
 * that actually fires here, since `WhatsappDelivery` itself has existed since
 * the platform's first migration and only its new columns are missing. 42704
 * (undefined_object) covers a cast to a type the database does not have yet.
 *
 * 22P02 (invalid_text_representation) is the ADDITIONAL case
 * 20260908_whatsapp_report_delivery introduces: writing `status =
 * 'CONFIGURATION_ERROR'` or `'BLOCKED_NO_CONSENT'` to a database whose
 * "DeliveryStatus" enum has not yet had those values added fails this way,
 * not with a missing-column error — Postgres has the column, it just does not
 * recognise the value being put in it. Without this, that specific write
 * would surface as an opaque 500 instead of the same clean "not provisioned
 * here yet" signal every other unprovisioned write already gives.
 */
function isMissing(err: unknown): boolean {
  if (isSchemaDriftError(err)) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    if (
      meta.code === "42P01" ||
      meta.code === "42703" ||
      meta.code === "42704" ||
      meta.code === "22P02"
    ) {
      return true;
    }
    return /does not exist/i.test(meta.message ?? err.message) ||
      /invalid input value for enum/i.test(meta.message ?? err.message);
  }
  return false;
}

/** 23505 unique_violation — the WhatsappDelivery_idempotency_key partial index. */
function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    return meta.code === "23505" || /duplicate key value/i.test(meta.message ?? err.message);
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
export type DeliveryStatusValue =
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  /** Added 20260908_whatsapp_report_delivery — see deliveryStore's guard for what happens if this column set is not yet provisioned. */
  | "CONFIGURATION_ERROR"
  | "BLOCKED_NO_CONSENT";

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
  /**
   * The approved version this send is for — written on the INSERT itself
   * (not only in the later provenance update) so the idempotency partial
   * index has something to key on from the very first moment a row exists.
   * Null for CART, which is intentionally outside this idempotency check —
   * see the migration's own comment.
   */
  consultationVersionId?: string | null;
}

/**
 * Open a delivery row in PENDING. Written BEFORE the provider is called, on
 * purpose: if the process dies mid-send, the durable record is "we attempted
 * this", which is recoverable, rather than nothing at all, which looks
 * identical to never having tried.
 *
 * Throws `DeliveryRaceLostError` when a concurrent caller already opened (or
 * completed) a delivery for the same (assessmentId, subject,
 * consultationVersionId) — see WhatsappDelivery_idempotency_key. The caller
 * (sendPatientLink) is expected to read back the winner's row rather than
 * treat this as a genuine failure.
 */
export async function createDelivery(
  input: CreateDeliveryInput,
): Promise<DeliveryRecord> {
  const id = newId();
  return guarded(async () => {
    try {
      const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
        INSERT INTO "WhatsappDelivery" (
          "id", "assessmentId", "clinicId", "subject", "patientPhone",
          "templateId", "status", "attempts", "sentByDoctorId",
          "consultationVersionId", "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${input.assessmentId}, ${input.clinicId}, ${input.subject},
          ${input.patientPhone}, ${input.templateId}, 'PENDING'::"DeliveryStatus", 0,
          ${input.sentByDoctorId}, ${input.consultationVersionId ?? null}, NOW(), NOW()
        )
        RETURNING ${SELECT_COLUMNS}
      `);
      return toRecord(rows[0]);
    } catch (err) {
      if (isUniqueViolation(err) && input.consultationVersionId) {
        const existing = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
          SELECT ${SELECT_COLUMNS} FROM "WhatsappDelivery"
           WHERE "assessmentId" = ${input.assessmentId}
             AND "subject" = ${input.subject}
             AND "consultationVersionId" = ${input.consultationVersionId}
             AND "status" IN ('PENDING'::"DeliveryStatus", 'SENT'::"DeliveryStatus", 'DELIVERED'::"DeliveryStatus")
           ORDER BY "createdAt" ASC
           LIMIT 1
        `);
        if (existing[0]) throw new DeliveryRaceLostError(existing[0].id);
      }
      throw err;
    }
  });
}

/**
 * Read one delivery row by id. Used to resolve `DeliveryRaceLostError`: the
 * losing side of a concurrent send needs to know what the winner's row
 * currently says, which may still be PENDING (winner mid-flight) or already
 * terminal (SENT/FAILED/…).
 */
export async function getDeliveryById(id: string): Promise<DeliveryRecord | null> {
  return guarded(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${SELECT_COLUMNS} FROM "WhatsappDelivery" WHERE "id" = ${id} LIMIT 1
    `);
    return rows[0] ? toRecord(rows[0]) : null;
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
  /**
   * The terminal status to write. Defaults to FAILED. CONFIGURATION_ERROR and
   * BLOCKED_NO_CONSENT are the other two non-success terminal states this
   * function writes — kept as ONE writer rather than three near-identical
   * ones, since all three are "this delivery did not go out, here is why" and
   * differ only in the reason code and whether a retry can ever succeed.
   */
  status?: "FAILED" | "CONFIGURATION_ERROR" | "BLOCKED_NO_CONSENT";
}

export async function markDeliveryFailed(
  input: MarkFailedInput,
): Promise<DeliveryRecord | null> {
  const status = input.status ?? "FAILED";
  return guarded(async () => {
    const match = input.byMessageId
      ? Prisma.sql`"messageId" = ${input.deliveryId}`
      : Prisma.sql`"id" = ${input.deliveryId}`;
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      UPDATE "WhatsappDelivery"
         SET "status"         = ${status}::"DeliveryStatus",
             "lastError"      = ${input.error},
             "providerStatus" = ${input.providerStatus},
             -- Attempts counts SEND attempts we made. A provider reporting a
             -- late failure is not another attempt by us, so the counter is
             -- only advanced on our own send path. BLOCKED_NO_CONSENT and
             -- CONFIGURATION_ERROR never reached a provider either.
             "attempts"       = "attempts" + ${input.byMessageId || status !== "FAILED" ? 0 : 1},
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

/**
 * Has THIS EXACT release already been delivered? — the idempotency check.
 *
 * ── What "duplicate" means here, precisely ──────────────────────────────────
 * A doctor re-sending a report after a genuine failure, or after re-approving
 * a revised consultation, is legitimate and must keep working — see
 * `readLatestDeliveries`'s own note that re-sending is an expected action.
 * What must NOT happen is two successful provider sends for the SAME
 * approved consultation version, from one user action (a double-click, a
 * network retry replaying the request). So this asks a narrower question
 * than "was anything ever sent" — it asks "was THIS version's report already
 * accepted by the provider" — and only a match on BOTH the subject and the
 * exact `consultationVersionId` counts.
 *
 * ── Never blocks a send it cannot verify ────────────────────────────────────
 * `consultationVersionId` is a 20260907_report_asset_pipeline column, one
 * migration later than the columns `guarded()` already tolerates missing. If
 * this specific check cannot run — column not provisioned, or any other
 * error — it returns null (no known duplicate) rather than raising, so a
 * missing idempotency optimisation degrades to "no worse than before this
 * existed", never to "sends are blocked".
 */
export async function findExistingSuccessfulDelivery(input: {
  assessmentId: string;
  subject: DeliverySubject;
  consultationVersionId: string;
}): Promise<DeliveryRecord | null> {
  try {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${SELECT_COLUMNS}
        FROM "WhatsappDelivery"
       WHERE "assessmentId" = ${input.assessmentId}
         AND "subject" = ${input.subject}
         AND "consultationVersionId" = ${input.consultationVersionId}
         AND "status" IN ('SENT'::"DeliveryStatus", 'DELIVERED'::"DeliveryStatus")
       ORDER BY "createdAt" DESC
       LIMIT 1
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  } catch (err) {
    if (isMissing(err)) return null;
    console.warn(
      "[delivery] idempotency check failed, proceeding without it:",
      err instanceof Error ? err.name : "unknown",
    );
    return null;
  }
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

export interface DeliveryReportProvenance {
  deliveryId: string;
  patientId: string | null;
  channel: string | null;
  consultationVersionId: string | null;
  reportAssetId: string | null;
  onePagerAttached: boolean | null;
  assetSha256: string | null;
  assetTemplateVersion: string | null;
}

/**
 * Record WHAT a delivery carried, beside the record that it happened.
 *
 * ── Why this is a separate statement, and why it cannot fail a send ─────────
 * These columns arrive with 20260907_report_asset_pipeline, which is a later
 * migration than the one the INSERT in `createDelivery` depends on. A
 * deployment that has applied one and not the other must still be able to send
 * a patient their report: losing the provenance is a gap in the record, losing
 * the send is a gap in the care, and those are not the same size of problem.
 *
 * So this is its own UPDATE, and it swallows the unprovisioned case rather
 * than propagating it. Every other error is logged and swallowed too, for the
 * same reason — by the time this runs, a message is already on its way to a
 * patient's phone and there is nothing left to roll back.
 *
 * ── Why the hash is copied ─────────────────────────────────────────────────
 * `assetSha256` and `assetTemplateVersion` are duplicated from the asset row
 * rather than joined to it at read time. A re-render tomorrow produces
 * different bytes; if this row pointed at "whatever the asset says now", the
 * historical record of what a patient received would change underneath it.
 */
export async function recordDeliveryReportProvenance(
  input: DeliveryReportProvenance,
): Promise<void> {
  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "WhatsappDelivery"
         SET "patientId"             = COALESCE(${input.patientId}, "patientId"),
             "channel"               = COALESCE(${input.channel}, "channel"),
             "consultationVersionId" = COALESCE(${input.consultationVersionId}, "consultationVersionId"),
             "reportAssetId"         = COALESCE(${input.reportAssetId}, "reportAssetId"),
             "onePagerAttached"      = COALESCE(${input.onePagerAttached}, "onePagerAttached"),
             "assetSha256"           = COALESCE(${input.assetSha256}, "assetSha256"),
             "assetTemplateVersion"  = COALESCE(${input.assetTemplateVersion}, "assetTemplateVersion"),
             "updatedAt"             = NOW()
       WHERE "id" = ${input.deliveryId}
    `);
  } catch (err) {
    if (isMissing(err)) {
      // The migration has not been applied here. The delivery itself is
      // recorded; only its provenance is not, which is the honest state of a
      // deployment that has not switched this on.
      return;
    }
    console.warn(
      "[delivery] could not record report provenance:",
      err instanceof Error ? err.name : "unknown",
    );
  }
}
