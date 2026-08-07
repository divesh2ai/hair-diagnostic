import { describe, expect, it } from "vitest";
import { harshFixture } from "../../apps/patient-portal/src/lib/reports/one-page/fixtures/harsh";
import { janviFixture } from "../../apps/patient-portal/src/lib/reports/one-page/fixtures/janvi";

const visible = <T>(items: T[], maximum: number) => items.slice(0, maximum);

describe("Conference One-Pager V1 content contract", () => {
  it("locks Janvi to the four-pathway conference evidence case", () => {
    expect(janviFixture.layoutMode).toBe("standard");
    expect(janviFixture.treatmentPlan).toHaveLength(4);
    expect(janviFixture.keyClinicalSnapshot).toHaveLength(6);
    expect(janviFixture.topicalCare).toHaveLength(2);
    expect(janviFixture.patternScale?.patientStage).toBe("Ludwig 1");

    for (const pathway of janviFixture.treatmentPlan) {
      expect(visible(pathway.linkedDrivers, 2).length).toBeLessThanOrEqual(2);
      expect(pathway.benefits).toHaveLength(2);
      expect(pathway.mappedInterpretation?.split(/\s+/).length).toBeLessThanOrEqual(12);
    }
  });

  it("keeps the selected male demonstration case inside the same limits", () => {
    expect(harshFixture.treatmentPlan.length).toBeLessThanOrEqual(4);
    expect(visible(harshFixture.keyClinicalSnapshot, 6)).toHaveLength(6);
    expect(harshFixture.topicalCare.length).toBeLessThanOrEqual(2);
    expect(harshFixture.patternScale?.type).toBe("Norwood");
  });
});
