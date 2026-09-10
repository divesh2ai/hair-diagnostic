// Requesting a render, and getting a worker to notice.
//
// ── Where durability actually lives ─────────────────────────────────────────
// In the ReportAsset row, and nowhere else. `ensureOnePagerAsset` writes a
// PENDING row — ideally inside the approval's own transaction — and that write
// IS the enqueue. Everything below it in this file is latency optimisation: if
// every trigger in here is lost to a crash, a dropped packet or a cold start,
// the row is still PENDING, still due, and the scheduled sweep still finds it.
//
// This distinction matters enough to state plainly, because "fire a fetch and
// hope" is exactly the anti-pattern that must not be mistaken for a queue. It
// is not the queue. It is a doorbell on a door that is already unlocked.

import type { Prisma, PrismaClient, ReportAsset } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  ONE_PAGER_RENDERER_VERSION,
  ONE_PAGER_TEMPLATE_VERSION,
  onePagerPngKey,
} from "./contract";
import {
  ensureAsset,
  findByRenderKey,
  markQueued,
  tolerant,
  type EnsureAssetResult,
} from "./repository";
import { resolveDeploymentOrigin } from "./origin";

type Db = PrismaClient | Prisma.TransactionClient;

export interface EnsureOnePagerInput {
  clinicId: string;
  patientId: string | null;
  assessmentId: string;
  consultationId: string;
  consultationVersionId: string;
  contentVersion: number;
}

/**
 * Record that this approved version needs a one-pager PNG.
 *
 * Idempotent by the database's render key: a doctor who double-clicks Approve,
 * an endpoint that is retried, and a share that later re-checks all converge
 * on the same row. Never creates a second asset for the same version.
 *
 * Pass `db: tx` to make the row commit atomically with the approval it belongs
 * to. The caller is expected to do that; the default exists for the recovery
 * paths that run outside any transaction.
 */
export async function ensureOnePagerAsset(
  input: EnsureOnePagerInput,
  db: Db = defaultPrisma,
): Promise<EnsureAssetResult> {
  return ensureAsset(
    {
      clinicId: input.clinicId,
      patientId: input.patientId,
      assessmentId: input.assessmentId,
      consultationId: input.consultationId,
      consultationVersionId: input.consultationVersionId,
      contentVersion: input.contentVersion,
      type: "ONE_PAGER_PNG",
      templateVersion: ONE_PAGER_TEMPLATE_VERSION,
      rendererVersion: ONE_PAGER_RENDERER_VERSION,
    },
    db,
  );
}

/**
 * Ensure the asset row exists for an assessment's CURRENT approved version.
 *
 * The recovery-shaped entry point: it resolves the aggregate itself, so a
 * caller that only holds an assessment id (a retry endpoint, an operator
 * script, the share path's safety net) can request a render without
 * reconstructing the approval's context.
 *
 * Returns null when there is nothing to render — no consultation, no current
 * version, or a version that is not approved. Not an error: "this case has not
 * been approved" is an ordinary answer.
 */
export async function ensureOnePagerAssetForAssessment(
  assessmentId: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<EnsureAssetResult | null> {
  const consultation = await prisma.consultation.findUnique({
    where: { assessmentId },
    select: {
      id: true,
      clinicId: true,
      patientId: true,
      assessmentId: true,
      currentVersion: {
        select: { id: true, contentVersion: true, approvalStatus: true },
      },
    },
  });
  const version = consultation?.currentVersion;
  if (!consultation || !version) return null;
  if (String(version.approvalStatus) !== "APPROVED") return null;

  return ensureOnePagerAsset(
    {
      clinicId: consultation.clinicId,
      patientId: consultation.patientId,
      assessmentId: consultation.assessmentId,
      consultationId: consultation.id,
      consultationVersionId: version.id,
      contentVersion: version.contentVersion,
    },
    prisma,
  );
}

/** The recorded artefact for an approved version, whatever state it is in. */
export async function findOnePagerAsset(
  consultationVersionId: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<ReportAsset | null> {
  return tolerant(() => findByRenderKey(onePagerPngKey(consultationVersionId), prisma), null);
}

/**
 * Ask a worker to look now.
 *
 * Best effort by design and by documentation. It marks the row QUEUED so an
 * operator can see that a dispatch was attempted, then pokes the worker
 * endpoint without waiting for it or caring whether it answered. Losing this
 * call costs seconds of latency and nothing else.
 *
 * Deliberately NOT awaited for its result: the render itself takes seconds,
 * and the whole point of this architecture is that no clinical action waits
 * for a browser.
 */
export async function requestRenderDispatch(assetId: string): Promise<void> {
  await tolerant(async () => {
    await markQueued(assetId);
  }, undefined);

  const secret = process.env.REPORT_RENDER_WORKER_SECRET;
  const origin = resolveDeploymentOrigin();
  if (!secret || !origin) {
    // Nothing to poke, or nothing to poke it with. The sweep will pick the row
    // up on its next pass — which is why this is a debug line and not a
    // warning about a broken pipeline.
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    await fetch(`${origin.origin}/api/internal/report-assets/render`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-render-worker-secret": secret,
        ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
          : {}),
      },
      body: JSON.stringify({ reason: "approval", limit: 1 }),
      signal: controller.signal,
    });
  } catch {
    // Swallowed on purpose. See the module comment: this is a doorbell.
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The whole request-a-one-pager flow, for callers outside a transaction.
 *
 * Writes the durable row, records that it was requested, and rings the
 * doorbell. Total — it never throws, because every one of its callers is on a
 * path where a clinical action has already succeeded and must not be undone by
 * a rendering concern.
 */
export async function requestOnePagerRender(input: {
  clinicId: string;
  patientId: string | null;
  assessmentId: string;
  consultationId: string;
  consultationVersionId: string;
  contentVersion: number;
  actorId?: string | null;
}): Promise<{ ok: boolean; assetId: string | null; created: boolean; reason?: string }> {
  try {
    const { asset, created } = await ensureOnePagerAsset(input);

    if (created) {
      await writeAuditLog({
        action: "REPORT_ASSET_REQUESTED",
        entityType: "ReportAsset",
        entityId: asset.id,
        actorId: input.actorId ?? null,
        actorType: "system",
        assessmentId: input.assessmentId,
        clinicId: input.clinicId,
        metadata: {
          type: asset.type,
          consultationVersionId: input.consultationVersionId,
          contentVersion: input.contentVersion,
          templateVersion: asset.templateVersion,
          rendererVersion: asset.rendererVersion,
        },
      }).catch(() => undefined);
    }

    if (asset.status === "PENDING") {
      await requestRenderDispatch(asset.id);
    }

    return { ok: true, assetId: asset.id, created };
  } catch (err) {
    // Includes ReportAssetsNotProvisionedError on a deployment that has not
    // applied the migration. The approval stands either way; the doctor is
    // told the one-pager is unavailable, which is true.
    const reason = err instanceof Error ? err.name : "unknown";
    console.warn(`[report-asset] could not request one-pager render: ${reason}`);
    return { ok: false, assetId: null, created: false, reason };
  }
}

/**
 * The same request, for a caller that holds only an assessment id.
 *
 * Used by the approval endpoints that do not create a kit order, by the
 * WhatsApp reviewer path, and by the share path's safety net. Resolves the
 * aggregate itself and is otherwise identical — same render key, same
 * idempotency, same refusal to throw.
 */
export async function requestOnePagerRenderForAssessment(
  assessmentId: string,
  actorId?: string | null,
  prisma: PrismaClient = defaultPrisma,
): Promise<{ ok: boolean; assetId: string | null; created: boolean; reason?: string }> {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { assessmentId },
      select: {
        id: true,
        clinicId: true,
        patientId: true,
        assessmentId: true,
        currentVersion: { select: { id: true, contentVersion: true, approvalStatus: true } },
      },
    });
    const version = consultation?.currentVersion;
    if (!consultation || !version) {
      return { ok: false, assetId: null, created: false, reason: "no_version" };
    }
    if (String(version.approvalStatus) !== "APPROVED") {
      // Not an error. An artefact is only ever produced from an approved
      // version, so "not approved" is an ordinary answer and not a fault.
      return { ok: false, assetId: null, created: false, reason: "not_approved" };
    }

    return requestOnePagerRender({
      clinicId: consultation.clinicId,
      patientId: consultation.patientId,
      assessmentId: consultation.assessmentId,
      consultationId: consultation.id,
      consultationVersionId: version.id,
      contentVersion: version.contentVersion,
      actorId,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    console.warn(`[report-asset] could not request one-pager render: ${reason}`);
    return { ok: false, assetId: null, created: false, reason };
  }
}

/**
 * Create the missing asset rows for versions that were approved without one.
 *
 * ── Why this exists (PHASE 23) ──────────────────────────────────────────────
 * The clinical approval is not a single database transaction — it spans the
 * orchestrator's repository port, out-of-band event emission and a separate
 * kit-order transaction, and wrapping all of that in one Postgres transaction
 * would hold a pooled connection open across an HTTP call. That is documented
 * and deliberate in lib/consultation/approveAndCreateOrder.
 *
 * The consequence is a real window: the approval commits, the process dies,
 * and the asset row was never written. Every other part of this design closes
 * its own window by making the row the queue — this is the one place that
 * cannot, so it is closed by reconciliation instead. The sweep asks the
 * database the only question that matters — "is there an approved version with
 * no artefact?" — and answers it, every pass, for as long as the platform
 * runs.
 *
 * Bounded to recent approvals so a pass stays cheap. Anything older is a
 * support question rather than an automatic recovery, and the retry endpoint
 * handles it explicitly.
 */
export async function backfillMissingAssets(
  opts: { withinDays?: number; limit?: number } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<{ scanned: number; created: number }> {
  const withinDays = opts.withinDays ?? 7;
  const limit = opts.limit ?? 100;
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);

  const approved = await prisma.consultationVersion.findMany({
    where: { approvalStatus: "APPROVED", approvedAt: { gte: since } },
    orderBy: { approvedAt: "desc" },
    take: limit,
    select: {
      id: true,
      contentVersion: true,
      consultation: {
        select: { id: true, clinicId: true, assessmentId: true, patientId: true },
      },
    },
  });
  if (approved.length === 0) return { scanned: 0, created: 0 };

  const existing = await tolerant(
    () =>
      prisma.reportAsset.findMany({
        where: {
          consultationVersionId: { in: approved.map((v) => v.id) },
          type: "ONE_PAGER_PNG",
          templateVersion: ONE_PAGER_TEMPLATE_VERSION,
          rendererVersion: ONE_PAGER_RENDERER_VERSION,
        },
        select: { consultationVersionId: true },
      }),
    [] as { consultationVersionId: string }[],
  );
  const have = new Set(existing.map((a) => a.consultationVersionId));

  let created = 0;
  for (const version of approved) {
    if (have.has(version.id)) continue;
    const result = await ensureOnePagerAsset(
      {
        clinicId: version.consultation.clinicId,
        patientId: version.consultation.patientId,
        assessmentId: version.consultation.assessmentId,
        consultationId: version.consultation.id,
        consultationVersionId: version.id,
        contentVersion: version.contentVersion,
      },
      prisma,
    );
    if (result.created) created += 1;
  }

  return { scanned: approved.length, created };
}
