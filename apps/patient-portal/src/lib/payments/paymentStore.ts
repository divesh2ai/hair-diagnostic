import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSchemaDriftError } from "@/lib/prismaErrors";

// Kit order payment persistence, over raw SQL.
//
// Same freeze reasoning as lib/fulfilment/fulfilmentStore and
// lib/doctor/appointments: `KitOrderPayment` is in schema.prisma and in
// prisma/migrations/20260829_post_approval_workflow, which is NOT applied, so
// the typed client does not know about it. Callers get
// PaymentNotProvisionedError → 503 with a stable reason code.

export const PAYMENT_NOT_PROVISIONED = "payment_not_provisioned";

export class PaymentNotProvisionedError extends Error {
  readonly reason = PAYMENT_NOT_PROVISIONED;
  constructor() {
    super(
      "KitOrderPayment is not provisioned. Apply prisma/migrations/20260829_post_approval_workflow.",
    );
    this.name = "PaymentNotProvisionedError";
  }
}

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

export async function guardedPayment<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissing(err)) throw new PaymentNotProvisionedError();
    throw err;
  }
}

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
  return `c${Date.now().toString(36)}${rand}`.slice(0, 25);
}

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentSource = "PROVIDER_WEBHOOK" | "CLINIC_COUNTER";

export interface PaymentRecord {
  id: string;
  kitOrderIntentId: string;
  clinicId: string;
  assessmentId: string;
  status: PaymentStatus;
  source: PaymentSource | null;
  amountMinor: number | null;
  currency: string;
  provider: string | null;
  providerRef: string | null;
  recordedByDoctorId: string | null;
  /** ISO 8601. */
  checkoutStartedAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface RawRow {
  id: string;
  kitOrderIntentId: string;
  clinicId: string;
  assessmentId: string;
  status: PaymentStatus;
  source: PaymentSource | null;
  amountMinor: number | null;
  currency: string;
  provider: string | null;
  providerRef: string | null;
  recordedByDoctorId: string | null;
  checkoutStartedAt: Date | null;
  paidAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

function toRecord(r: RawRow): PaymentRecord {
  return {
    id: r.id,
    kitOrderIntentId: r.kitOrderIntentId,
    clinicId: r.clinicId,
    assessmentId: r.assessmentId,
    status: r.status,
    source: r.source,
    amountMinor: r.amountMinor === null ? null : Number(r.amountMinor),
    currency: r.currency,
    provider: r.provider,
    providerRef: r.providerRef,
    recordedByDoctorId: r.recordedByDoctorId,
    checkoutStartedAt: iso(r.checkoutStartedAt),
    paidAt: iso(r.paidAt),
    failedAt: iso(r.failedAt),
    lastError: r.lastError,
    createdAt: r.createdAt.toISOString(),
  };
}

const COLS = Prisma.sql`
  "id", "kitOrderIntentId", "clinicId", "assessmentId",
  "status"::text AS "status", "source"::text AS "source",
  "amountMinor", "currency", "provider", "providerRef", "recordedByDoctorId",
  "checkoutStartedAt", "paidAt", "failedAt", "lastError", "createdAt"
`;

export async function readPaymentByIntent(
  kitOrderIntentId: string,
): Promise<PaymentRecord | null> {
  return guardedPayment(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "KitOrderPayment"
       WHERE "kitOrderIntentId" = ${kitOrderIntentId}
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  });
}

export async function readPaymentByAssessment(
  assessmentId: string,
): Promise<PaymentRecord | null> {
  return guardedPayment(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "KitOrderPayment"
       WHERE "assessmentId" = ${assessmentId}
       ORDER BY "createdAt" DESC LIMIT 1
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  });
}

/**
 * Record that the patient began checkout.
 *
 * ── Why this is safe to expose to a patient-token caller ────────────────────
 * It writes PENDING and only PENDING. There is no argument, and no code path
 * from here, that can produce PAID — that transition lives in `markPaid`,
 * which requires an authoritative source. So the worst a patient can do by
 * calling this repeatedly is restate that they are looking at the checkout,
 * which is what it is for.
 *
 * `ON CONFLICT DO UPDATE` keeps the FIRST `checkoutStartedAt` via COALESCE:
 * "when did this patient first try to pay" is the question ops asks about an
 * abandoned cart, and refreshing the page must not reset that clock.
 */
export async function startCheckout(input: {
  kitOrderIntentId: string;
  clinicId: string;
  assessmentId: string;
  amountMinor: number | null;
}): Promise<PaymentRecord> {
  const id = newId();
  return guardedPayment(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      INSERT INTO "KitOrderPayment" (
        "id", "kitOrderIntentId", "clinicId", "assessmentId", "status",
        "amountMinor", "currency", "checkoutStartedAt", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${input.kitOrderIntentId}, ${input.clinicId}, ${input.assessmentId},
        'PENDING'::"KitOrderPaymentStatus", ${input.amountMinor}, 'INR',
        NOW(), NOW(), NOW()
      )
      ON CONFLICT ("kitOrderIntentId") DO UPDATE
        SET "checkoutStartedAt" = COALESCE("KitOrderPayment"."checkoutStartedAt", NOW()),
            "updatedAt"         = NOW()
      RETURNING ${COLS}
    `);
    return toRecord(rows[0]);
  });
}

export interface MarkPaidInput {
  kitOrderIntentId: string;
  clinicId: string;
  assessmentId: string;
  source: PaymentSource;
  amountMinor: number | null;
  provider: string | null;
  providerRef: string | null;
  recordedByDoctorId: string | null;
}

export type MarkPaidResult =
  | { outcome: "paid"; payment: PaymentRecord }
  | { outcome: "already_paid"; payment: PaymentRecord }
  /**
   * This provider reference is already recorded against a DIFFERENT order.
   *
   * `(provider, providerRef)` is unique precisely so one gateway payment
   * cannot be claimed by two orders — but the INSERT's `ON CONFLICT` targets
   * `kitOrderIntentId`, so a collision on the other index was raised as an
   * unhandled unique violation and surfaced as a 500. A 500 makes a gateway
   * retry forever, and tells an operator nothing about what is actually a
   * meaningful commercial anomaly: the same payment id arriving for a second
   * order. Named, so both callers can answer it deliberately.
   */
  | { outcome: "reference_conflict"; payment: null };

/**
 * Mark an order paid. **Idempotent.**
 *
 * ── The two ways this gets called twice ─────────────────────────────────────
 * A payment gateway retries its webhook until it receives a 2xx, so the same
 * event arrives two, five, or fifty times — that is normal operation, not an
 * attack. Separately, a clinic user can double-submit the counter form.
 *
 * Both are handled by the database rather than by a handler's if-statement:
 *
 *   • INSERT … ON CONFLICT ("kitOrderIntentId") DO UPDATE … WHERE status <> 'PAID'
 *
 * The conditional UPDATE is the whole trick. A row already in PAID matches the
 * conflict target but fails the WHERE, so the statement returns NOTHING and
 * the second caller falls through to a read. There is no window between a
 * check and a write for a concurrent caller to slip through, because there is
 * no check — the condition is part of the write.
 *
 * The caller distinguishes `paid` from `already_paid` and creates the
 * fulfilment request only on the former; see confirmPayment.
 */
export async function markPaid(input: MarkPaidInput): Promise<MarkPaidResult> {
  const id = newId();
  // The explicit type argument matters: without it TypeScript infers the inner
  // async function's return as `{ outcome: string; … }` — the two literal
  // branches widen to `string` — and the union no longer satisfies
  // MarkPaidResult. Naming it keeps each branch discriminated.
  return guardedPayment<MarkPaidResult>(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      INSERT INTO "KitOrderPayment" (
        "id", "kitOrderIntentId", "clinicId", "assessmentId", "status", "source",
        "amountMinor", "currency", "provider", "providerRef",
        "recordedByDoctorId", "paidAt", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${input.kitOrderIntentId}, ${input.clinicId}, ${input.assessmentId},
        'PAID'::"KitOrderPaymentStatus", ${input.source}::"KitOrderPaymentSource",
        ${input.amountMinor}, 'INR', ${input.provider}, ${input.providerRef},
        ${input.recordedByDoctorId}, NOW(), NOW(), NOW()
      )
      ON CONFLICT ("kitOrderIntentId") DO UPDATE
        SET "status"             = 'PAID'::"KitOrderPaymentStatus",
            "source"             = EXCLUDED."source",
            "amountMinor"        = COALESCE(EXCLUDED."amountMinor", "KitOrderPayment"."amountMinor"),
            "provider"           = COALESCE(EXCLUDED."provider", "KitOrderPayment"."provider"),
            "providerRef"        = COALESCE(EXCLUDED."providerRef", "KitOrderPayment"."providerRef"),
            "recordedByDoctorId" = COALESCE(EXCLUDED."recordedByDoctorId", "KitOrderPayment"."recordedByDoctorId"),
            "paidAt"             = COALESCE("KitOrderPayment"."paidAt", NOW()),
            "updatedAt"          = NOW()
        WHERE "KitOrderPayment"."status" <> 'PAID'::"KitOrderPaymentStatus"
      RETURNING ${COLS}
    `);

    if (rows[0]) {
      return { outcome: "paid", payment: toRecord(rows[0]) } satisfies MarkPaidResult;
    }

    const existing = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "KitOrderPayment"
       WHERE "kitOrderIntentId" = ${input.kitOrderIntentId}
    `);
    if (!existing[0]) throw new Error("payment_conflict_without_row");
    return {
      outcome: "already_paid",
      payment: toRecord(existing[0]),
    } satisfies MarkPaidResult;
  }).catch((err): MarkPaidResult => {
    // A unique violation that ISN'T the order key is the reference collision
    // described on MarkPaidResult. Distinguished here rather than at the two
    // call sites so both cannot disagree about what it means.
    if (isReferenceConflict(err)) {
      return { outcome: "reference_conflict", payment: null };
    }
    throw err;
  });
}

/**
 * Was this a unique violation on `(provider, providerRef)`?
 *
 * ── What the error actually looks like ──────────────────────────────────────
 * A raw query surfaces as P2010 carrying the driver's SQLSTATE and Postgres's
 * own detail line, which names the COLUMNS rather than the index:
 *
 *   code:    "23505"
 *   message: `Key (provider, "providerRef")=(razorpay, pay_123) already exists.`
 *
 * So the match is on `providerRef` appearing in that detail. It is specific:
 * `providerRef` participates in exactly one unique index on this table, and
 * the other one — the order key — is consumed by `ON CONFLICT` and can never
 * reach here.
 *
 * Deliberately NOT "any 23505". Treating every unique violation as a reference
 * collision would report an unrelated integrity failure as a tidy commercial
 * anomaly and hide a real bug.
 *
 * P2002 is handled too, for the day a caller switches to the typed client;
 * there the violated fields arrive in `meta.target` instead.
 */
function isReferenceConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const meta = (err.meta ?? {}) as { target?: unknown };
      return JSON.stringify(meta.target ?? "").includes("providerRef");
    }
    if (err.code === "P2010") {
      const meta = (err.meta ?? {}) as { code?: string; message?: string };
      return meta.code === "23505" && (meta.message ?? "").includes("providerRef");
    }
  }
  return false;
}

/**
 * Paid orders whose clinic fulfilment has not been requested.
 *
 * This is the reconciliation query, and it exists because "create a fulfilment
 * request on payment" can fail in the gap between the two writes — a process
 * restart, a database blip. The action centre surfaces whatever this returns
 * so a stuck order is visible to a human within minutes rather than
 * discovered by a patient who never received their kit.
 */
export async function listPaidAwaitingFulfilment(options: {
  clinicId: string | null;
  limit?: number;
}): Promise<
  Array<{
    kitOrderIntentId: string;
    assessmentId: string;
    clinicId: string;
    clinicName: string | null;
    paidAt: string | null;
    fulfilmentMode: string | null;
  }>
> {
  const { clinicId, limit = 50 } = options;
  return guardedPayment(async () => {
    const scope = clinicId ? Prisma.sql`AND p."clinicId" = ${clinicId}` : Prisma.empty;
    const rows = await prisma.$queryRaw<
      Array<{
        kitOrderIntentId: string;
        assessmentId: string;
        clinicId: string;
        clinicName: string | null;
        paidAt: Date | null;
        fulfilmentMode: string | null;
      }>
    >(Prisma.sql`
      SELECT p."kitOrderIntentId", p."assessmentId", p."clinicId",
             c."name" AS "clinicName", p."paidAt",
             i."fulfilmentMode"::text AS "fulfilmentMode"
        FROM "KitOrderPayment" p
        LEFT JOIN "Clinic" c          ON c."id" = p."clinicId"
        LEFT JOIN "KitOrderIntent" i  ON i."id" = p."kitOrderIntentId"
        LEFT JOIN "ClinicKitFulfilment" f ON f."kitOrderIntentId" = p."kitOrderIntentId"
       WHERE p."status" = 'PAID'::"KitOrderPaymentStatus"
         AND f."id" IS NULL
         ${scope}
       ORDER BY p."paidAt" ASC
       LIMIT ${limit}
    `);
    return rows.map((r) => ({ ...r, paidAt: iso(r.paidAt) }));
  });
}

/**
 * Carts the patient was sent but has not paid for, older than `olderThanHours`.
 *
 * Used by the action centre's follow-up group. Returns identifiers and
 * timestamps only — the follow-up itself is a human picking up a phone, and
 * this list does not need to carry who they are calling to be actionable from
 * the case link.
 */
export async function listUnpaidCarts(options: {
  clinicId: string | null;
  olderThanHours: number;
  limit?: number;
}): Promise<
  Array<{
    assessmentId: string;
    kitOrderIntentId: string;
    clinicId: string;
    clinicName: string | null;
    sentAt: string | null;
    checkoutStartedAt: string | null;
  }>
> {
  const { clinicId, olderThanHours, limit = 50 } = options;
  return guardedPayment(async () => {
    const scope = clinicId ? Prisma.sql`AND i."clinicId" = ${clinicId}` : Prisma.empty;
    const rows = await prisma.$queryRaw<
      Array<{
        assessmentId: string;
        kitOrderIntentId: string;
        clinicId: string;
        clinicName: string | null;
        sentAt: Date | null;
        checkoutStartedAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT i."assessmentId", i."id" AS "kitOrderIntentId", i."clinicId",
             c."name" AS "clinicName",
             d."sentAt", p."checkoutStartedAt"
        FROM "KitOrderIntent" i
        JOIN LATERAL (
          SELECT w."sentAt"
            FROM "WhatsappDelivery" w
           WHERE w."assessmentId" = i."assessmentId"
             AND w."subject" = 'CART'
             AND w."status" = 'SENT'::"DeliveryStatus"
           ORDER BY w."createdAt" DESC
           LIMIT 1
        ) d ON TRUE
        LEFT JOIN "Clinic" c          ON c."id" = i."clinicId"
        LEFT JOIN "KitOrderPayment" p ON p."kitOrderIntentId" = i."id"
       WHERE i."status" = 'READY_FOR_FULFILMENT'::"KitOrderStatus"
         AND d."sentAt" < NOW() - (${olderThanHours} * INTERVAL '1 hour')
         AND (p."id" IS NULL OR p."status" <> 'PAID'::"KitOrderPaymentStatus")
         ${scope}
       ORDER BY d."sentAt" ASC
       LIMIT ${limit}
    `);
    return rows.map((r) => ({
      ...r,
      sentAt: iso(r.sentAt),
      checkoutStartedAt: iso(r.checkoutStartedAt),
    }));
  });
}
