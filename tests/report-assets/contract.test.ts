import { describe, it, expect } from "vitest";

// The policy decisions of the render pipeline, tested without a browser, a
// database or an object store — because they ARE the decisions, and every one
// of them is a place where getting it wrong is invisible until a clinic
// notices that patients are not getting their one-pagers.

import {
  MAX_RENDER_ATTEMPTS,
  ONE_PAGER_RENDERER_VERSION,
  ONE_PAGER_TEMPLATE_VERSION,
  RETRY_BACKOFF_MS,
  RenderError,
  classifyRenderError,
  isPermanentFailure,
  nextAttemptAfter,
  onePagerPngKey,
  redact,
  renderKeyLabel,
  reportAssetPath,
  validatePng,
  MIN_PNG_BYTES,
} from "@/lib/reports/assets/contract";

describe("render key (idempotency)", () => {
  it("is the four facts that decide whether two requests mean the same artefact", () => {
    const key = onePagerPngKey("cv_1");
    expect(key).toEqual({
      consultationVersionId: "cv_1",
      type: "ONE_PAGER_PNG",
      templateVersion: ONE_PAGER_TEMPLATE_VERSION,
      rendererVersion: ONE_PAGER_RENDERER_VERSION,
    });
  });

  it("separates two versions of the same consultation", () => {
    // The whole point of PHASE 22: approving a revision must not overwrite the
    // artefact the previous version released.
    expect(renderKeyLabel(onePagerPngKey("cv_1"))).not.toBe(
      renderKeyLabel(onePagerPngKey("cv_2")),
    );
  });

  it("separates two template versions of the same approved version", () => {
    const v1 = renderKeyLabel(onePagerPngKey("cv_1"));
    const v2 = renderKeyLabel({
      ...onePagerPngKey("cv_1"),
      templateVersion: "hair-one-pager-v2",
    });
    expect(v1).not.toBe(v2);
  });
});

describe("retry policy", () => {
  it("spends its whole budget inside about six minutes", () => {
    // 0s + 15s + 60s + 300s = 6m15s from first attempt to giving up.
    const total = RETRY_BACKOFF_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(7 * 60_000);
    expect(total).toBeGreaterThan(5 * 60_000);
    expect(RETRY_BACKOFF_MS[0]).toBe(0); // first attempt is immediate
  });

  it("schedules each attempt further out than the last", () => {
    for (let i = 1; i < RETRY_BACKOFF_MS.length; i += 1) {
      expect(RETRY_BACKOFF_MS[i]).toBeGreaterThan(RETRY_BACKOFF_MS[i - 1]);
    }
  });

  it("is bounded — the budget runs out rather than retrying forever", () => {
    const now = new Date("2026-09-07T10:00:00Z");
    expect(nextAttemptAfter(MAX_RENDER_ATTEMPTS, now)).toBeNull();
    expect(nextAttemptAfter(MAX_RENDER_ATTEMPTS + 5, now)).toBeNull();
  });

  it("returns a future instant while budget remains", () => {
    const now = new Date("2026-09-07T10:00:00Z");
    const next = nextAttemptAfter(1, now);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("failure classification", () => {
  it("never retries a failure a retry cannot fix", () => {
    // These three describe the INPUT being wrong. Retrying reads the same
    // wrong input and burns the budget that a genuinely transient failure
    // would have needed.
    expect(isPermanentFailure("SOURCE_NOT_APPROVED")).toBe(true);
    expect(isPermanentFailure("SNAPSHOT_INVALID")).toBe(true);
    expect(isPermanentFailure("AUTH_FAILED")).toBe(true);
  });

  it("retries the failures that resolve on their own", () => {
    expect(isPermanentFailure("BROWSER_LAUNCH_FAILED")).toBe(false);
    expect(isPermanentFailure("RENDER_TIMEOUT")).toBe(false);
    expect(isPermanentFailure("STORAGE_FAILED")).toBe(false);
    // A case can be approved before the pipeline has written its narrative.
    expect(isPermanentFailure("REPORT_NOT_READY")).toBe(false);
  });

  it("keeps a classified error's own code", () => {
    const err = new RenderError("STORAGE_FAILED", "bucket unreachable");
    expect(classifyRenderError(err).code).toBe("STORAGE_FAILED");
    expect(err.permanent).toBe(false);
  });

  it("classifies unlabelled browser and timeout failures rather than shrugging", () => {
    expect(classifyRenderError(new Error("Timeout 30000ms exceeded")).code).toBe(
      "RENDER_TIMEOUT",
    );
    expect(
      classifyRenderError(new Error("Failed to launch chromium: no executable")).code,
    ).toBe("BROWSER_LAUNCH_FAILED");
    expect(classifyRenderError(new Error("something else entirely")).code).toBe(
      "UNKNOWN_RENDER_ERROR",
    );
  });
});

describe("redaction of persisted errors", () => {
  // `lastError` is read by operators in a dashboard. A render token or a
  // service key that reaches it is a credential in a log aggregator.
  it("strips credential-shaped query parameters", () => {
    expect(redact("failed at /x?token=abc123&y=1")).toContain("token=[redacted]");
    expect(redact("failed at /x?token=abc123&y=1")).not.toContain("abc123");
  });

  it("strips JWT-shaped strings", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9payload";
    expect(redact(`auth failed with ${jwt}`)).not.toContain(jwt);
  });

  it("bounds the length so one error cannot fill a column", () => {
    expect(redact("x".repeat(5000)).length).toBeLessThanOrEqual(500);
  });
});

describe("PNG validation", () => {
  function png(width: number, height: number, padTo = MIN_PNG_BYTES + 1): Uint8Array {
    const buf = Buffer.alloc(padTo);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
    buf.writeUInt32BE(13, 8);
    buf.write("IHDR", 12, "ascii");
    buf.writeUInt32BE(width, 16);
    buf.writeUInt32BE(height, 20);
    return new Uint8Array(buf);
  }

  it("accepts a landscape A4 sheet", () => {
    const result = validatePng(png(2246, 1588));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.width).toBe(2246);
      expect(result.height).toBe(1588);
    }
  });

  it("rejects an empty buffer — Playwright returning bytes is not evidence", () => {
    expect(validatePng(new Uint8Array(0))).toMatchObject({ ok: false });
  });

  it("rejects something that is not a PNG at all", () => {
    const notPng = new Uint8Array(Buffer.alloc(MIN_PNG_BYTES + 1, 0x41));
    expect(validatePng(notPng)).toMatchObject({ ok: false });
  });

  it("rejects a PNG with a collapsed viewport", () => {
    // A page that rendered before layout settled screenshots as a sliver, and
    // a sliver is a perfectly valid PNG.
    expect(validatePng(png(4, 4))).toMatchObject({ ok: false });
  });

  it("rejects a truncated stream even with a correct signature", () => {
    const tiny = png(2246, 1588, 64);
    expect(validatePng(tiny)).toMatchObject({ ok: false });
  });
});

describe("storage layout", () => {
  const path = reportAssetPath({
    clinicId: "clinic_1",
    consultationVersionId: "cv_9",
    assetId: "asset_7",
    type: "ONE_PAGER_PNG",
  });

  it("is tenant-first and version-scoped", () => {
    expect(path).toBe("clinic/clinic_1/consultation/cv_9/one-pager/asset_7.png");
  });

  it("names the object by asset id, so a re-render never overwrites its predecessor", () => {
    const retry = reportAssetPath({
      clinicId: "clinic_1",
      consultationVersionId: "cv_9",
      assetId: "asset_8",
      type: "ONE_PAGER_PNG",
    });
    expect(retry).not.toBe(path);
  });

  it("carries nothing that identifies a patient", () => {
    // Object paths are quoted in logs, support tickets and signed URLs.
    expect(path).not.toMatch(/patient/i);
    expect(path.split("/").every((segment) => !segment.includes(" "))).toBe(true);
  });
});
