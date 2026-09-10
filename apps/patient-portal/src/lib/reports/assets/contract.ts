// The report-asset pipeline's vocabulary: what an artefact is, what version of
// what produced it, how a failure is classified, and when a failed attempt may
// be tried again.
//
// Everything here is deliberately free of Prisma, Supabase and Playwright, so
// the policy decisions below can be read — and tested — without standing any of
// them up.

import type { ReportAssetStatus, ReportAssetType } from "@prisma/client";

export type { ReportAssetStatus, ReportAssetType };

// ── Versioning (PHASE 21) ───────────────────────────────────────────────────

/**
 * The one-pager DESIGN this pipeline renders.
 *
 * Bump this when a change to the sheet alters what it SAYS or how a clinician
 * would read it — a new section, a reordered protocol, different copy. Do not
 * bump it for a fix that makes the page render what it always meant to.
 *
 * Bumping produces a new render key, therefore a NEW ReportAsset row and a new
 * storage object. Historical assets keep pointing at the bytes they were
 * produced from: a React component changing tomorrow cannot retroactively
 * alter what a patient was handed last month.
 */
export const ONE_PAGER_TEMPLATE_VERSION = "hair-one-pager-v1";

/**
 * The rendering STACK — browser, viewport, capture pipeline.
 *
 * Separate from the template version because the two change for different
 * reasons, and an operator triaging "why does this asset look different" needs
 * to know which one moved.
 */
export const ONE_PAGER_RENDERER_VERSION = "chromium-png-v1";

/** Landscape A4 at 96dpi — the production one-pager is landscape-only. */
export const ONE_PAGER_VIEWPORT = { width: 1123, height: 794 } as const;

/**
 * The marker the render target sets once the sheet is genuinely finished.
 * See PHASE 9: readiness is asserted by the page, never guessed by a timer.
 */
export const ONE_PAGER_READY_ATTRIBUTE = "data-one-pager-ready";

/** The element the renderer screenshots. Already present on the report root. */
export const ONE_PAGER_ROOT_SELECTOR = "[data-one-page-report]";

// ── The render key (PHASE 4) ────────────────────────────────────────────────

export interface RenderKey {
  consultationVersionId: string;
  type: ReportAssetType;
  templateVersion: string;
  rendererVersion: string;
}

/**
 * The render key as a single string, for logs and metrics only.
 *
 * Idempotency itself is enforced by the composite UNIQUE index on
 * (consultationVersionId, type, templateVersion, rendererVersion) — never by
 * comparing these strings in application code, which loses every race it is
 * asked to win.
 */
export function renderKeyLabel(key: RenderKey): string {
  return `${key.consultationVersionId}:${key.type}:${key.templateVersion}:${key.rendererVersion}`;
}

/** The render key for the one-pager PNG of a given approved version. */
export function onePagerPngKey(consultationVersionId: string): RenderKey {
  return {
    consultationVersionId,
    type: "ONE_PAGER_PNG",
    templateVersion: ONE_PAGER_TEMPLATE_VERSION,
    rendererVersion: ONE_PAGER_RENDERER_VERSION,
  };
}

// ── Failure classification (PHASE 13) ───────────────────────────────────────

/**
 * Why a render failed, in terms the retry policy and an operator both
 * understand. Never a raw exception message: a message is evidence, a code is
 * a decision.
 */
export type RenderErrorCode =
  | "BROWSER_LAUNCH_FAILED"
  | "RENDER_TIMEOUT"
  | "REPORT_NOT_READY"
  | "SNAPSHOT_INVALID"
  | "STORAGE_FAILED"
  | "OUTPUT_INVALID"
  | "AUTH_FAILED"
  | "SOURCE_NOT_APPROVED"
  | "UNKNOWN_RENDER_ERROR";

/**
 * Failures that will never succeed on a retry, so retrying them only burns the
 * budget and hides the real problem behind an attempt count.
 *
 *   SOURCE_NOT_APPROVED  the version is not approved, or no longer is. No
 *                        amount of waiting makes a draft approved.
 *   SNAPSHOT_INVALID     the preserved sheet is absent or malformed — the
 *                        input itself is broken, and a re-render reads the
 *                        same broken input.
 *   AUTH_FAILED          an authorisation invariant was violated. Retrying an
 *                        access the system just refused is not a recovery
 *                        strategy.
 *
 * Everything else is transient. REPORT_NOT_READY is deliberately transient: a
 * case can be approved before the pipeline has finished writing NARRATIVES,
 * and that resolves on its own.
 */
const PERMANENT: ReadonlySet<RenderErrorCode> = new Set<RenderErrorCode>([
  "SOURCE_NOT_APPROVED",
  "SNAPSHOT_INVALID",
  "AUTH_FAILED",
]);

export function isPermanentFailure(code: RenderErrorCode): boolean {
  return PERMANENT.has(code);
}

/** A classified render failure. Thrown inside the renderer, caught by the service. */
export class RenderError extends Error {
  constructor(
    readonly code: RenderErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RenderError";
  }

  get permanent(): boolean {
    return isPermanentFailure(this.code);
  }
}

/**
 * Reduce an arbitrary thrown value to a classified failure.
 *
 * The message is truncated and never includes the original stack: `lastError`
 * is read by operators in a dashboard, and a stack trace from a Chromium
 * launch can contain the executable path, environment fragments and, in the
 * worst case, page content.
 */
export function classifyRenderError(err: unknown): { code: RenderErrorCode; detail: string } {
  if (err instanceof RenderError) {
    return { code: err.code, detail: redact(err.message) };
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/timeout|timed out/i.test(message)) {
    return { code: "RENDER_TIMEOUT", detail: redact(message) };
  }
  if (/executable|browser|launch|chromium/i.test(message)) {
    return { code: "BROWSER_LAUNCH_FAILED", detail: redact(message) };
  }
  return { code: "UNKNOWN_RENDER_ERROR", detail: redact(message) };
}

/**
 * Strip anything that looks like a credential before a message is persisted.
 *
 * Belt and braces: no call site is supposed to put a token in an error, and
 * this is what makes that true rather than intended.
 */
export function redact(message: string): string {
  return message
    .replace(/(token|secret|key|cookie|authorization)=[^\s&"']+/gi, "$1=[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}/g, "[redacted-jwt]")
    .slice(0, 500);
}

// ── Retry policy (PHASE 13) ─────────────────────────────────────────────────

/**
 * Backoff before the next attempt, indexed by attempts already made.
 *
 *   attempt 1 → immediately
 *   attempt 2 → ~15s
 *   attempt 3 → ~1m
 *   attempt 4 → ~5m
 *   then      → FAILED
 *
 * Bounded on purpose. An artefact that has failed four times across the six
 * and a quarter minutes those delays add up to is not going to succeed on the
 * fifth; what it needs is an operator, and the FAILED row plus the alert
 * threshold is how it gets one.
 */
export const RETRY_BACKOFF_MS: readonly number[] = [0, 15_000, 60_000, 300_000];

export const MAX_RENDER_ATTEMPTS = RETRY_BACKOFF_MS.length;

/**
 * When a row that has made `attemptCount` attempts becomes claimable again, or
 * null when the budget is spent and the row must go to FAILED.
 */
export function nextAttemptAfter(attemptCount: number, now: Date = new Date()): Date | null {
  if (attemptCount >= MAX_RENDER_ATTEMPTS) return null;
  const delay = RETRY_BACKOFF_MS[attemptCount] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
  return new Date(now.getTime() + delay);
}

// ── Leases (PHASE 20) ───────────────────────────────────────────────────────

/**
 * How long a worker's claim on a row is honoured.
 *
 * Longer than the render budget so a healthy worker is never overtaken
 * mid-render, short enough that a worker killed by a serverless timeout does
 * not strand its row until somebody notices. A reclaimed row is not corrupted:
 * the successor writes to a path derived from the asset id, and a loser's
 * result write is refused because its lease id no longer matches.
 */
export const RENDER_LEASE_MS = 120_000;

/** Hard ceiling on one render, including browser launch and page load. */
export const RENDER_TIMEOUT_MS = 60_000;

// ── Output validation (PHASE 12) ────────────────────────────────────────────

/**
 * Below this, the bytes are not a report. A landscape A4 PNG of a populated
 * sheet is tens of kilobytes at minimum; anything smaller is a blank canvas, a
 * truncated stream, or an error page that happened to encode.
 */
export const MIN_PNG_BYTES = 4 * 1024;

/**
 * Meta's media ceiling is 5 MB and the transport rejects anything larger, so
 * there is no point storing an artefact that could never be delivered.
 */
export const MAX_PNG_BYTES = 5 * 1024 * 1024;

// ── Storage layout (PHASE 11) ───────────────────────────────────────────────

/**
 * Private bucket for rendered clinical artefacts.
 *
 * Separate from `one-pagers` (the JSON snapshot) because the two have
 * different content types, size ceilings and readers; separate from
 * `clinical-reports` because that bucket accepts PDFs only. Provisioned by
 * scripts/provision-storage.ts — never created from application code.
 */
export const REPORT_ASSET_BUCKET = "report-assets";

/**
 * Where one rendered artefact lives.
 *
 * Tenant-first so a listing is navigable per clinic, version-scoped so a
 * revision writes beside its predecessor, and named by ASSET ID rather than by
 * anything about the patient — an object path is quoted in logs, support
 * tickets and signed URLs, and none of those should carry a person's name.
 */
export function reportAssetPath(input: {
  clinicId: string;
  consultationVersionId: string;
  assetId: string;
  type: ReportAssetType;
}): string {
  const folder = input.type === "ONE_PAGER_PNG" ? "one-pager" : input.type.toLowerCase();
  const extension = input.type.endsWith("_PNG") ? "png" : "pdf";
  return `clinic/${input.clinicId}/consultation/${input.consultationVersionId}/${folder}/${input.assetId}.${extension}`;
}

// ── PNG validation (PHASE 12) ───────────────────────────────────────────────

/** The 8-byte PNG signature every valid PNG starts with. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type PngValidation =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: string };

/**
 * Decide whether these bytes are a usable clinical artefact.
 *
 * Playwright returning a Buffer is not evidence of anything: a page that
 * rendered blank, a viewport that collapsed to zero, and a truncated write all
 * produce a Buffer. This reads the PNG signature and the IHDR chunk, which is
 * what actually distinguishes an image from bytes.
 */
export function validatePng(bytes: Uint8Array): PngValidation {
  if (bytes.byteLength < MIN_PNG_BYTES) {
    return { ok: false, reason: `too small: ${bytes.byteLength} bytes` };
  }
  if (bytes.byteLength > MAX_PNG_BYTES) {
    return { ok: false, reason: `too large: ${bytes.byteLength} bytes` };
  }
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ok: false, reason: "not a PNG (signature mismatch)" };
  }
  // IHDR is required to be the first chunk: 4-byte length, "IHDR", then width
  // and height as big-endian uint32.
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") {
    return { ok: false, reason: "malformed PNG (missing IHDR)" };
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width < 100 || height < 100) {
    return { ok: false, reason: `implausible dimensions: ${width}x${height}` };
  }
  return { ok: true, width, height };
}
