import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getPatientWhatsappConsent,
  setPatientWhatsappConsent,
} from "@/lib/patient/whatsappConsent";
import { assertStagingTarget, wave0Id } from "../post-approval/behavioural/harness";

// Real rows, against the now-migrated staging database (see the Phase 1
// migration gate). The mocked unit suite (whatsapp-consent.test.ts) cannot
// prove what the actual SQL does to a real row — this can.
//
// `@/lib/prisma` refuses to connect to anything but staging at import time,
// and `assertStagingTarget()` re-checks explicitly, so this cannot reach
// production even under misconfiguration.

let clinicId: string;
let patientId: string;

beforeAll(async () => {
  assertStagingTarget();
  const doctor = await prisma.doctor.findFirstOrThrow({
    where: { email: "dr.test.a@drfact.staging" },
    select: { clinicId: true },
  });
  clinicId = doctor.clinicId;

  const suffix = wave0Id();
  const patient = await prisma.patient.create({
    data: {
      id: `${suffix}-patient`,
      clinicId,
      name: "WAVE0-TEST Consent Patient",
      phone: "+919999000002",
    },
  });
  patientId = patient.id;
}, 60_000);

afterAll(async () => {
  if (patientId) {
    await prisma.patient.delete({ where: { id: patientId } }).catch(() => undefined);
  }
}, 60_000);

describe("WhatsApp consent — real round trip against the migrated Patient table", () => {
  it("a freshly created patient is provisioned and reports no consent", async () => {
    const r = await getPatientWhatsappConsent(patientId);
    expect(r).toEqual({ consent: false, consentAt: null, consentSource: null, provisioned: true });
  });

  it("granting consent stamps whatsappConsentAt with a real server timestamp", async () => {
    const before = Date.now();
    const r = await setPatientWhatsappConsent(patientId, true, "intake_form_v1");
    expect(r.provisioned).toBe(true);
    expect(r.consent).toBe(true);
    expect(r.consentSource).toBe("intake_form_v1");
    expect(r.consentAt).toBeTruthy();
    expect(new Date(r.consentAt!).getTime()).toBeGreaterThanOrEqual(before - 5_000);

    const read = await getPatientWhatsappConsent(patientId);
    expect(read.consent).toBe(true);
    expect(read.consentAt).toBe(r.consentAt);
  });

  it("revoking consent clears whatsappConsentAt to null — it does not stamp a new time", async () => {
    // Granted in the previous test, so this row currently has a real
    // consentAt. Revoking must NULL it, not overwrite it with "now": a
    // withdrawn consent is not a dated event the same way a grant is.
    const r = await setPatientWhatsappConsent(patientId, false, "doctor_workspace_manual");
    expect(r.consent).toBe(false);
    expect(r.consentAt).toBeNull();
    expect(r.consentSource).toBe("doctor_workspace_manual");

    const read = await getPatientWhatsappConsent(patientId);
    expect(read.consent).toBe(false);
    expect(read.consentAt).toBeNull();
  });

  it("re-granting after a revocation stamps a fresh timestamp", async () => {
    const before = Date.now();
    const r = await setPatientWhatsappConsent(patientId, true, "intake_form_v1");
    expect(r.consent).toBe(true);
    expect(r.consentAt).toBeTruthy();
    expect(new Date(r.consentAt!).getTime()).toBeGreaterThanOrEqual(before - 5_000);
  });
});
