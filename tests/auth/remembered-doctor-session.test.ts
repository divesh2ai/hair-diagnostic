import { NextRequest } from "../../apps/patient-portal/node_modules/next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { POST as signOut } from "@/app/auth/signout/route";

const auth = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  rotate: false,
}));

vi.mock("../../apps/patient-portal/node_modules/@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, { cookies }: {
    cookies: { setAll: (entries: { name: string; value: string; options: { maxAge: number } }[]) => void };
  }) => ({
    auth: {
      ...auth,
      getClaims: () => {
        if (auth.rotate) cookies.setAll([{ name: "sb-session", value: "rotated", options: { maxAge: 3600 } }]);
        return auth.getClaims();
      },
    },
  }),
}));

const request = (path: string, init?: RequestInit) => new NextRequest(new URL(path, "https://hairos.test"), init as ConstructorParameters<typeof NextRequest>[1]);

describe("remembered doctor session", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.rotate = false;
    auth.getClaims.mockResolvedValue({ data: { claims: { user_role: "DOCTOR", sub: "doctor-a", clinic_id: "clinic-a" } } });
    auth.getUser.mockResolvedValue({ data: { user: { id: "doctor-a" } } });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it("resumes through existing role routing and preserves rotated cookies", async () => {
    auth.rotate = true;
    const response = await proxy(request("/login?next=%2Fdoctor%2Freports"));
    expect(response.headers.get("location")).toBe("https://hairos.test/post-login?next=%2Fdoctor%2Freports");
    expect(response.cookies.get("sb-session")?.value).toBe("rotated");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps an explicit auth error visible instead of looping", async () => {
    const response = await proxy(request("/login?reason=forbidden"));
    expect(response.headers.has("location")).toBe(false);
  });

  it("rejects a revoked doctor session even with verified claims", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("session_not_found") });
    const response = await proxy(request("/api/doctor/patients"));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await proxy(request("/login"))).headers.has("location")).toBe(false);
  });

  it("keeps Super Admin routing separate and rejects an admin return path for doctors", async () => {
    const response = await proxy(request("/login?next=%2Fadmin"));
    expect(response.headers.get("location")).toBe("https://hairos.test/post-login");
    expect((await proxy(request("/admin"))).headers.get("location")).toBe("https://hairos.test/login?reason=forbidden");
    auth.getClaims.mockResolvedValue({ data: { claims: { user_role: "SUPER_ADMIN", sub: "admin-a" } } });
    expect((await proxy(request("/admin"))).headers.has("location")).toBe(false);
    expect((await proxy(request("/login"))).headers.has("location")).toBe(false);
  });

  it("signs out this session only and uses GET after a form POST", async () => {
    const response = await signOut(request("/auth/signout", { method: "POST" }));
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("reports a failed idle sign-out rather than claiming the session ended", async () => {
    auth.signOut.mockResolvedValue({ error: new Error("network failure") });
    const response = await signOut(request("/auth/signout", { method: "POST", headers: { Accept: "application/json" } }));
    expect(response.status).toBe(503);
    expect(response.headers.has("location")).toBe(false);
  });
});
