// The patient's one-pager, preserved as it was at the moment of approval.
//
// ── Why a snapshot exists at all ────────────────────────────────────────────
// The one-pager has always been computed on demand: `/reports/[id]/one-page`
// composes it from the NARRATIVES artifact on every request, and the PDF/PNG
// routes print that page with a headless browser. Nothing was ever kept.
//
// That is fine for a preview and wrong for a clinical record. Approving a
// consultation is what releases this sheet to a patient, and what was released
// has to remain answerable later: which kits, which sequence, whose signature,
// on what date. Recomputing it tomorrow does not answer that question — it
// answers "what would we produce today", which is a different thing the moment
// the copy, the kit registry, or the composer changes.
//
// ── Why JSON and not the PDF ────────────────────────────────────────────────
// The PDF and PNG routes need Playwright plus browser binaries. Those exist on
// a developer machine; they are not installed by the Vercel build (see
// vercel.json's installCommand), so on the deployed app that path answers
// `playwright_missing`. Persisting "the PDF" there would persist nothing.
//
// The view model is the actual record — every word, number and asset reference
// the sheet renders from — and it needs no browser. A PDF can be regenerated
// from it deterministically whenever one is wanted, which is the right way
// round: the document is derived from the record, not the record from the
// document.
//
// ── Why no migration ────────────────────────────────────────────────────────
// The object is addressed by a path computed from facts we already hold —
// assessment id and the approved contentVersion — so nothing new has to be
// recorded to find it again. No column, no table, no ArtifactType enum value,
// therefore no schema change.
//
//   one-pagers/{assessmentId}/v{contentVersion}.json
//
// The version in the path is what makes it immutable in practice: a revised
// consultation approves as a new contentVersion and writes beside its
// predecessor rather than over it.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  composeOnePageReportViewModel,
  ReportAccessError,
} from "@/lib/reports/one-page/loadReport";
import type { OnePageReportViewModel } from "@/lib/reports/one-page/viewModel";

/**
 * Private bucket. A one-pager names a patient, their diagnosis and their
 * treatment, so it follows `clinical-images` (private, signed URLs) and not
 * `doctor-avatars` (public).
 *
 * NOTE: this bucket must exist in whichever Supabase project is canonical. It
 * is deliberately not created from application code — see docs/one-pager-
 * snapshot-storage.md.
 */
export const ONE_PAGER_BUCKET = "one-pagers";

/** Where one assessment's approved sheet lives, for a given version. */
export function onePagerSnapshotPath(
  assessmentId: string,
  contentVersion: number,
): string {
  return `${assessmentId}/v${contentVersion}.json`;
}

/** What the snapshot file contains. */
export interface OnePagerSnapshot {
  /** Schema of this envelope, not of the report inside it. */
  snapshotVersion: 1;
  assessmentId: string;
  /** The approved ConsultationVersion this sheet belongs to. */
  contentVersion: number;
  /** When the snapshot was written — not when the report was composed. */
  capturedAt: string;
  /** Who approved, as recorded on the consultation. */
  approvedBy: string | null;
  /** The complete view model the page renders from. */
  report: OnePageReportViewModel;
}

export type SnapshotResult =
  | { ok: true; path: string; bytes: number }
  | { ok: false; reason: SnapshotFailure; detail: string };

/**
 * Why a snapshot could not be written. Named rather than boolean because the
 * three cases want different responses: a missing bucket is a deployment step
 * somebody still has to do, an unready report is a wait, and an upload error
 * is worth alerting on.
 */
export type SnapshotFailure =
  | "not_configured"
  | "bucket_missing"
  | "report_not_ready"
  | "forbidden"
  | "upload_failed";

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Capture the one-pager for an approved consultation.
 *
 * **Never throws.** This runs immediately after a clinical approval has
 * committed. The approval, the kit order and the assessment mirror are already
 * durable by the time we get here, and none of them may be undone because an
 * object store was unreachable — a doctor who approved a case has approved it.
 * Every failure comes back described so the caller can log it and move on.
 *
 * Deliberately outside the approval transaction: a network round trip to
 * Storage inside an open Postgres transaction holds a connection for the
 * duration of an HTTP call, and on a pooled connection that is how you turn a
 * slow bucket into a database outage.
 */
export async function saveOnePagerSnapshot(input: {
  assessmentId: string;
  clinicId: string;
  contentVersion: number;
  approvedBy?: string | null;
}): Promise<SnapshotResult> {
  const supabase = serviceClient();
  if (!supabase) {
    return {
      ok: false,
      reason: "not_configured",
      detail: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is unset",
    };
  }

  let report: OnePageReportViewModel;
  try {
    // The tenant check still runs — `server_internal` carries the clinic the
    // approval path acted for, and the loader refuses a mismatch.
    report = await composeOnePageReportViewModel(input.assessmentId, {
      kind: "server_internal",
      clinicId: input.clinicId,
    });
  } catch (err) {
    if (err instanceof ReportAccessError) {
      // 202 — the narrative has not been composed yet, so there is no sheet to
      // preserve. Not a fault: a case can be approved before the pipeline has
      // finished writing NARRATIVES, and the retry path will catch it later.
      if (err.status === 202) {
        return { ok: false, reason: "report_not_ready", detail: err.message };
      }
      if (err.status === 403) {
        return { ok: false, reason: "forbidden", detail: err.message };
      }
    }
    return {
      ok: false,
      reason: "upload_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const snapshot: OnePagerSnapshot = {
    snapshotVersion: 1,
    assessmentId: input.assessmentId,
    contentVersion: input.contentVersion,
    capturedAt: new Date().toISOString(),
    approvedBy: input.approvedBy ?? null,
    report,
  };

  const path = onePagerSnapshotPath(input.assessmentId, input.contentVersion);
  const body = JSON.stringify(snapshot);

  const { error } = await supabase.storage
    .from(ONE_PAGER_BUCKET)
    .upload(path, body, {
      contentType: "application/json",
      // An approved version's sheet is written once and never rewritten. If a
      // retry finds the object already there, the first write is the record.
      upsert: false,
    });

  if (error) {
    const message = error.message ?? String(error);
    // Distinguish "somebody has not created the bucket yet" from a genuine
    // failure: the first is a one-time deployment step, the second is an
    // incident. Supabase answers the former with a 404 Bucket not found.
    if (/bucket not found/i.test(message)) {
      return {
        ok: false,
        reason: "bucket_missing",
        detail: `Create the private "${ONE_PAGER_BUCKET}" bucket — see docs/one-pager-snapshot-storage.md`,
      };
    }
    // A duplicate means a previous run already preserved this version. The
    // record exists, which is the outcome we wanted.
    if (/(duplicate|already exists|resource already exists)/i.test(message)) {
      return { ok: true, path, bytes: body.length };
    }
    return { ok: false, reason: "upload_failed", detail: message };
  }

  return { ok: true, path, bytes: body.length };
}

/**
 * A time-limited URL for a stored snapshot, or null when there is none.
 *
 * The bucket is private, so this is the only way to hand the object to a
 * browser. Callers must have authorised the reader themselves — this function
 * checks nothing.
 */
export async function signOnePagerSnapshot(
  assessmentId: string,
  contentVersion: number,
  expiresInSeconds = 60 * 10,
): Promise<string | null> {
  const supabase = serviceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(ONE_PAGER_BUCKET)
    .createSignedUrl(onePagerSnapshotPath(assessmentId, contentVersion), expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Read a stored snapshot back. Returns null when the object is absent, which
 * is the ordinary answer for anything approved before this existed.
 */
export async function readOnePagerSnapshot(
  assessmentId: string,
  contentVersion: number,
): Promise<OnePagerSnapshot | null> {
  const supabase = serviceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(ONE_PAGER_BUCKET)
    .download(onePagerSnapshotPath(assessmentId, contentVersion));
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as OnePagerSnapshot;
  } catch {
    return null;
  }
}
