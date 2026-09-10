// Private object storage for rendered clinical artefacts.
//
// One narrow surface — put bytes, get bytes, sign a short-lived URL — so the
// render service never holds a Supabase client and never decides a bucket
// policy. The bucket is PRIVATE and is provisioned by
// scripts/provision-storage.ts; nothing here creates it, because application
// code that can create a bucket is application code that can create a public
// one.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { REPORT_ASSET_BUCKET } from "./contract";

export type StoragePutResult =
  | { ok: true; bucket: string; path: string; byteSize: number; sha256: string }
  | { ok: false; reason: StorageFailure; detail: string };

/**
 * Why a store failed. Named rather than boolean because the responses differ:
 * an unconfigured environment is a deployment step, a missing bucket is a
 * one-time provisioning step, and an upload error is worth alerting on.
 */
export type StorageFailure = "not_configured" | "bucket_missing" | "upload_failed";

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Integrity of the exact bytes stored. Copied onto the asset row and, at send
 * time, onto the delivery record — so a later re-render cannot change what a
 * historical delivery means. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Store one artefact.
 *
 * `upsert: false` on purpose. Paths contain the asset id, so a collision means
 * something is wrong — two workers writing the same asset, or a retry that
 * reused an id it should not have. Overwriting would hide that, and would also
 * be the one operation capable of changing an approved clinical artefact after
 * the fact.
 */
export async function putReportAsset(input: {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<StoragePutResult> {
  const supabase = serviceClient();
  if (!supabase) {
    return {
      ok: false,
      reason: "not_configured",
      detail: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is unset",
    };
  }

  const { error } = await supabase.storage
    .from(REPORT_ASSET_BUCKET)
    .upload(input.path, Buffer.from(input.bytes), {
      contentType: input.contentType,
      upsert: false,
    });

  if (error) {
    const message = error.message ?? String(error);
    if (/bucket not found/i.test(message)) {
      return {
        ok: false,
        reason: "bucket_missing",
        detail: `Create the private "${REPORT_ASSET_BUCKET}" bucket — npx tsx scripts/provision-storage.ts`,
      };
    }
    // A duplicate means these exact bytes are already at this exact path,
    // which is the outcome we wanted. Treated as success so a retry that
    // crashed between the upload and the READY write converges instead of
    // failing forever.
    if (/(duplicate|already exists|resource already exists)/i.test(message)) {
      return {
        ok: true,
        bucket: REPORT_ASSET_BUCKET,
        path: input.path,
        byteSize: input.bytes.byteLength,
        sha256: sha256Hex(input.bytes),
      };
    }
    return { ok: false, reason: "upload_failed", detail: message };
  }

  return {
    ok: true,
    bucket: REPORT_ASSET_BUCKET,
    path: input.path,
    byteSize: input.bytes.byteLength,
    sha256: sha256Hex(input.bytes),
  };
}

/**
 * Read an artefact back. Null when absent.
 *
 * Checks nothing: the caller must have authorised the reader itself. This is
 * fetched with the service-role key and therefore bypasses every policy the
 * database would otherwise apply.
 */
export async function getReportAsset(
  bucket: string,
  path: string,
): Promise<Uint8Array | null> {
  const supabase = serviceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * A time-limited URL for one stored artefact.
 *
 * Ten minutes, and never longer: this is a clinical artefact, and a signed URL
 * is a bearer credential that cannot be revoked once issued. Long-lived signed
 * URLs are how a private bucket becomes a public one without anybody deciding
 * to make it public.
 */
export async function signReportAsset(
  bucket: string,
  path: string,
  expiresInSeconds = 600,
): Promise<string | null> {
  const supabase = serviceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, Math.min(expiresInSeconds, 600));
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Whether object storage is configured at all. Used by health reporting. */
export function isStorageConfigured(): boolean {
  return serviceClient() !== null;
}
