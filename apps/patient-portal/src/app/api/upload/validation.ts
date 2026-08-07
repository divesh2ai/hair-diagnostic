// Server-side validation helpers for POST /api/upload. Kept pure so they can
// be unit-tested without spinning up the Next.js request pipeline.

export const ALLOWED_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const MAX_FILENAME_LENGTH = 128;

/**
 * Normalize a user-supplied filename to something safe to embed in a Supabase
 * storage path. Returns null when the input is unsalvageable (traversal
 * attempt, control chars, empty, or leading dot). Callers must treat null as
 * an outright rejection — do NOT fall through to a default name; the raw
 * input is untrusted.
 */
export function sanitizeFileName(input: string): string | null {
  const leaf = input.split(/[/\\]/).pop() ?? "";
  if (!leaf || leaf === "." || leaf === "..") return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(leaf)) return null;
  const cleaned = leaf.replace(/[^A-Za-z0-9._-]/g, "_");
  if (
    cleaned.startsWith(".") ||
    cleaned.length === 0 ||
    cleaned.length > MAX_FILENAME_LENGTH
  ) {
    return null;
  }
  return cleaned;
}

export function isValidUploadSessionId(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

export function isUploadSizeAllowed(size: number): boolean {
  return Number.isInteger(size) && size > 0 && size <= MAX_UPLOAD_BYTES;
}