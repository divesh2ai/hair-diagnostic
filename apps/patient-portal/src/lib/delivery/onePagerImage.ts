// The one-page report as bytes, for attaching to a patient message.
//
// ── What changed, and why it had to ─────────────────────────────────────────
// This module used to render the picture: it HTTP-fetched the PNG route with
// the doctor's session cookie forwarded, which launched Chromium inside the
// Share request. Three things were wrong with that, in increasing order of
// seriousness.
//
//   1. It was slow. A cold browser launch is seconds of a doctor's time, spent
//      inside a click that should feel instant.
//   2. It could not work on the deployment it had to work on. Vercel's build
//      installs no browser binaries, so the route answered 501 and every
//      production share was link-only.
//   3. It rendered whatever the composer would produce AT SEND TIME, from the
//      live consultation, as whoever happened to press the button. That is not
//      the same document as the one the doctor approved, and on a revised
//      consultation it is provably a different one.
//
// So this no longer renders anything. It reads the artefact that was produced
// when the doctor approved, from private storage, by its recorded hash. If
// there isn't one, it says so and the caller sends the link — which is exactly
// the degradation that already existed and is deliberately preserved.

import type { ReportAsset } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOnePagerAsset } from "@/lib/reports/assets/jobService";
import { getReportAsset } from "@/lib/reports/assets/storage";
import { MAX_PNG_BYTES, validatePng } from "@/lib/reports/assets/contract";

export interface OnePagerImage {
  data: Uint8Array;
  mimeType: "image/png";
  filename: string;
  /** Provenance, copied onto the delivery record so the send is reconstructable. */
  assetId: string;
  sha256: string | null;
  templateVersion: string;
  consultationVersionId: string;
}

/**
 * Why no image travelled with a message.
 *
 * Named rather than a bare null because the doctor-facing copy and the
 * operator-facing alert want different things from it: "still being prepared"
 * is a wait, "rendering failed" is a ticket, and "not switched on here" is a
 * deployment step.
 */
export type OnePagerUnavailable =
  | "not_provisioned"
  | "not_requested"
  | "pending"
  | "failed"
  | "bytes_missing"
  | "bytes_invalid";

export type OnePagerLookup =
  | { ok: true; image: OnePagerImage }
  | { ok: false; reason: OnePagerUnavailable; assetId: string | null };

/**
 * The approved one-pager for an assessment's CURRENT approved version.
 *
 * Reads the ReportAsset row, and the bytes only if it is READY. Never renders,
 * never launches a browser, never enqueues — the caller decides whether to
 * ensure a job exists, because "somebody looked at this" is not by itself a
 * reason to start work.
 */
export async function loadApprovedOnePagerImage(
  assessmentId: string,
): Promise<OnePagerLookup> {
  const consultation = await prisma.consultation.findUnique({
    where: { assessmentId },
    select: { currentVersion: { select: { id: true, approvalStatus: true } } },
  });
  const version = consultation?.currentVersion;
  if (!version || String(version.approvalStatus) !== "APPROVED") {
    return { ok: false, reason: "not_requested", assetId: null };
  }

  // `findOnePagerAsset` is tolerant: on a deployment that has not applied
  // 20260907_report_asset_pipeline it answers null rather than throwing, so
  // sharing keeps working and simply carries no picture.
  const asset = await findOnePagerAsset(version.id);
  if (!asset) {
    return { ok: false, reason: "not_provisioned", assetId: null };
  }

  const unavailable = statusToReason(asset);
  if (unavailable) return { ok: false, reason: unavailable, assetId: asset.id };

  if (!asset.storageBucket || !asset.storagePath) {
    return { ok: false, reason: "bytes_missing", assetId: asset.id };
  }

  const data = await getReportAsset(asset.storageBucket, asset.storagePath);
  if (!data) {
    return { ok: false, reason: "bytes_missing", assetId: asset.id };
  }

  // Validated again on the way out. The bytes were checked before they were
  // stored, and re-checking here costs microseconds and is the difference
  // between "we believe storage returned our object" and "we know it did".
  if (data.byteLength > MAX_PNG_BYTES || !validatePng(data).ok) {
    return { ok: false, reason: "bytes_invalid", assetId: asset.id };
  }

  return {
    ok: true,
    image: {
      data,
      mimeType: "image/png",
      // The assessment id, not the patient's name. A filename is shown in the
      // chat, appears in the phone's gallery and survives forwarding, so it
      // must not identify the patient — unlike the clinic's own download,
      // which is named for the person holding it.
      filename: `hair-report-${assessmentId}.png`,
      assetId: asset.id,
      sha256: asset.sha256,
      templateVersion: asset.templateVersion,
      consultationVersionId: asset.consultationVersionId,
    },
  };
}

function statusToReason(asset: ReportAsset): OnePagerUnavailable | null {
  switch (asset.status) {
    case "READY":
      return null;
    case "FAILED":
      return "failed";
    case "PENDING":
    case "QUEUED":
    case "RENDERING":
      return "pending";
    default:
      return "pending";
  }
}
