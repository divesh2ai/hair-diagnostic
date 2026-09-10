import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveWhatsAppSender } from "@/lib/delivery/whatsappSender";

// Multi-clinic sender resolution — the central Dr FACT number by default,
// with an explicit, narrow escape hatch to a clinic-specific one.

const ENV_KEYS = [
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_API_VERSION",
  "WHATSAPP_SENDER_CLINIC_A_PHONE_NUMBER_ID",
  "WHATSAPP_SENDER_CLINIC_A_ACCESS_TOKEN",
] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("central sender — the default for every clinic", () => {
  it("Clinic A resolves the central sender when no whatsappSettings exist at all", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "central-phone-id";
    process.env.WHATSAPP_ACCESS_TOKEN = "central-token";
    const r = resolveWhatsAppSender(null);
    expect(r).toEqual({
      ok: true,
      sender: { key: "CENTRAL", phoneNumberId: "central-phone-id", accessToken: "central-token", apiVersion: "v21.0" },
    });
  });

  it("Clinic B, a totally different clinic, resolves the SAME central sender", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "central-phone-id";
    process.env.WHATSAPP_ACCESS_TOKEN = "central-token";
    const a = resolveWhatsAppSender({ businessName: "Clinic A" });
    const b = resolveWhatsAppSender({ businessName: "Clinic B", senderMode: "CENTRAL" });
    expect(a).toEqual(b);
    expect(a.ok && a.sender.key).toBe("CENTRAL");
  });

  it("honours a custom WHATSAPP_API_VERSION for the central sender", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "central-phone-id";
    process.env.WHATSAPP_ACCESS_TOKEN = "central-token";
    process.env.WHATSAPP_API_VERSION = "v22.0";
    const r = resolveWhatsAppSender(null);
    expect(r.ok && r.sender.apiVersion).toBe("v22.0");
  });
});

describe("clinic-specific sender — explicit opt-in only", () => {
  it("a clinic configured onto its own sender resolves it, not central", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "central-phone-id";
    process.env.WHATSAPP_ACCESS_TOKEN = "central-token";
    process.env.WHATSAPP_SENDER_CLINIC_A_PHONE_NUMBER_ID = "clinic-a-phone-id";
    process.env.WHATSAPP_SENDER_CLINIC_A_ACCESS_TOKEN = "clinic-a-token";

    const r = resolveWhatsAppSender({ senderMode: "CLINIC_SPECIFIC", senderKey: "clinic-a" });
    expect(r).toEqual({
      ok: true,
      sender: {
        key: "CLINIC_A",
        phoneNumberId: "clinic-a-phone-id",
        accessToken: "clinic-a-token",
        apiVersion: "v21.0",
      },
    });
  });

  it("a clinic-specific sender configured but credentials missing falls back to central", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "central-phone-id";
    process.env.WHATSAPP_ACCESS_TOKEN = "central-token";
    // No WHATSAPP_SENDER_CLINIC_A_* set.
    const r = resolveWhatsAppSender({ senderMode: "CLINIC_SPECIFIC", senderKey: "clinic-a" });
    expect(r.ok && r.sender.key).toBe("CENTRAL");
  });

  it("no cross-clinic leakage: Clinic A's key never resolves Clinic B's credentials", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "central-phone-id";
    process.env.WHATSAPP_ACCESS_TOKEN = "central-token";
    process.env.WHATSAPP_SENDER_CLINIC_A_PHONE_NUMBER_ID = "clinic-a-phone-id";
    process.env.WHATSAPP_SENDER_CLINIC_A_ACCESS_TOKEN = "clinic-a-token";

    // Clinic B asks for a sender key that was never configured.
    const r = resolveWhatsAppSender({ senderMode: "CLINIC_SPECIFIC", senderKey: "clinic-b" });
    // Falls back to central — it can NEVER resolve to clinic-a's credentials.
    expect(r.ok && r.sender.key).toBe("CENTRAL");
    expect(r.ok && r.sender.phoneNumberId).not.toBe("clinic-a-phone-id");
  });

  it("normalises a free-form sender key into a safe env-var segment", () => {
    process.env.WHATSAPP_SENDER_CLINIC_A_PHONE_NUMBER_ID = "clinic-a-phone-id";
    process.env.WHATSAPP_SENDER_CLINIC_A_ACCESS_TOKEN = "clinic-a-token";
    const r = resolveWhatsAppSender({ senderMode: "CLINIC_SPECIFIC", senderKey: "clinic a!" });
    expect(r.ok && r.sender.key).toBe("CLINIC_A");
  });
});

describe("configuration error — only when nothing resolves", () => {
  it("reports no_credentials_configured when central is also unset", () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const r = resolveWhatsAppSender(null);
    expect(r).toEqual({ ok: false, reason: "no_credentials_configured" });
  });

  it("reports the error even when a clinic-specific sender is requested but nothing resolves", () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_SENDER_CLINIC_A_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_SENDER_CLINIC_A_ACCESS_TOKEN;
    const r = resolveWhatsAppSender({ senderMode: "CLINIC_SPECIFIC", senderKey: "clinic-a" });
    expect(r.ok).toBe(false);
  });
});
