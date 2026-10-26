import { describe, it, expect } from "vitest";
import {
  classifyClinicReadiness,
  operationalLabel,
} from "@/lib/admin/readiness";

describe("classifyClinicReadiness", () => {
  it("DATABASE ACTIVE only when status is ACTIVE and not deleted", () => {
    expect(
      classifyClinicReadiness({ status: "ACTIVE", hasAccessReadyDoctor: false })
        .databaseActive,
    ).toBe(true);
    expect(
      classifyClinicReadiness({
        status: "ACTIVE",
        deleted: true,
        hasAccessReadyDoctor: true,
      }).databaseActive,
    ).toBe(false);
    for (const status of ["SUSPENDED", "ARCHIVED"]) {
      expect(
        classifyClinicReadiness({ status, hasAccessReadyDoctor: true })
          .databaseActive,
      ).toBe(false);
    }
  });

  it("ACCESS READY reflects doctor provisioning (not clinic status)", () => {
    expect(
      classifyClinicReadiness({ status: "ACTIVE", hasAccessReadyDoctor: true })
        .accessReady,
    ).toBe(true);
    expect(
      classifyClinicReadiness({ status: "ACTIVE", hasAccessReadyDoctor: false })
        .accessReady,
    ).toBe(false);
  });

  it("OPERATIONALLY VERIFIED is PENDING unless a verification record exists", () => {
    // The core rule: activity (even on an ACTIVE, access-ready clinic) is NOT
    // verification. Only an explicit verification record flips it to VERIFIED.
    expect(
      classifyClinicReadiness({ status: "ACTIVE", hasAccessReadyDoctor: true })
        .operational,
    ).toBe("PENDING");
    expect(
      classifyClinicReadiness({
        status: "ACTIVE",
        hasAccessReadyDoctor: true,
        verificationRecord: false,
      }).operational,
    ).toBe("PENDING");
    expect(
      classifyClinicReadiness({
        status: "ACTIVE",
        hasAccessReadyDoctor: true,
        verificationRecord: true,
      }).operational,
    ).toBe("VERIFIED");
  });

  it("labels the operational tier in words", () => {
    expect(operationalLabel("PENDING")).toBe("Verification pending");
    expect(operationalLabel("VERIFIED")).toBe("Operationally verified");
  });
});
