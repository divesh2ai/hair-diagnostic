// Durable state for rendered clinical artefacts: the ReportAsset row, and the
// claim/settle operations that make it a queue.
//
// ── Why the queue lives in this table ───────────────────────────────────────
// The alternative is an outbox event saying "render this" beside a row saying
// "this is the render". Two records of one intention is how a system acquires
// two disagreeing answers to "did we make the patient's one-pager?". Creating
// the row IS the enqueue, so a process that dies immediately after the
// approval commits has still durably recorded the work — PHASE 23's failure
// window closes by construction rather than by an outbox dispatcher that must
// itself be reliable.
//
// ── Why every write is a conditional UPDATE ─────────────────────────────────
// Two workers can reach the same row. Every state transition here is expressed
// as an UPDATE whose WHERE clause contains the state it expects to find, so
// the loser of a race updates zero rows and is told so. Nothing in this module
// reads-then-writes.
//
// ── Behaviour before the migration is applied ───────────────────────────────
// Follows the house pattern (lib/delivery/deliveryStore, lib/fulfilment): the
// missing-relation error is caught and reported as "not provisioned" rather
// than thrown. A deployment that has not run 20260907_report_asset_pipeline
// therefore still approves consultations and still shares report links — it
// simply never has an asset to attach, which the doctor is told truthfully.

import { Prisma } from "@prisma/client";
import type { PrismaClient, ReportAsset, ReportAssetType } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { isSchemaDriftError } from "@/lib/prismaErrors";
import {
  MAX_RENDER_ATTEMPTS,
  RENDER_LEASE_MS,
  nextAttemptAfter,
  type RenderErrorCode,
} from "./contract";

export const REPORT_ASSETS_NOT_PROVISIONED = "report_assets_not_provisioned";

export class ReportAssetsNotProvisionedError extends Error {
  readonly reason = REPORT_ASSETS_NOT_PROVISIONED;
  constructor() {
    super(
      'The "ReportAsset" table is not provisioned. Apply prisma/migrations/20260907_report_asset_pipeline.',
    );
    this.name = "ReportAssetsNotProvisionedError";
  }
}

/**
 * Is this the database telling us the table or a column is absent?
 *
 * P2021/P2022 are Prisma's typed answers; 42P01/42703/42704 are Postgres',
 * which surface through P2010 on raw queries. Both are checked because this
 * module uses the typed client and the sweeper uses raw SQL.
 */
function isMissing(err: unknown): boolean {
  if (isSchemaDriftError(err)) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    if (meta.code === "42P01" || meta.code === "42703" || meta.code === "42704") return true;
    return /does not exist/i.test(meta.message ?? err.message);
  }
  return false;
}

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissing(err)) throw new ReportAssetsNotProvisionedError();
    throw err;
  }
}

/**
 * Run and swallow "not provisioned", answering with `fallback` instead.
 *
 * Used by every read on a patient-facing or doctor-facing path, where the
 * honest answer to "is there an asset?" on an unmigrated deployment is "no" —
 * not a 500.
 */
export async function tolerant<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ReportAssetsNotProvisionedError || isMissing(err)) return fallback;
    throw err;
  }
}

type Db = PrismaClient | Prisma.TransactionClient;

export interface EnsureAssetInput {
  clinicId: string;
  patientId: string | null;
  assessmentId: string;
  consultationId: string;
  consultationVersionId: string;
  contentVersion: number;
  type: ReportAssetType;
  templateVersion: string;
  rendererVersion: string;
}

export interface EnsureAssetResult {
  asset: ReportAsset;
  /** False when a prior approval, retry or concurrent click already created it. */
  created: boolean;
}

/**
 * Create the PENDING row for an artefact, or return the one that already
 * exists. Idempotent by the database's render key, not by a prior read.
 *
 * ── Why `create` first and catch P2002 ──────────────────────────────────────
 * `findFirst` then `create` loses the race it exists to win: two approvals
 * arriving together both find nothing and both create. Attempting the insert
 * and letting the unique index arbitrate means the loser learns it lost, and
 * re-reads the winner's row.
 *
 * ── Why it takes a `Db` ─────────────────────────────────────────────────────
 * So a caller can pass its transaction client and have the asset row commit
 * atomically with the approval it belongs to (PHASE 23).
 */
export async function ensureAsset(
  input: EnsureAssetInput,
  db: Db = defaultPrisma,
): Promise<EnsureAssetResult> {
  return guarded(async () => {
    try {
      const asset = await db.reportAsset.create({
        data: {
          clinicId: input.clinicId,
          patientId: input.patientId,
          assessmentId: input.assessmentId,
          consultationId: input.consultationId,
          consultationVersionId: input.consultationVersionId,
          contentVersion: input.contentVersion,
          type: input.type,
          templateVersion: input.templateVersion,
          rendererVersion: input.rendererVersion,
          status: "PENDING",
          // Claimable immediately. The backoff schedule only ever moves this
          // forward, on failure.
          nextAttemptAt: new Date(),
        },
      });
      return { asset, created: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await db.reportAsset.findUnique({
          where: {
            render_key: {
              consultationVersionId: input.consultationVersionId,
              type: input.type,
              templateVersion: input.templateVersion,
              rendererVersion: input.rendererVersion,
            },
          },
        });
        if (existing) return { asset: existing, created: false };
      }
      throw err;
    }
  });
}

/**
 * Claim one due row for rendering, or null when there is no work.
 *
 * ── How two workers are kept off one row ────────────────────────────────────
 * The claim is a single conditional UPDATE. A row is claimable when it is
 * PENDING/QUEUED and due, OR when it is RENDERING but its lease has expired —
 * the second disjunct is what reclaims a row from a worker that was killed
 * mid-render. `updateMany` reports how many rows it changed; zero means
 * somebody else took it, and this returns null rather than proceeding on a row
 * it does not own.
 *
 * The returned `leaseId` is the claimer's proof of ownership, and every
 * settling write below requires it. A slow worker whose lease expired and was
 * reclaimed therefore cannot overwrite its successor's result.
 */
export async function claimNextDue(
  opts: { now?: Date; type?: ReportAssetType } = {},
  db: Db = defaultPrisma,
): Promise<{ asset: ReportAsset; leaseId: string } | null> {
  return guarded(async () => {
    const now = opts.now ?? new Date();
    const candidate = await db.reportAsset.findFirst({
      where: {
        ...(opts.type ? { type: opts.type } : {}),
        OR: [
          { status: { in: ["PENDING", "QUEUED"] }, nextAttemptAt: { lte: now } },
          { status: { in: ["PENDING", "QUEUED"] }, nextAttemptAt: null },
          { status: "RENDERING", leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!candidate) return null;

    const leaseId = `lease_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const claimed = await db.reportAsset.updateMany({
      where: {
        id: candidate.id,
        // The state we expect to find. If it moved between the read and this
        // write, we changed nothing and we own nothing.
        status: candidate.status,
        attemptCount: candidate.attemptCount,
        leaseId: candidate.leaseId,
      },
      data: {
        status: "RENDERING",
        leaseId,
        leaseExpiresAt: new Date(now.getTime() + RENDER_LEASE_MS),
        attemptCount: candidate.attemptCount + 1,
        lastAttemptAt: now,
      },
    });
    if (claimed.count !== 1) return null;

    const asset = await db.reportAsset.findUnique({ where: { id: candidate.id } });
    return asset ? { asset, leaseId } : null;
  });
}

/**
 * Record a successful render. Refused unless the caller still holds the lease.
 *
 * `storagePath` is written here and never rewritten: the path contains the
 * asset id, so a re-render after a failure produces a different object rather
 * than overwriting the one a delivery may already reference.
 */
export async function markReady(
  input: {
    assetId: string;
    leaseId: string;
    storageBucket: string;
    storagePath: string;
    mimeType: string;
    byteSize: number;
    sha256: string;
  },
  db: Db = defaultPrisma,
): Promise<boolean> {
  return guarded(async () => {
    const res = await db.reportAsset.updateMany({
      where: { id: input.assetId, leaseId: input.leaseId, status: "RENDERING" },
      data: {
        status: "READY",
        storageBucket: input.storageBucket,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        sha256: input.sha256,
        generatedAt: new Date(),
        leaseId: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        errorCode: null,
        lastError: null,
      },
    });
    return res.count === 1;
  });
}

/**
 * Record a failed attempt, and decide whether there will be another.
 *
 * A permanent classification goes straight to FAILED regardless of the
 * remaining budget — retrying "this version is not approved" four times only
 * delays the moment an operator sees the real reason.
 */
export async function markAttemptFailed(
  input: {
    assetId: string;
    leaseId: string;
    code: RenderErrorCode;
    detail: string;
    permanent: boolean;
    now?: Date;
  },
  db: Db = defaultPrisma,
): Promise<{ settled: boolean; terminal: boolean }> {
  return guarded(async () => {
    const now = input.now ?? new Date();
    const current = await db.reportAsset.findUnique({
      where: { id: input.assetId },
      select: { attemptCount: true },
    });
    const attempts = current?.attemptCount ?? MAX_RENDER_ATTEMPTS;
    const retryAt = input.permanent ? null : nextAttemptAfter(attempts, now);
    const terminal = retryAt === null;

    const res = await db.reportAsset.updateMany({
      where: { id: input.assetId, leaseId: input.leaseId, status: "RENDERING" },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        nextAttemptAt: retryAt,
        errorCode: input.code,
        lastError: input.detail,
        leaseId: null,
        leaseExpiresAt: null,
      },
    });
    return { settled: res.count === 1, terminal };
  });
}

/**
 * Move a PENDING row to QUEUED when a dispatch has been requested.
 *
 * Cosmetic for the state machine — a claimer treats both identically — and
 * meaningful for an operator, who can tell a row nobody has looked at from a
 * row whose worker has been asked for.
 */
export async function markQueued(assetId: string, db: Db = defaultPrisma): Promise<void> {
  await guarded(() =>
    db.reportAsset.updateMany({
      where: { id: assetId, status: "PENDING" },
      data: { status: "QUEUED" },
    }),
  );
}

/** The artefact for one approved version, whatever state it is in. */
export async function findByRenderKey(
  key: {
    consultationVersionId: string;
    type: ReportAssetType;
    templateVersion: string;
    rendererVersion: string;
  },
  db: Db = defaultPrisma,
): Promise<ReportAsset | null> {
  return guarded(() => db.reportAsset.findUnique({ where: { render_key: key } }));
}

export async function findById(
  assetId: string,
  db: Db = defaultPrisma,
): Promise<ReportAsset | null> {
  return guarded(() => db.reportAsset.findUnique({ where: { id: assetId } }));
}

/** Every artefact recorded for an assessment, newest first. Support surface. */
export async function listForAssessment(
  assessmentId: string,
  db: Db = defaultPrisma,
): Promise<ReportAsset[]> {
  return guarded(() =>
    db.reportAsset.findMany({
      where: { assessmentId },
      orderBy: { createdAt: "desc" },
    }),
  );
}

/**
 * Put a FAILED artefact back in the queue, deliberately.
 *
 * ── Why this is not automatic ───────────────────────────────────────────────
 * The retry budget has already been spent: four attempts across six minutes
 * decided this was not going to work. Resetting it on a timer would produce a
 * row that fails forever while looking busy, and would bury the failure code
 * an operator needs under a permanently incrementing attempt count. So a
 * human, or an operator script, asks — and the attempt count starts again from
 * zero so the fresh budget is a real one.
 *
 * A READY asset is never reset: its bytes have been delivered, and re-rendering
 * over a delivered artefact is the one operation that could change what a
 * patient was given after the fact. Returns false when the row was not FAILED.
 */
export async function resetForRetry(
  assetId: string,
  db: Db = defaultPrisma,
): Promise<boolean> {
  return guarded(async () => {
    const res = await db.reportAsset.updateMany({
      where: { id: assetId, status: "FAILED" },
      data: {
        status: "PENDING",
        attemptCount: 0,
        nextAttemptAt: new Date(),
        leaseId: null,
        leaseExpiresAt: null,
        // The previous failure is cleared from the working columns because it
        // no longer describes the row's state. It survives in the audit log,
        // which is where a history belongs.
        errorCode: null,
        lastError: null,
      },
    });
    return res.count === 1;
  });
}
