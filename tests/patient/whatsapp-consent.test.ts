// Patient WhatsApp consent — read/write over guarded raw SQL. Must never
// throw the clinical review path down with it if the migration is missing,
// and must never claim consent that was not recorded.
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

class KnownRequestError extends Error {
  code: string;
  meta: Record<string, unknown>;
  constructor(code: string, meta: Record<string, unknown>) {
    super("Prisma error");
    this.code = code;
    this.meta = meta;
  }
}

jest.mock("@prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: KnownRequestError,
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
}));

const queryRaw = jest.fn<(...a: unknown[]) => Promise<unknown>>();
jest.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getPatientWhatsappConsent, setPatientWhatsappConsent } = require("../../apps/patient-portal/src/lib/patient/whatsappConsent");

beforeEach(() => {
  queryRaw.mockReset();
});

describe("getPatientWhatsappConsent", () => {
  it("reports consent true when the column says so", async () => {
    queryRaw.mockResolvedValue([
      { whatsappConsent: true, whatsappConsentAt: new Date("2026-09-08T00:00:00.000Z"), whatsappConsentSource: "intake_form_v1" },
    ]);
    const r = await getPatientWhatsappConsent("pat-1");
    expect(r).toEqual({
      consent: true,
      consentAt: "2026-09-08T00:00:00.000Z",
      consentSource: "intake_form_v1",
      provisioned: true,
    });
  });

  it("reports consent false, provisioned true, when the column exists and says false", async () => {
    queryRaw.mockResolvedValue([
      { whatsappConsent: false, whatsappConsentAt: null, whatsappConsentSource: null },
    ]);
    const r = await getPatientWhatsappConsent("pat-1");
    expect(r).toEqual({ consent: false, consentAt: null, consentSource: null, provisioned: true });
  });

  it("fails closed to consent:false, provisioned:false when the column does not exist yet", async () => {
    queryRaw.mockRejectedValue(
      new KnownRequestError("P2010", { code: "42703", message: 'column "whatsappConsent" does not exist' }),
    );
    const r = await getPatientWhatsappConsent("pat-1");
    expect(r).toEqual({ consent: false, consentAt: null, consentSource: null, provisioned: false });
  });

  it("fails closed to consent:false when the patient row itself is missing", async () => {
    queryRaw.mockResolvedValue([]);
    const r = await getPatientWhatsappConsent("does-not-exist");
    expect(r.consent).toBe(false);
    expect(r.provisioned).toBe(true); // the query itself worked; there is just no such patient
  });

  it("does not swallow an unrelated database error", async () => {
    queryRaw.mockRejectedValue(new Error("connection reset"));
    await expect(getPatientWhatsappConsent("pat-1")).rejects.toThrow("connection reset");
  });
});

describe("setPatientWhatsappConsent", () => {
  it("persists true with a source and a timestamp", async () => {
    queryRaw.mockResolvedValue([
      { whatsappConsent: true, whatsappConsentAt: new Date("2026-09-08T00:00:00.000Z"), whatsappConsentSource: "doctor_workspace_manual" },
    ]);
    const r = await setPatientWhatsappConsent("pat-1", true, "doctor_workspace_manual");
    expect(r.consent).toBe(true);
    expect(r.consentSource).toBe("doctor_workspace_manual");
  });

  it("fails closed rather than throwing when unprovisioned", async () => {
    queryRaw.mockRejectedValue(
      new KnownRequestError("P2010", { code: "42703", message: "does not exist" }),
    );
    const r = await setPatientWhatsappConsent("pat-1", true, "intake_form_v1");
    expect(r.provisioned).toBe(false);
  });
});
