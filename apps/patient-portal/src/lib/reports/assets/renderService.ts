// The render worker's one job: take a due ReportAsset row from PENDING to
// READY, or to a classified failure with a decided retry.
//
// Nothing in here is reachable from a doctor's request. That is the point of
// the whole exercise: a browser launch is seconds of wall clock and a class of
// failure that must never be able to fail a clinical action.

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  MAX_RENDER_ATTEMPTS,
  RENDER_TIMEOUT_MS,
  classifyRenderError,
  isPermanentFailure,
  reportAssetPath,
  validatePng,
  RenderError,
} from "./contract";
import { claimNextDue, markAttemptFailed, markReady } from "./repository";
import { createOnePagerRenderer, type OnePagerRenderer } from "./onePagerRenderer";
import { putReportAsset } from "./storage";
import { loadRenderSource } from "./source";
import { resolveDeploymentOrigin } from "./origin";
import { signRenderToken } from "./renderToken";

export type RenderOutcome =
  | { kind: "idle" }
  | {
      kind: "rendered";
      assetId: string;
      byteSize: number;
      sha256: string;
      durationMs: number;
    }
  | {
      kind: "failed";
      assetId: string;
      code: string;
      terminal: boolean;
      attempt: number;
    }
  | { kind: "lost"; assetId: string };

export interface RenderServiceDeps {
  prisma?: PrismaClient;
  renderer?: OnePagerRenderer;
  /** Overridable so a test can drive the pipeline without a browser. */
  now?: () => Date;
}

/**
 * Process at most one due artefact.
 *
 * One per call, deliberately: each render owns a Chromium process, and a
 * serverless invocation that starts four of them is an invocation that runs
 * out of memory instead of producing one report. The caller loops.
 */
export async function renderNextDue(deps: RenderServiceDeps = {}): Promise<RenderOutcome> {
  const prisma = deps.prisma ?? defaultPrisma;
  const now = deps.now ?? (() => new Date());
  const renderer = deps.renderer ?? createOnePagerRenderer();

  const claim = await claimNextDue({ now: now() }, prisma);
  if (!claim) return { kind: "idle" };

  const { asset, leaseId } = claim;
  const startedAt = Date.now();

  try {
    // ── Re-authorise the source, every time ────────────────────────────────
    // The row asked for this render in the past. Whether it may still happen
    // is a question about the present.
    const { snapshot } = await loadRenderSource(asset.id, prisma);
    void snapshot; // Read here to fail fast; the page reads it again to render.

    const origin = resolveDeploymentOrigin();
    if (!origin) {
      throw new RenderError(
        "UNKNOWN_RENDER_ERROR",
        "No deployment origin is configured — set RENDER_ORIGIN",
      );
    }

    // The credential is minted per render and lives for minutes. It names this
    // artefact and nothing else, so it cannot be replayed against another
    // patient's report even within its lifetime.
    const token = signRenderToken({
      assetId: asset.id,
      consultationVersionId: asset.consultationVersionId,
      type: asset.type,
    });

    const result = await renderer.render({
      origin: origin.origin,
      token,
      timeoutMs: RENDER_TIMEOUT_MS,
    });

    // ── Validate before believing it (PHASE 12) ────────────────────────────
    // Playwright returning a Buffer is not evidence of a report.
    const validation = validatePng(result.bytes);
    if (!validation.ok) {
      throw new RenderError("OUTPUT_INVALID", `Rendered output rejected: ${validation.reason}`);
    }

    const path = reportAssetPath({
      clinicId: asset.clinicId,
      consultationVersionId: asset.consultationVersionId,
      assetId: asset.id,
      type: asset.type,
    });
    const stored = await putReportAsset({
      path,
      bytes: result.bytes,
      contentType: result.mimeType,
    });
    if (!stored.ok) {
      throw new RenderError("STORAGE_FAILED", `${stored.reason}: ${stored.detail}`);
    }

    const settled = await markReady(
      {
        assetId: asset.id,
        leaseId,
        storageBucket: stored.bucket,
        storagePath: stored.path,
        mimeType: result.mimeType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
      },
      prisma,
    );

    if (!settled) {
      // Our lease expired and somebody else owns the row. The object we just
      // wrote is at a path derived from the asset id, so it is not the
      // successor's path and cannot corrupt their result — it is simply an
      // orphan. Say so rather than reporting a success we did not record.
      logRenderEvent({
        event: "report_asset.render_lost",
        assetId: asset.id,
        clinicId: asset.clinicId,
        attempt: asset.attemptCount,
      });
      return { kind: "lost", assetId: asset.id };
    }

    const durationMs = Date.now() - startedAt;
    logRenderEvent({
      event: "report_asset.rendered",
      assetId: asset.id,
      clinicId: asset.clinicId,
      attempt: asset.attemptCount,
      durationMs,
      environment: result.environment,
      timings: result.timings,
      byteSize: stored.byteSize,
    });

    await writeAuditLog({
      action: "REPORT_ASSET_RENDERED",
      entityType: "ReportAsset",
      entityId: asset.id,
      actorType: "system",
      assessmentId: asset.assessmentId,
      clinicId: asset.clinicId,
      metadata: {
        type: asset.type,
        consultationVersionId: asset.consultationVersionId,
        contentVersion: asset.contentVersion,
        templateVersion: asset.templateVersion,
        rendererVersion: asset.rendererVersion,
        // Identity of the bytes, so an audit reader can prove which artefact a
        // delivery carried. Not the bytes, and nothing from inside them.
        sha256: stored.sha256,
        byteSize: stored.byteSize,
        attempt: asset.attemptCount,
        durationMs,
      },
    }).catch(() => undefined);

    return {
      kind: "rendered",
      assetId: asset.id,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      durationMs,
    };
  } catch (err) {
    const { code, detail } = classifyRenderError(err);
    const permanent = isPermanentFailure(code);
    const { terminal } = await markAttemptFailed(
      { assetId: asset.id, leaseId, code, detail, permanent, now: now() },
      prisma,
    );

    logRenderEvent({
      event: "report_asset.render_failed",
      assetId: asset.id,
      clinicId: asset.clinicId,
      attempt: asset.attemptCount,
      code,
      permanent,
      terminal,
      durationMs: Date.now() - startedAt,
    });

    if (terminal) {
      await writeAuditLog({
        action: "REPORT_ASSET_FAILED",
        entityType: "ReportAsset",
        entityId: asset.id,
        actorType: "system",
        assessmentId: asset.assessmentId,
        clinicId: asset.clinicId,
        metadata: {
          type: asset.type,
          consultationVersionId: asset.consultationVersionId,
          errorCode: code,
          permanent,
          attempts: asset.attemptCount,
          maxAttempts: MAX_RENDER_ATTEMPTS,
        },
      }).catch(() => undefined);
    }

    return { kind: "failed", assetId: asset.id, code, terminal, attempt: asset.attemptCount };
  }
}

/**
 * Drain up to `limit` due artefacts, stopping early when there is no work.
 *
 * The bound exists because this runs inside an HTTP invocation with a wall
 * clock: an unbounded drain is a request that gets killed halfway, which is
 * survivable (leases expire) but pointlessly wasteful.
 */
export async function renderDueBatch(
  limit = 3,
  deps: RenderServiceDeps = {},
): Promise<RenderOutcome[]> {
  const outcomes: RenderOutcome[] = [];
  for (let i = 0; i < limit; i += 1) {
    const outcome = await renderNextDue(deps);
    outcomes.push(outcome);
    if (outcome.kind === "idle") break;
  }
  return outcomes;
}

/**
 * Single-line JSON, greppable in Vercel logs and parseable by whatever reads
 * them later. Deliberately carries no patient identifiers and no report
 * content — an operational log is read by people who have no clinical reason
 * to see either.
 */
function logRenderEvent(fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ns: "report-asset", ...fields }));
}
