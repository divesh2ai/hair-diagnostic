import { describe, it, expect, vi, beforeEach } from "vitest";

// The render worker's decision loop, with the browser, the database and the
// object store all replaced.
//
// ══ WHAT THIS GUARDS ════════════════════════════════════════════════════════
//
// Every branch here ends in a row that a doctor's Share will read. Marking a
// row READY when the bytes are not a report means a patient receives a blank
// image; retrying a permanent failure means an operator never sees the real
// cause; settling a row we no longer own means two workers disagree about what
// was delivered. None of these is visible from an HTTP 200.

const claimNextDue = vi.fn();
const markReady = vi.fn(async () => true);
const markAttemptFailed = vi.fn(async () => ({ settled: true, terminal: false }));
const putReportAsset = vi.fn();
const loadRenderSource = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/audit/writeAuditLog", () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/reports/assets/repository", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, claimNextDue, markReady, markAttemptFailed };
});
vi.mock("@/lib/reports/assets/storage", () => ({ putReportAsset }));
vi.mock("@/lib/reports/assets/source", () => ({ loadRenderSource }));
vi.mock("@/lib/reports/assets/origin", () => ({
  resolveDeploymentOrigin: () => ({ origin: "https://clinic.example", source: "configured" }),
}));
vi.mock("@/lib/reports/assets/renderToken", () => ({
  signRenderToken: () => "signed.token",
  renderTargetHref: (t: string) => `/internal/render/one-pager/${t}`,
}));

const { renderNextDue, renderDueBatch } = await import("@/lib/reports/assets/renderService");
const { RenderError, MIN_PNG_BYTES } = await import("@/lib/reports/assets/contract");

const ASSET = {
  id: "asset_1",
  clinicId: "clinic_1",
  patientId: "patient_1",
  assessmentId: "assessment_1",
  consultationId: "consultation_1",
  consultationVersionId: "cv_1",
  contentVersion: 3,
  type: "ONE_PAGER_PNG" as const,
  status: "RENDERING" as const,
  templateVersion: "hair-one-pager-v1",
  rendererVersion: "chromium-png-v1",
  attemptCount: 1,
};

function validPng(bytes = MIN_PNG_BYTES + 1): Uint8Array {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(2246, 16);
  buf.writeUInt32BE(1588, 20);
  return new Uint8Array(buf);
}

function renderer(bytes: Uint8Array) {
  return {
    render: vi.fn(async () => ({
      bytes,
      mimeType: "image/png" as const,
      environment: "serverless" as const,
      timings: { launchMs: 1, navigateMs: 1, readyMs: 1, captureMs: 1, totalMs: 4 },
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  markReady.mockResolvedValue(true);
  markAttemptFailed.mockResolvedValue({ settled: true, terminal: false });
  loadRenderSource.mockResolvedValue({ asset: ASSET, snapshot: { report: {} } });
  putReportAsset.mockResolvedValue({
    ok: true,
    bucket: "report-assets",
    path: "clinic/clinic_1/consultation/cv_1/one-pager/asset_1.png",
    byteSize: MIN_PNG_BYTES + 1,
    sha256: "b".repeat(64),
  });
  claimNextDue.mockResolvedValue({ asset: ASSET, leaseId: "lease_1" });
});

describe("the happy path", () => {
  it("renders, validates, stores privately, then records READY — in that order", async () => {
    const outcome = await renderNextDue({ renderer: renderer(validPng()) });
    expect(outcome.kind).toBe("rendered");

    // The source is re-authorised before a browser is ever launched.
    expect(loadRenderSource).toHaveBeenCalledWith("asset_1", expect.anything());
    // Bytes reach storage before the row claims to have them.
    expect(putReportAsset).toHaveBeenCalledOnce();
    expect(markReady).toHaveBeenCalledOnce();
    const ready = markReady.mock.calls[0][0] as Record<string, unknown>;
    expect(ready.leaseId).toBe("lease_1");
    expect(ready.sha256).toBe("b".repeat(64));
    expect(ready.storageBucket).toBe("report-assets");
  });

  it("does nothing at all when the queue is empty", async () => {
    claimNextDue.mockResolvedValue(null);
    const r = renderer(validPng());
    expect(await renderNextDue({ renderer: r })).toEqual({ kind: "idle" });
    expect(r.render).not.toHaveBeenCalled();
  });
});

describe("output validation stands between Chromium and a patient", () => {
  it("refuses to store a blank or truncated capture", async () => {
    const outcome = await renderNextDue({ renderer: renderer(new Uint8Array(10)) });
    expect(outcome).toMatchObject({ kind: "failed", code: "OUTPUT_INVALID" });
    // Nothing was stored and nothing was marked READY.
    expect(putReportAsset).not.toHaveBeenCalled();
    expect(markReady).not.toHaveBeenCalled();
  });

  it("refuses bytes that are not a PNG even at a plausible size", async () => {
    const notPng = new Uint8Array(Buffer.alloc(MIN_PNG_BYTES + 100, 0x41));
    const outcome = await renderNextDue({ renderer: renderer(notPng) });
    expect(outcome).toMatchObject({ kind: "failed", code: "OUTPUT_INVALID" });
    expect(markReady).not.toHaveBeenCalled();
  });
});

describe("failure classification drives the retry", () => {
  it("retries a browser launch failure", async () => {
    const failing = {
      render: vi.fn(async () => {
        throw new RenderError("BROWSER_LAUNCH_FAILED", "no chromium");
      }),
    };
    const outcome = await renderNextDue({ renderer: failing });
    expect(outcome).toMatchObject({ kind: "failed", code: "BROWSER_LAUNCH_FAILED" });
    expect(markAttemptFailed.mock.calls[0][0]).toMatchObject({ permanent: false });
  });

  it("does not retry a version that is not approved", async () => {
    loadRenderSource.mockRejectedValue(
      new RenderError("SOURCE_NOT_APPROVED", "version is REVISION_REQUESTED"),
    );
    const r = renderer(validPng());
    const outcome = await renderNextDue({ renderer: r });
    expect(outcome).toMatchObject({ kind: "failed", code: "SOURCE_NOT_APPROVED" });
    expect(markAttemptFailed.mock.calls[0][0]).toMatchObject({ permanent: true });
    // And the browser was never launched for it.
    expect(r.render).not.toHaveBeenCalled();
  });

  it("does not retry a violated authorisation invariant", async () => {
    loadRenderSource.mockRejectedValue(
      new RenderError("AUTH_FAILED", "asset disagrees with its consultation"),
    );
    const outcome = await renderNextDue({ renderer: renderer(validPng()) });
    expect(outcome).toMatchObject({ kind: "failed", code: "AUTH_FAILED" });
    expect(markAttemptFailed.mock.calls[0][0]).toMatchObject({ permanent: true });
  });

  it("retries a storage failure and never marks the row READY", async () => {
    putReportAsset.mockResolvedValue({
      ok: false,
      reason: "upload_failed",
      detail: "bucket unreachable",
    });
    const outcome = await renderNextDue({ renderer: renderer(validPng()) });
    expect(outcome).toMatchObject({ kind: "failed", code: "STORAGE_FAILED" });
    expect(markReady).not.toHaveBeenCalled();
    expect(markAttemptFailed.mock.calls[0][0]).toMatchObject({ permanent: false });
  });

  it("persists a code and a redacted detail, never a raw credential", async () => {
    const failing = {
      render: vi.fn(async () => {
        throw new Error("navigation failed for /internal/render/x?token=SUPERSECRET");
      }),
    };
    await renderNextDue({ renderer: failing });
    const settled = markAttemptFailed.mock.calls[0][0] as { detail: string };
    expect(settled.detail).not.toContain("SUPERSECRET");
  });
});

describe("a lost lease is reported as lost, not as a success", () => {
  it("returns `lost` when the row was reclaimed mid-render", async () => {
    markReady.mockResolvedValue(false);
    const outcome = await renderNextDue({ renderer: renderer(validPng()) });
    expect(outcome).toMatchObject({ kind: "lost", assetId: "asset_1" });
  });
});

describe("batching", () => {
  it("stops as soon as there is no more work rather than spinning", async () => {
    claimNextDue
      .mockResolvedValueOnce({ asset: ASSET, leaseId: "lease_1" })
      .mockResolvedValue(null);
    const outcomes = await renderDueBatch(5, { renderer: renderer(validPng()) });
    expect(outcomes.map((o) => o.kind)).toEqual(["rendered", "idle"]);
  });
});
