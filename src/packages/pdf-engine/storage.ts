import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = 'clinical-reports';

/**
 * Store a rendered report PDF and return its BUCKET-RELATIVE OBJECT PATH.
 *
 * ── Why a path and not a URL ────────────────────────────────────────────────
 * This used to return
 *   `${supabaseUrl}/storage/v1/object/public/clinical-reports/${path}`
 * which only resolves while the bucket is PUBLIC. `clinical-reports` holds
 * patients' clinical PDFs, so the bucket is now private and that URL would be
 * a permanent, unauthenticated link to a medical record.
 *
 * A path is also the right thing to persist: a signed URL expires, so storing
 * one in the REPORT artifact would produce a row that silently rots. Callers
 * that need to hand a URL to a browser mint one at read time with
 * `signReportUrl` below.
 *
 * `filename` deliberately carries NO patient identity — see the caller.
 */
export async function uploadReportToSupabase(buffer: Buffer, assessmentId: string, filename: string): Promise<string> {
  const path = `reports/${assessmentId}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true,
      // A regenerated PDF (dossier template fix, re-run) must not be served
      // from cache. Signed URLs are per-request anyway, but this keeps any
      // intermediary from holding a stale clinical document.
      cacheControl: '0',
    });

  if (error) {
    console.error(`[PDF Storage] Supabase upload failed for ${filename}:`, error);
    throw new Error(`Failed to store PDF artifact: ${error.message}`);
  }

  return path;
}

/**
 * Mint a short-lived signed URL for a stored report.
 *
 * The only supported way to give a browser access to a clinical PDF. Default
 * TTL is deliberately short — long enough for a doctor to open or download the
 * document, short enough that a URL copied out of a log or a chat is dead by
 * the time anyone else tries it.
 */
export async function signReportUrl(
  path: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error(`[PDF Storage] Failed to sign ${path}:`, error);
    return null;
  }
  return data?.signedUrl ?? null;
}
