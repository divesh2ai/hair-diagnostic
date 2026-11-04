import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ role: "DOCTOR" })) }));

import { GET } from "@/app/api/kits/route";
import { buildDoctorOrderPricing } from "@/lib/doctor/orderPricing";

describe("Doctor add-list governed pricing", () => {
  it("uses the same price decisions as the approved order for every offered kit", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const { items } = await response.json();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const expected = buildDoctorOrderPricing([item.kitId]).lineItems[0]!;
      expect(item.priceInr).toBe(expected.priceInr);
      expect(item.commercialState).toBe(expected.commercialState);
      if (expected.priceInr === null) expect(item.priceLabel).toContain("Catalogue review required");
    }
    expect(items.find((item: { kitId: string }) => item.kitId === "EARLY_GREYING_CARE_GOLD").priceInr).toBe(3647);
  });
});
