import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/clinics/[id]/operations/route";
import { assertSuperAdmin } from "@/lib/auth";
import { loadClinicDetail } from "@/lib/admin/clinicMonitor/clinicDetail";

vi.mock("@/lib/auth", () => ({
  assertSuperAdmin: vi.fn(),
  handleAuthError: (error: Error & { status?: number }) => error.status
    ? Response.json({ error: "Denied" }, { status: error.status }) : null,
}));
vi.mock("@/lib/admin/clinicMonitor/clinicDetail", () => ({ loadClinicDetail: vi.fn() }));

const request = new Request("https://example.test/api/admin/clinics/clinic-a/operations");
const context = () => ({ params: Promise.resolve({ id: "clinic-a" }) });
beforeEach(() => vi.resetAllMocks());

describe("Clinic operations drawer endpoint", () => {
  it.each([401, 403])("does not query the clinic for a caller denied with %s", async (status) => {
    vi.mocked(assertSuperAdmin).mockRejectedValue(Object.assign(new Error("Denied"), { status }));
    const response = await GET(request, context());
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(loadClinicDetail).not.toHaveBeenCalled();
  });

  it("uses the requested clinic and does not cache a missing-clinic response", async () => {
    vi.mocked(loadClinicDetail).mockResolvedValue(null);
    const response = await GET(request, context());
    expect(loadClinicDetail).toHaveBeenCalledExactlyOnceWith("clinic-a");
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
