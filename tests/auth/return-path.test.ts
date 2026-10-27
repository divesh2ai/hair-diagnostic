import { describe, it, expect } from "vitest";
import { safeReturnPath } from "@/lib/auth/returnPath";

describe("safeReturnPath", () => {
  it("keeps a same-origin absolute path", () => {
    expect(safeReturnPath("/admin")).toBe("/admin");
    expect(safeReturnPath("/post-login?next=%2Fadmin")).toBe(
      "/post-login?next=%2Fadmin",
    );
    expect(safeReturnPath("/admin/network")).toBe("/admin/network");
  });

  it("falls back to /post-login for missing or empty input", () => {
    expect(safeReturnPath(null)).toBe("/post-login");
    expect(safeReturnPath(undefined)).toBe("/post-login");
    expect(safeReturnPath("")).toBe("/post-login");
  });

  it("rejects open-redirect vectors (off-origin)", () => {
    // Absolute URLs, protocol-relative hosts, and backslash tricks must never
    // survive — these are the classic open-redirect payloads.
    for (const evil of [
      "https://evil.test",
      "http://evil.test/admin",
      "//evil.test",
      "//evil.test/admin",
      "/\\evil.test",
      "javascript:alert(1)",
      "evil.test",
      " /admin", // leading space → not an absolute path
    ]) {
      expect(safeReturnPath(evil)).toBe("/post-login");
    }
  });

  it("honours a custom fallback", () => {
    expect(safeReturnPath(null, "/admin")).toBe("/admin");
    expect(safeReturnPath("//evil.test", "/admin")).toBe("/admin");
  });
});
