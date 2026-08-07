import { describe, expect, it } from "vitest";
import { readAssistantReleaseMode, resolveAssistantReleaseAccess } from "../../apps/patient-portal/src/lib/assistant/releaseMode";

const doctor = { role: "DOCTOR" as const, clinicId: "clinic-a", userId: "doctor-a" };
const staff = { role: "STAFF" as const, clinicId: "clinic-a", userId: "staff-a" };
const patient = { role: "PATIENT" as const, clinicId: "clinic-a", userId: "patient-a" };

describe("assistant release modes", () => {
  it("defaults to DISABLED and maps the legacy flag only to INTERNAL_PREVIEW", () => {
    expect(readAssistantReleaseMode({} as NodeJS.ProcessEnv)).toBe("DISABLED");
    expect(readAssistantReleaseMode({ ASSISTANT_STAGE1_ENABLED: "1" } as NodeJS.ProcessEnv)).toBe("INTERNAL_PREVIEW");
  });
  it("DISABLED rejects every role", () => expect(resolveAssistantReleaseAccess(doctor, { ASSISTANT_RELEASE_MODE: "DISABLED" } as NodeJS.ProcessEnv).allowed).toBe(false));
  it("INTERNAL_PREVIEW rejects patients and permits staff with traces", () => {
    expect(resolveAssistantReleaseAccess(patient, { ASSISTANT_RELEASE_MODE: "INTERNAL_PREVIEW" } as NodeJS.ProcessEnv).allowed).toBe(false);
    expect(resolveAssistantReleaseAccess(staff, { ASSISTANT_RELEASE_MODE: "INTERNAL_PREVIEW" } as NodeJS.ProcessEnv)).toMatchObject({ allowed: true, internalProvisionalMode: true, showInternalTrace: true });
  });
  it("DOCTOR_ONLY rejects staff and patients", () => {
    const env = { ASSISTANT_RELEASE_MODE: "DOCTOR_ONLY" } as NodeJS.ProcessEnv;
    expect(resolveAssistantReleaseAccess(doctor, env).allowed).toBe(true);
    expect(resolveAssistantReleaseAccess(staff, env).allowed).toBe(false);
    expect(resolveAssistantReleaseAccess(patient, env).allowed).toBe(false);
  });
  it("PATIENT_PILOT requires a server-side clinic or user allowlist", () => {
    const denied = resolveAssistantReleaseAccess(patient, { ASSISTANT_RELEASE_MODE: "PATIENT_PILOT" } as NodeJS.ProcessEnv);
    const allowed = resolveAssistantReleaseAccess(patient, { ASSISTANT_RELEASE_MODE: "PATIENT_PILOT", ASSISTANT_PATIENT_PILOT_CLINIC_IDS: "clinic-a" } as NodeJS.ProcessEnv);
    expect(denied.allowed).toBe(false); expect(allowed.allowed).toBe(true); expect(allowed.internalProvisionalMode).toBe(false);
  });
  it("PRODUCTION allows patients but never enables their provisional retrieval or trace", () => {
    expect(resolveAssistantReleaseAccess(patient, { ASSISTANT_RELEASE_MODE: "PRODUCTION" } as NodeJS.ProcessEnv)).toMatchObject({ allowed: true, internalProvisionalMode: false, showInternalTrace: false });
    expect(resolveAssistantReleaseAccess(doctor, { ASSISTANT_RELEASE_MODE: "PRODUCTION" } as NodeJS.ProcessEnv)).toMatchObject({ allowed: true, internalProvisionalMode: false, showInternalTrace: true });
  });
});
