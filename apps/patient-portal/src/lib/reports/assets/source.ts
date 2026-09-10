// Resolving what an asset is a render OF, and refusing to render anything else.
//
// ── Why the worker re-checks everything ─────────────────────────────────────
// The row that asked for this render was written by an authorised approval,
// minutes or hours ago. That is not a licence to render whatever the row now
// points at: a version can be moved out of APPROVED between the request and
// the render, and a row is a message from the past, not a standing permission.
// So the worker independently re-establishes, from the database, that the
// version is approved and that the tenant identifiers on the row still agree
// with the aggregate. An invariant that disagrees is AUTH_FAILED and is never
// retried.
//
// ── Why the snapshot and not the live consultation ──────────────────────────
// PHASE 2. The renderer must produce what the doctor approved, not what the
// composer would produce today. The immutable record of that is the one-pager
// snapshot written at approval — `one-pagers/{assessmentId}/v{n}.json` — which
// already exists and is already the system's answer to "what did we hand this
// patient?". Rendering anything else would make the picture and the record two
// different documents.

import type { PrismaClient, ReportAsset } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  readOnePagerSnapshot,
  saveOnePagerSnapshot,
  type OnePagerSnapshot,
} from "@/lib/reports/one-page/snapshot";
import { RenderError } from "./contract";

export interface RenderSource {
  asset: ReportAsset;
  snapshot: OnePagerSnapshot;
}

/**
 * Everything needed to render one artefact, or a classified refusal.
 *
 * Used by BOTH the worker (before launching a browser) and the render target
 * page (before rendering a sheet), so the two cannot disagree about whether an
 * artefact may be produced.
 */
export async function loadRenderSource(
  assetId: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<RenderSource> {
  const asset = await prisma.reportAsset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new RenderError("SNAPSHOT_INVALID", "No such report asset");
  }

  const version = await prisma.consultationVersion.findUnique({
    where: { id: asset.consultationVersionId },
    select: {
      id: true,
      contentVersion: true,
      approvalStatus: true,
      approvedBy: true,
      consultation: { select: { id: true, clinicId: true, assessmentId: true, patientId: true } },
    },
  });
  if (!version) {
    // The version this asset claims to be a render of does not exist. Not a
    // transient condition and not something a retry discovers differently.
    throw new RenderError("SNAPSHOT_INVALID", "Consultation version no longer exists");
  }

  if (String(version.approvalStatus) !== "APPROVED") {
    throw new RenderError(
      "SOURCE_NOT_APPROVED",
      `Consultation version is ${version.approvalStatus}, not APPROVED`,
    );
  }

  // ── Tenant invariants (PHASE 17) ──────────────────────────────────────────
  //
  // The row's denormalised identifiers must still agree with the aggregate.
  // Disagreement means either a bug that wrote a cross-tenant row or a row
  // that has been tampered with, and in both cases the correct response is to
  // render nothing and say so — never to trust the row because it is in our
  // own database.
  const c = version.consultation;
  if (
    c.clinicId !== asset.clinicId ||
    c.assessmentId !== asset.assessmentId ||
    c.id !== asset.consultationId ||
    version.contentVersion !== asset.contentVersion
  ) {
    throw new RenderError(
      "AUTH_FAILED",
      "Report asset does not agree with its consultation — refusing to render",
    );
  }

  const snapshot = await resolveSnapshot({
    assessmentId: asset.assessmentId,
    clinicId: asset.clinicId,
    contentVersion: asset.contentVersion,
    approvedBy: version.approvedBy,
  });

  return { asset, snapshot };
}

/**
 * The preserved sheet for this version, writing it first if it is absent.
 *
 * A snapshot can legitimately be missing: the approval path writes it outside
 * the transaction and never lets a storage failure undo an approval, so an
 * unreachable bucket at approval time leaves an approved version with no
 * preserved sheet. Rather than render live data — which would defeat the point
 * of having a snapshot at all — the worker writes the snapshot it needs and
 * then renders that. The record is created before the artefact, in that order,
 * always.
 */
async function resolveSnapshot(input: {
  assessmentId: string;
  clinicId: string;
  contentVersion: number;
  approvedBy: string | null;
}): Promise<OnePagerSnapshot> {
  const existing = await readOnePagerSnapshot(input.assessmentId, input.contentVersion);
  if (existing) return existing;

  const written = await saveOnePagerSnapshot({
    assessmentId: input.assessmentId,
    clinicId: input.clinicId,
    contentVersion: input.contentVersion,
    approvedBy: input.approvedBy,
  });

  if (!written.ok) {
    switch (written.reason) {
      case "report_not_ready":
        // The clinical pipeline has not finished composing the narrative. It
        // will; this is the one failure here that resolves on its own.
        throw new RenderError("REPORT_NOT_READY", "Narrative not composed yet");
      case "forbidden":
        throw new RenderError("AUTH_FAILED", "Snapshot writer refused the clinic scope");
      case "not_configured":
      case "bucket_missing":
      case "upload_failed":
        throw new RenderError("STORAGE_FAILED", `Snapshot could not be written: ${written.reason}`);
    }
  }

  const reread = await readOnePagerSnapshot(input.assessmentId, input.contentVersion);
  if (!reread) {
    throw new RenderError("STORAGE_FAILED", "Snapshot written but not readable back");
  }
  return reread;
}
