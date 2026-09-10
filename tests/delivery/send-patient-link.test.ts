// sendPatientLink — the orchestration layer every automated WhatsApp send
// goes through. This suite pins the three properties the whole feature rests
// on: consent is checked BEFORE the provider is ever contacted, a duplicate
// successful send for the same approved version never reaches the provider a
// second time, and CONFIGURATION_ERROR is recorded honestly rather than as a
// success.
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.mock("@/lib/prisma", () => ({ prisma: {} }));

const writeAuditLog = jest.fn<(...a: unknown[]) => Promise<unknown>>();
jest.mock("@/lib/audit/writeAuditLog", () => ({
  writeAuditLog: (...a: unknown[]) => writeAuditLog(...a),
}));

jest.mock("@/lib/journey/events", () => ({ tokenFingerprint: () => "fp-stub" }));
jest.mock("@/lib/cartToken", () => ({ signCartToken: () => "cart-token-stub" }));
jest.mock("@/lib/doctor/cartHref", () => ({
  absoluteCartUrl: (origin: string) => `${origin}/cart/stub`,
}));
jest.mock("@/lib/reportShareToken", () => ({
  signReportShareToken: () => "report-token-stub",
  absolutePatientReportUrl: (origin: string, token: string) => `${origin}/patient/report/${token}`,
}));

const createDelivery = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const findExistingSuccessfulDelivery = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const getDeliveryById = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const markDeliveryFailed = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const markDeliverySent = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const recordDeliveryReportProvenance = jest.fn<(...a: unknown[]) => Promise<unknown>>();
// A real class (not a jest.fn) — sendPatientLink.ts does `err instanceof
// DeliveryRaceLostError`, which needs a real constructor to check against.
class DeliveryRaceLostError extends Error {
  constructor(public existingDeliveryId: string) {
    super("race lost");
  }
}
jest.mock("../../apps/patient-portal/src/lib/delivery/deliveryStore", () => ({
  createDelivery: (...a: unknown[]) => createDelivery(...a),
  findExistingSuccessfulDelivery: (...a: unknown[]) => findExistingSuccessfulDelivery(...a),
  getDeliveryById: (...a: unknown[]) => getDeliveryById(...a),
  markDeliveryFailed: (...a: unknown[]) => markDeliveryFailed(...a),
  markDeliverySent: (...a: unknown[]) => markDeliverySent(...a),
  recordDeliveryReportProvenance: (...a: unknown[]) => recordDeliveryReportProvenance(...a),
  DeliveryRaceLostError,
}));

const getWhatsappProvider = jest.fn<(...a: unknown[]) => unknown>();
const normaliseWhatsappNumber = jest.fn<(...a: unknown[]) => unknown>();
jest.mock("../../apps/patient-portal/src/lib/delivery/whatsappProvider", () => ({
  getWhatsappProvider: (...a: unknown[]) => getWhatsappProvider(...a),
  normaliseWhatsappNumber: (...a: unknown[]) => normaliseWhatsappNumber(...a),
}));

const resolveWhatsAppSender = jest.fn<(...a: unknown[]) => unknown>();
jest.mock("../../apps/patient-portal/src/lib/delivery/whatsappSender", () => ({
  resolveWhatsAppSender: (...a: unknown[]) => resolveWhatsAppSender(...a),
}));

const loadApprovedOnePagerImage = jest.fn<(...a: unknown[]) => Promise<unknown>>();
jest.mock("../../apps/patient-portal/src/lib/delivery/onePagerImage", () => ({
  loadApprovedOnePagerImage: (...a: unknown[]) => loadApprovedOnePagerImage(...a),
}));

const getPatientWhatsappConsent = jest.fn<(...a: unknown[]) => Promise<unknown>>();
jest.mock("@/lib/patient/whatsappConsent", () => ({
  getPatientWhatsappConsent: (...a: unknown[]) => getPatientWhatsappConsent(...a),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sendPatientLink } = require("../../apps/patient-portal/src/lib/delivery/sendPatientLink");

const BASE_INPUT = {
  assessmentId: "asm-1",
  clinicId: "clinic-1",
  subject: "REPORT" as const,
  patientPhone: "9900000000",
  patientFirstName: "Asha",
  doctorName: "Dr A",
  clinicName: "DrFACT Mumbai",
  product: "HAIR" as const,
  sentByDoctorId: "doc-1",
  actorUserId: "auth-1",
  actorType: "doctor" as const,
  origin: "https://app.example.com",
  consultationVersionId: "cv-1",
  patientId: "pat-1",
  clinicWhatsappSettings: null,
};

const LIVE_PROVIDER = {
  name: "meta_cloud",
  live: true,
  send: jest.fn<(...a: unknown[]) => Promise<unknown>>(),
};

beforeEach(() => {
  jest.clearAllMocks();
  normaliseWhatsappNumber.mockImplementation((raw: unknown) => (raw ? "919900000000" : null));
  getPatientWhatsappConsent.mockResolvedValue({ consent: true, consentAt: "2026-09-08T00:00:00.000Z", consentSource: "intake", provisioned: true });
  findExistingSuccessfulDelivery.mockResolvedValue(null);
  loadApprovedOnePagerImage.mockResolvedValue({ ok: false, reason: "not_requested", assetId: null });
  createDelivery.mockResolvedValue({ id: "delivery-1", status: "PENDING" });
  markDeliverySent.mockResolvedValue({ id: "delivery-1", status: "SENT" });
  markDeliveryFailed.mockResolvedValue({ id: "delivery-1", status: "FAILED" });
  recordDeliveryReportProvenance.mockResolvedValue(undefined);
  resolveWhatsAppSender.mockReturnValue({ ok: true, sender: { key: "CENTRAL", phoneNumberId: "p", accessToken: "t", apiVersion: "v21.0" } });
  getWhatsappProvider.mockReturnValue(LIVE_PROVIDER);
  LIVE_PROVIDER.send.mockResolvedValue({ status: "ACCEPTED", providerMessageId: "wamid.1", providerStatus: "accepted" });
});

describe("consent gate — checked before the provider is ever touched", () => {
  it("blocks the send and never calls the provider when consent is false", async () => {
    getPatientWhatsappConsent.mockResolvedValue({ consent: false, consentAt: null, consentSource: null, provisioned: true });

    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; reason?: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_consent");
    expect(LIVE_PROVIDER.send).not.toHaveBeenCalled();
    expect(markDeliveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: "BLOCKED_NO_CONSENT" }),
    );
  });

  it("blocks the send when there is no patientId to check consent for", async () => {
    const result = (await sendPatientLink({ ...BASE_INPUT, patientId: null })) as { ok: boolean; reason?: string };
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_consent");
    expect(LIVE_PROVIDER.send).not.toHaveBeenCalled();
  });

  it("proceeds to the provider when consent is true", async () => {
    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(LIVE_PROVIDER.send).toHaveBeenCalledTimes(1);
  });

  it("can still be clinically approved and sent later — consent only blocks THIS call, not approval", async () => {
    // No approval-coupling exists in this module at all: it has no code path
    // that touches approval state. Documented here as the property this
    // architecture guarantees by construction — approval lives entirely in
    // /api/consultation/[id]/order, which this function is never called from
    // on failure.
    getPatientWhatsappConsent.mockResolvedValue({ consent: false, consentAt: null, consentSource: null, provisioned: true });
    await sendPatientLink(BASE_INPUT);
    getPatientWhatsappConsent.mockResolvedValue({ consent: true, consentAt: "now", consentSource: "doctor_workspace_manual", provisioned: true });
    const second = (await sendPatientLink(BASE_INPUT)) as { ok: boolean };
    expect(second.ok).toBe(true);
  });
});

describe("idempotency — a duplicate successful send never reaches the provider twice", () => {
  it("short-circuits and reuses the existing delivery when one already succeeded for this exact version", async () => {
    findExistingSuccessfulDelivery.mockResolvedValue({ id: "delivery-0", status: "SENT" });

    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; alreadySent?: boolean; delivery?: { id: string } };

    expect(result.ok).toBe(true);
    expect(result.alreadySent).toBe(true);
    expect(result.delivery?.id).toBe("delivery-0");
    expect(LIVE_PROVIDER.send).not.toHaveBeenCalled();
    expect(createDelivery).not.toHaveBeenCalled();
  });

  it("a genuinely new send (no prior success for this version) proceeds normally", async () => {
    findExistingSuccessfulDelivery.mockResolvedValue(null);
    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; alreadySent?: boolean };
    expect(result.ok).toBe(true);
    expect(result.alreadySent).toBe(false);
    expect(LIVE_PROVIDER.send).toHaveBeenCalledTimes(1);
  });

  it("does not even ask about idempotency when there is no consultationVersionId (e.g. CART)", async () => {
    await sendPatientLink({ ...BASE_INPUT, subject: "CART", consultationVersionId: null });
    expect(findExistingSuccessfulDelivery).not.toHaveBeenCalled();
  });
});

describe("CONFIGURATION_ERROR — recorded honestly, never a false success", () => {
  it("marks the delivery CONFIGURATION_ERROR and returns ok:false when the provider reports it", async () => {
    LIVE_PROVIDER.send.mockResolvedValue({
      status: "CONFIGURATION_ERROR",
      providerMessageId: null,
      providerStatus: null,
      error: "whatsapp_provider_not_configured",
    });

    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; reason?: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("configuration_error");
    expect(markDeliveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CONFIGURATION_ERROR" }),
    );
    expect(markDeliverySent).not.toHaveBeenCalled();
  });

  it("a genuine provider FAILED is recorded as FAILED, not CONFIGURATION_ERROR", async () => {
    LIVE_PROVIDER.send.mockResolvedValue({
      status: "FAILED",
      providerMessageId: null,
      providerStatus: "http_500",
      error: "whatsapp_send_failed_http_500",
    });
    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; reason?: string };
    expect(result.reason).toBe("send_failed");
    expect(markDeliveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILED" }),
    );
  });
});

describe("retry after a retryable failure — a later attempt can still succeed", () => {
  it("a FAILED send does not get short-circuited by idempotency, and a subsequent attempt succeeds", async () => {
    // First attempt: the transport is down.
    LIVE_PROVIDER.send.mockResolvedValueOnce({
      status: "FAILED",
      providerMessageId: null,
      providerStatus: "http_503",
      error: "whatsapp_send_failed_http_503",
    });
    const first = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; reason?: string };
    expect(first.ok).toBe(false);
    expect(first.reason).toBe("send_failed");

    // Idempotency only short-circuits a PRIOR SUCCESS (see
    // findExistingSuccessfulDelivery) — a FAILED attempt leaves no successful
    // delivery behind, so the retry is free to reach the provider again.
    findExistingSuccessfulDelivery.mockResolvedValue(null);
    LIVE_PROVIDER.send.mockResolvedValueOnce({
      status: "ACCEPTED",
      providerMessageId: "wamid.retry-1",
      providerStatus: "accepted",
    });
    const second = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; alreadySent?: boolean };
    expect(second.ok).toBe(true);
    expect(second.alreadySent).toBe(false);
    expect(LIVE_PROVIDER.send).toHaveBeenCalledTimes(2);
    expect(markDeliverySent).toHaveBeenCalled();
  });

  it("CONFIGURATION_ERROR is never retried automatically by this function — the caller decides, and a fixed config succeeds on the next explicit call", async () => {
    getWhatsappProvider.mockReturnValueOnce({
      name: "meta_cloud",
      live: true,
      send: jest.fn<(...a: unknown[]) => Promise<unknown>>().mockResolvedValue({
        status: "CONFIGURATION_ERROR",
        providerMessageId: null,
        providerStatus: null,
        error: "whatsapp_provider_not_configured",
      }),
    });
    const first = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; reason?: string };
    expect(first.reason).toBe("configuration_error");

    // Operator fixes the deployment — sender now resolves, and this exact
    // shape of call (the UI's "Retry" is just calling sendPatientLink again)
    // succeeds.
    getWhatsappProvider.mockReturnValue(LIVE_PROVIDER);
    LIVE_PROVIDER.send.mockResolvedValueOnce({
      status: "ACCEPTED",
      providerMessageId: "wamid.retry-2",
      providerStatus: "accepted",
    });
    const second = (await sendPatientLink(BASE_INPUT)) as { ok: boolean };
    expect(second.ok).toBe(true);
  });
});

describe("DeliveryRaceLostError — a concurrent duplicate must never reach the provider twice", () => {
  it("a race loss whose winner already succeeded is reported as alreadySent, and the provider is never called", async () => {
    createDelivery.mockRejectedValueOnce(new DeliveryRaceLostError("delivery-winner"));
    getDeliveryById.mockResolvedValue({
      id: "delivery-winner",
      status: "SENT",
      assessmentId: "asm-1",
      subject: "REPORT",
    });

    const result = (await sendPatientLink(BASE_INPUT)) as {
      ok: boolean;
      alreadySent: boolean;
      delivery: { id: string };
    };
    expect(result.ok).toBe(true);
    expect(result.alreadySent).toBe(true);
    expect(result.delivery.id).toBe("delivery-winner");
    expect(LIVE_PROVIDER.send).not.toHaveBeenCalled();
  });

  it("a race loss whose winner ended CONFIGURATION_ERROR is reported honestly, not as a false success", async () => {
    createDelivery.mockRejectedValueOnce(new DeliveryRaceLostError("delivery-winner"));
    getDeliveryById.mockResolvedValue({
      id: "delivery-winner",
      status: "CONFIGURATION_ERROR",
      assessmentId: "asm-1",
      subject: "REPORT",
    });

    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; reason?: string };
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("configuration_error");
    expect(LIVE_PROVIDER.send).not.toHaveBeenCalled();
  });

  it("a race loss that is still PENDING after the poll window is treated as already handled, never retried into the same conflict", async () => {
    createDelivery.mockRejectedValueOnce(new DeliveryRaceLostError("delivery-winner"));
    getDeliveryById.mockResolvedValue({
      id: "delivery-winner",
      status: "PENDING",
      assessmentId: "asm-1",
      subject: "REPORT",
    });

    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean; alreadySent: boolean };
    expect(result.ok).toBe(true);
    expect(result.alreadySent).toBe(true);
    expect(LIVE_PROVIDER.send).not.toHaveBeenCalled();
    expect(createDelivery).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("a genuine, unrelated createDelivery failure is NOT swallowed as a race loss", async () => {
    createDelivery.mockRejectedValueOnce(new Error("connection reset"));
    await expect(sendPatientLink(BASE_INPUT)).rejects.toThrow("connection reset");
  });
});

describe("no_phone — no row written for a number that was never real", () => {
  it("refuses before creating any delivery record", async () => {
    normaliseWhatsappNumber.mockReturnValue(null);
    const result = (await sendPatientLink({ ...BASE_INPUT, patientPhone: null })) as {
      ok: boolean;
      reason?: string;
      delivery: unknown;
    };
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_phone");
    expect(result.delivery).toBeNull();
    expect(createDelivery).not.toHaveBeenCalled();
  });
});

// ── P0-D: Template parameter validation — fail closed before touching Meta ──

describe("REPORT template body parameters — fail closed on missing required fields (P0-D)", () => {
  // Activate the REPORT template so the validation path is exercised.
  const TEMPLATE_ENV_KEY = "WHATSAPP_TEMPLATE_REPORT";
  beforeEach(() => {
    process.env[TEMPLATE_ENV_KEY] = "drfact_report_ready_v1";
  });
  afterEach(() => {
    delete process.env[TEMPLATE_ENV_KEY];
  });

  it("fails the delivery and never calls the provider when doctorName is missing", async () => {
    const result = (await sendPatientLink({
      ...BASE_INPUT,
      doctorName: null,
    })) as { ok: boolean; reason?: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("send_failed");
    expect(LIVE_PROVIDER.send).not.toHaveBeenCalled();
    expect(markDeliveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILED", error: expect.stringContaining("doctor_name") }),
    );
  });

  it("fails the delivery and never calls the provider when clinicName is missing", async () => {
    const result = (await sendPatientLink({
      ...BASE_INPUT,
      clinicName: null,
    })) as { ok: boolean; reason?: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("send_failed");
    expect(LIVE_PROVIDER.send).not.toHaveBeenCalled();
    expect(markDeliveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILED", error: expect.stringContaining("clinic_name") }),
    );
  });

  it("fails closed — markDeliverySent is never called when body param validation fails", async () => {
    await sendPatientLink({ ...BASE_INPUT, doctorName: null });
    expect(markDeliverySent).not.toHaveBeenCalled();
  });

  it("succeeds and calls the provider when all five required fields are present", async () => {
    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(LIVE_PROVIDER.send).toHaveBeenCalledTimes(1);
    // The provider call must include templateBodyParameters with 5 entries
    const callArg = LIVE_PROVIDER.send.mock.calls[0]![0] as {
      templateBodyParameters: string[] | null;
    };
    expect(callArg.templateBodyParameters).toHaveLength(5);
  });

  it("uses the governed fallback 'there' for a missing patient first name — send still proceeds", async () => {
    const result = (await sendPatientLink({
      ...BASE_INPUT,
      patientFirstName: null,
    })) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(LIVE_PROVIDER.send).toHaveBeenCalledTimes(1);
    const callArg = LIVE_PROVIDER.send.mock.calls[0]![0] as {
      templateBodyParameters: string[];
    };
    expect(callArg.templateBodyParameters[0]).toBe("there");
  });

  it("CART subject never passes body parameters — zero body params for CART is valid", async () => {
    const result = (await sendPatientLink({
      ...BASE_INPUT,
      subject: "CART",
      consultationVersionId: null,
    })) as { ok: boolean };

    expect(result.ok).toBe(true);
    const callArg = LIVE_PROVIDER.send.mock.calls[0]![0] as {
      templateBodyParameters: string[] | null;
    };
    expect(callArg.templateBodyParameters).toBeNull();
  });

  it("no WHATSAPP_TEMPLATE_REPORT configured → no body params passed, send proceeds normally", async () => {
    delete process.env[TEMPLATE_ENV_KEY];
    const result = (await sendPatientLink(BASE_INPUT)) as { ok: boolean };
    expect(result.ok).toBe(true);
    const callArg = LIVE_PROVIDER.send.mock.calls[0]![0] as {
      templateBodyParameters: string[] | null;
    };
    // Template is null, so body params are null — no validation runs
    expect(callArg.templateBodyParameters).toBeNull();
  });
});

describe("live vs test transport is always distinguishable", () => {
  it("reports live:false for the dev transport, live:true for meta_cloud", async () => {
    getWhatsappProvider.mockReturnValue({ name: "dev", live: false, send: jest.fn().mockResolvedValue({ status: "ACCEPTED", providerMessageId: "dev_1", providerStatus: "dev_accepted" }) });
    const devResult = (await sendPatientLink(BASE_INPUT)) as { live: boolean };
    expect(devResult.live).toBe(false);

    getWhatsappProvider.mockReturnValue(LIVE_PROVIDER);
    const liveResult = (await sendPatientLink(BASE_INPUT)) as { live: boolean };
    expect(liveResult.live).toBe(true);
  });
});
