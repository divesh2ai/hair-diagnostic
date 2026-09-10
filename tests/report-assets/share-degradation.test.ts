import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// What a doctor's Share does when the one-pager is not there.
//
// ══ THE RULE THIS ENFORCES ══════════════════════════════════════════════════
//
// A rendering failure must never become a clinical-report failure. The patient
// gets their report link either way; the doctor is told, truthfully, whether
// the page travelled with it. That degradation already existed and shipped
// working — the risk in replacing the renderer was silently weakening it.

const findOnePagerAsset = vi.fn();
const getReportAsset = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { consultation: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));
vi.mock("@/lib/reports/assets/jobService", () => ({ findOnePagerAsset }));
vi.mock("@/lib/reports/assets/storage", () => ({ getReportAsset }));

const { loadApprovedOnePagerImage } = await import("@/lib/delivery/onePagerImage");
const { MIN_PNG_BYTES } = await import("@/lib/reports/assets/contract");

function validPng(): Uint8Array {
  const buf = Buffer.alloc(MIN_PNG_BYTES + 1);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(2246, 16);
  buf.writeUInt32BE(1588, 20);
  return new Uint8Array(buf);
}

function asset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset_1",
    status: "READY",
    storageBucket: "report-assets",
    storagePath: "clinic/clinic_1/consultation/cv_1/one-pager/asset_1.png",
    sha256: "c".repeat(64),
    templateVersion: "hair-one-pager-v1",
    consultationVersionId: "cv_1",
    attemptCount: 1,
    errorCode: null,
    generatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({ currentVersion: { id: "cv_1", approvalStatus: "APPROVED" } });
});

describe("a READY artefact travels with the message", () => {
  it("returns the stored bytes and their provenance", async () => {
    findOnePagerAsset.mockResolvedValue(asset());
    getReportAsset.mockResolvedValue(validPng());

    const result = await loadApprovedOnePagerImage("assessment_1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image.mimeType).toBe("image/png");
      expect(result.image.assetId).toBe("asset_1");
      expect(result.image.sha256).toBe("c".repeat(64));
      expect(result.image.consultationVersionId).toBe("cv_1");
      // The filename must not identify the patient: it appears in the chat, in
      // the phone's gallery, and survives forwarding.
      expect(result.image.filename).toBe("hair-report-assessment_1.png");
    }
  });
});

describe("every other state degrades to link-only, and says which", () => {
  it("PENDING — still being prepared", async () => {
    findOnePagerAsset.mockResolvedValue(asset({ status: "PENDING" }));
    expect(await loadApprovedOnePagerImage("assessment_1")).toMatchObject({
      ok: false,
      reason: "pending",
    });
    // And it did NOT go looking for bytes that cannot exist yet.
    expect(getReportAsset).not.toHaveBeenCalled();
  });

  it("RENDERING — still being prepared", async () => {
    findOnePagerAsset.mockResolvedValue(asset({ status: "RENDERING" }));
    expect(await loadApprovedOnePagerImage("assessment_1")).toMatchObject({
      ok: false,
      reason: "pending",
    });
  });

  it("FAILED — could not be produced", async () => {
    findOnePagerAsset.mockResolvedValue(asset({ status: "FAILED", errorCode: "RENDER_TIMEOUT" }));
    expect(await loadApprovedOnePagerImage("assessment_1")).toMatchObject({
      ok: false,
      reason: "failed",
      assetId: "asset_1",
    });
  });

  it("no asset row at all — an unmigrated or unrequested deployment", async () => {
    findOnePagerAsset.mockResolvedValue(null);
    expect(await loadApprovedOnePagerImage("assessment_1")).toMatchObject({
      ok: false,
      reason: "not_provisioned",
    });
  });

  it("READY but the object is gone", async () => {
    findOnePagerAsset.mockResolvedValue(asset());
    getReportAsset.mockResolvedValue(null);
    expect(await loadApprovedOnePagerImage("assessment_1")).toMatchObject({
      ok: false,
      reason: "bytes_missing",
    });
  });

  it("READY but the stored bytes fail their check", async () => {
    // Re-validated on the way out. "Storage returned something" is not the
    // same claim as "storage returned our report".
    findOnePagerAsset.mockResolvedValue(asset());
    getReportAsset.mockResolvedValue(new Uint8Array(20));
    expect(await loadApprovedOnePagerImage("assessment_1")).toMatchObject({
      ok: false,
      reason: "bytes_invalid",
    });
  });

  it("an unapproved consultation is never looked up at all", async () => {
    findUnique.mockResolvedValue({
      currentVersion: { id: "cv_1", approvalStatus: "REVISION_REQUESTED" },
    });
    expect(await loadApprovedOnePagerImage("assessment_1")).toMatchObject({
      ok: false,
      reason: "not_requested",
    });
    expect(findOnePagerAsset).not.toHaveBeenCalled();
  });
});

describe("no browser is reachable from the Share path", () => {
  // A structural assertion, because this is the defect the whole architecture
  // exists to prevent and it cannot be caught by exercising the happy path: a
  // future edit that reintroduces a render into the send path would pass every
  // behavioural test above while putting Chromium back inside a doctor's
  // click.
  const APP = path.resolve(process.cwd(), "apps/patient-portal/src");
  const SHARE_PATH_MODULES = [
    "lib/delivery/sendPatientLink.ts",
    "lib/delivery/onePagerImage.ts",
    "lib/delivery/deliveryStore.ts",
    "app/api/consultation/[assessmentId]/share/route.ts",
  ];

  it.each(SHARE_PATH_MODULES)("%s imports no browser", (relative) => {
    const source = readFileSync(path.join(APP, relative), "utf8");
    expect(source).not.toMatch(/from\s+["']playwright/);
    expect(source).not.toMatch(/createRendererBrowser/);
    expect(source).not.toMatch(/@sparticuz\/chromium/);
  });

  it("no longer forwards a session cookie into a render", () => {
    const source = readFileSync(path.join(APP, "lib/delivery/sendPatientLink.ts"), "utf8");
    // The old implementation carried the doctor's live credential into a
    // background render. Nothing on this path should hold one now.
    expect(source).not.toMatch(/cookie\?:\s*string/);
  });
});
