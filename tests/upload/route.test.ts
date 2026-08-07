// W6 — /api/upload route-handler integration tests.
//
// We exercise the real POST handler with mocked auth / prisma / Supabase so
// every branch (401, 400, 403, 404, 500-storage-not-configured, 200-signed)
// is covered without a live Supabase/Postgres.

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

class UnauthorizedError extends Error {
  constructor(msg = "Unauthorized") {
    super(msg);
    this.name = "UnauthorizedError";
  }
}

const getClinicContext = jest.fn<() => Promise<{ userId: string; role: string; clinicId: string | null }>>();

jest.mock("@/lib/auth", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NextResponse } = require("next/server");
  return {
    getClinicContext: () => getClinicContext(),
    handleAuthError: (err: unknown) => {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      return null;
    },
  };
});

jest.mock("@/lib/auth/roles", () => ({
  isSuperAdmin: (role: string) => role === "SUPER_ADMIN",
}));

const findUnique = jest.fn<(args: { where: { id: string } }) => Promise<{ id: string; clinicId: string } | null>>();
jest.mock("@/lib/prisma", () => ({
  prisma: { assessment: { findUnique: (args: { where: { id: string } }) => findUnique(args) } },
}));

const createSignedUploadUrl = jest.fn<(path: string) => Promise<{ data: { signedUrl: string } | null; error: Error | null }>>();
jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: { from: () => ({ createSignedUploadUrl: (p: string) => createSignedUploadUrl(p) }) },
  }),
}));

// Late require so the mocks above are in place first.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require("../../apps/patient-portal/src/app/api/upload/route");

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = { ...process.env };

describe("POST /api/upload (W6)", () => {
  beforeEach(() => {
    getClinicContext.mockReset();
    findUnique.mockReset();
    createSignedUploadUrl.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://real.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "real-service-key";
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("401 when caller is unauthenticated", async () => {
    getClinicContext.mockRejectedValue(new UnauthorizedError());
    const res = await POST(jsonRequest({ fileName: "a.jpg", contentType: "image/jpeg", assessmentId: "asm-1" }));
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("400 when body is missing required fields", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    const res = await POST(jsonRequest({ fileName: "a.jpg" }));
    expect(res.status).toBe(400);
  });

  it("400 when MIME is unsupported (application/pdf)", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    const res = await POST(jsonRequest({ fileName: "evil.pdf", contentType: "application/pdf", assessmentId: "asm-1" }));
    expect(res.status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("400 when MIME is a spoofed image type (image/svg+xml)", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    const res = await POST(jsonRequest({ fileName: "x.svg", contentType: "image/svg+xml", assessmentId: "asm-1" }));
    expect(res.status).toBe(400);
  });

  it("400 when filename is a traversal-only leaf ('..')", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    const res = await POST(jsonRequest({ fileName: "..", contentType: "image/jpeg", assessmentId: "asm-1" }));
    expect(res.status).toBe(400);
  });

  it("404 when assessment does not exist", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    findUnique.mockResolvedValue(null);
    const res = await POST(jsonRequest({ fileName: "a.jpg", contentType: "image/jpeg", assessmentId: "missing" }));
    expect(res.status).toBe(404);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("403 when doctor is from a different clinic than the assessment", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-B" });
    findUnique.mockResolvedValue({ id: "asm-1", clinicId: "clinic-A" });
    const res = await POST(jsonRequest({ fileName: "a.jpg", contentType: "image/jpeg", assessmentId: "asm-1" }));
    expect(res.status).toBe(403);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.signedUrl).toBeUndefined();
    expect(body.publicUrl).toBeUndefined();
  });

  it("500 fails closed when SUPABASE_SERVICE_ROLE_KEY is missing (no mock fallback)", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    findUnique.mockResolvedValue({ id: "asm-1", clinicId: "clinic-A" });
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const res = await POST(jsonRequest({ fileName: "a.jpg", contentType: "image/jpeg", assessmentId: "asm-1" }));
    expect(res.status).toBe(500);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.error).toBe("Storage not configured");
    // Guardrail: no signed URL, no public URL, no leaked "mock" host.
    expect(body.signedUrl).toBeUndefined();
    expect(body.publicUrl).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/mock/i);
  });

  it("500 fails closed when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    findUnique.mockResolvedValue({ id: "asm-1", clinicId: "clinic-A" });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const res = await POST(jsonRequest({ fileName: "a.jpg", contentType: "image/jpeg", assessmentId: "asm-1" }));
    expect(res.status).toBe(500);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("200 same-clinic doctor gets a signed URL with a DB-owned storage path", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    findUnique.mockResolvedValue({ id: "asm-1", clinicId: "clinic-A" });
    createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "https://real.supabase.co/signed-abc" }, error: null });

    const res = await POST(jsonRequest({ fileName: "crown.jpg", contentType: "image/jpeg", assessmentId: "asm-1" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.signedUrl).toBe("https://real.supabase.co/signed-abc");
    expect(body.path).toMatch(/^assessments\/asm-1\/scalp\/\d+-crown\.jpg$/);
    // Response must NOT include a public URL — bucket policy is the source
    // of truth for public accessibility, not this handler.
    expect(body.publicUrl).toBeUndefined();
  });

  it("200 traversal attempts in fileName are stripped, never surface in the storage path", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    findUnique.mockResolvedValue({ id: "asm-1", clinicId: "clinic-A" });
    createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "https://real.supabase.co/x" }, error: null });

    const res = await POST(jsonRequest({
      fileName: "../../etc/passwd.jpg",
      contentType: "image/jpeg",
      assessmentId: "asm-1",
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Path must live under the DB-owned assessment id and never contain `..`
    // or a rooted `/etc/…` segment.
    expect(body.path).toMatch(/^assessments\/asm-1\/scalp\/\d+-passwd\.jpg$/);
    expect(body.path).not.toContain("..");
    expect(body.path).not.toContain("/etc/");
    // The path passed to Supabase must match what the client is told.
    expect(createSignedUploadUrl).toHaveBeenCalledWith(body.path);
  });

  it("200 caller-supplied assessmentId is never trusted verbatim in the storage path", async () => {
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-A" });
    // DB returns a DIFFERENT canonical id than what the client claimed —
    // the response must use the DB value.
    findUnique.mockResolvedValue({ id: "asm-canonical", clinicId: "clinic-A" });
    createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "https://real.supabase.co/x" }, error: null });

    const res = await POST(jsonRequest({ fileName: "a.jpg", contentType: "image/jpeg", assessmentId: "asm-client-claim" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path.startsWith("assessments/asm-canonical/")).toBe(true);
    expect(body.path.includes("asm-client-claim")).toBe(false);
  });

  it("SUPER_ADMIN bypasses cross-clinic check", async () => {
    getClinicContext.mockResolvedValue({ userId: "sa", role: "SUPER_ADMIN", clinicId: null });
    findUnique.mockResolvedValue({ id: "asm-1", clinicId: "clinic-A" });
    createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "https://real.supabase.co/x" }, error: null });

    const res = await POST(jsonRequest({ fileName: "a.jpg", contentType: "image/jpeg", assessmentId: "asm-1" }));
    expect(res.status).toBe(200);
  });
});
