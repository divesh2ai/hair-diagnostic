import { describe, expect, it } from "vitest";
import { clinicUsage, monitorRows } from "@/lib/admin/opsDashboard/clinicMonitor";
import { opsDataEnvironment } from "@/lib/admin/opsDashboard/dataEnvironment";
import type { ClinicOpsRow } from "@/lib/admin/opsDashboard/types";

function row(overrides: Partial<ClinicOpsRow> = {}): ClinicOpsRow {
  return {
    name: "Coastal Clinic", slug: "coastal", status: "ACTIVE",
    adoptionStatus: "USING", authProvider: "GOOGLE",
    followUp: { priority: null, action: "", reason: "" },
    flags: { needsAttention: false, neverLoggedIn: false } as ClinicOpsRow["flags"],
    ...overrides,
  } as ClinicOpsRow;
}

describe("clinic monitoring", () => {
  it("puts attention first, then most recent activity", () => {
    const active = row({ lastAssessmentAt: "2026-11-05T10:00:00Z" });
    const older = row({ adoptionStatus: "DORMANT", lastAssessmentAt: "2026-10-02T10:00:00Z", followUp: { priority: 3, action: "", reason: "" } });
    const newer = row({ lastSignInAt: "2026-11-01T10:00:00Z", flags: { ...active.flags, needsAttention: true } });
    expect(monitorRows([older, active, newer], "all", "")).toEqual([newer, older, active]);
    expect(monitorRows([older, active, newer], "followUp", "")).toEqual([newer, older]);
    expect(clinicUsage(older)).toBe("inactive");
  });

  it("finds both unlinked and linked doctors with no recorded login", () => {
    const unlinked = row({ adoptionStatus: "LOGIN_PENDING", authProvider: "NOT_LINKED" });
    const linked = row({ adoptionStatus: "NOT_STARTED", flags: { ...unlinked.flags, neverLoggedIn: true } });
    const unknown = row({ adoptionStatus: "UNKNOWN", authProvider: "UNKNOWN" });
    expect(monitorRows([unlinked, linked, unknown], "loginPending", "")).toEqual([unlinked, linked]);
    expect(monitorRows([unlinked, linked, unknown], "notStarted", " COASTAL ")).toEqual([unlinked, linked]);
    expect(clinicUsage(unknown)).toBe("unknown");
  });

  it("labels the configured database target without guessing from the runtime", () => {
    expect(opsDataEnvironment("postgresql://postgres@db.vbkoupvduadmcxggtnsb.supabase.co:5432/postgres")).toBe("STAGING");
    expect(opsDataEnvironment("postgresql://postgres.pykoyxbleowxwechotth@aws.pooler.supabase.com/postgres")).toBe("PRODUCTION");
    expect(opsDataEnvironment("postgresql://localhost/hairos")).toBe("UNVERIFIED");
    expect(opsDataEnvironment(undefined)).toBe("UNVERIFIED");
  });
});
