import { ALLOWED_MIME, MAX_UPLOAD_BYTES, isUploadSizeAllowed, isValidUploadSessionId, sanitizeFileName } from "../../apps/patient-portal/src/app/api/upload/validation";

describe("/api/upload — filename sanitizer (W2)", () => {
  it("accepts a normal image filename", () => {
    expect(sanitizeFileName("scalp-crown.jpg")).toBe("scalp-crown.jpg");
  });

  it("strips path segments (traversal via /)", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
  });

  it("strips path segments (traversal via \\)", () => {
    expect(sanitizeFileName("..\\..\\windows\\system32\\evil.png")).toBe("evil.png");
  });

  it("rejects '..' as a leaf", () => {
    expect(sanitizeFileName("..")).toBeNull();
  });

  it("rejects control chars", () => {
    expect(sanitizeFileName("evil\x00.jpg")).toBeNull();
  });

  it("rejects leading-dot leaves", () => {
    expect(sanitizeFileName(".env")).toBeNull();
  });

  it("replaces unsafe characters with underscores", () => {
    expect(sanitizeFileName("my photo?.jpg")).toBe("my_photo_.jpg");
  });

  it("rejects empty input", () => {
    expect(sanitizeFileName("")).toBeNull();
  });

  it("validates questionnaire upload size and session IDs", () => {
    expect(isUploadSizeAllowed(1)).toBe(true);
    expect(isUploadSizeAllowed(MAX_UPLOAD_BYTES)).toBe(true);
    expect(isUploadSizeAllowed(0)).toBe(false);
    expect(isUploadSizeAllowed(MAX_UPLOAD_BYTES + 1)).toBe(false);
    expect(isValidUploadSessionId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUploadSessionId("../assessment-id")).toBe(false);
  });
  it("accepts only supported image MIME types", () => {
    expect(ALLOWED_MIME.has("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME.has("image/png")).toBe(true);
    expect(ALLOWED_MIME.has("image/webp")).toBe(true);
    expect(ALLOWED_MIME.has("application/pdf")).toBe(false);
    expect(ALLOWED_MIME.has("image/svg+xml")).toBe(false);
    expect(ALLOWED_MIME.has("image/gif")).toBe(false);
  });
});
