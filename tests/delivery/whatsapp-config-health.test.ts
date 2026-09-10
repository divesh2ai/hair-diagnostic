import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkWhatsappConfig } from "../../apps/patient-portal/src/lib/delivery/whatsappConfigHealth";

// The health check must answer exactly one operational question — READY or
// CONFIGURATION_ERROR — and never leak a credential value, only the NAMES of
// settings that are missing. See whatsappConfigHealth.ts for the contract.

const ENV_KEYS = [
  "WHATSAPP_PROVIDER",
  "WHATSAPP_LIVE_SEND",
  "NODE_ENV",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_TEMPLATE_REPORT",
  "WHATSAPP_WEBHOOK_SECRET",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("checkWhatsappConfig — dev / not-yet-live deployments", () => {
  it("is READY on the dev transport when live sending is not selected at all", () => {
    const result = checkWhatsappConfig();
    expect(result).toEqual({ status: "READY", missing: [], transport: "dev" });
  });

  it("is READY on the dev transport when meta_cloud is selected but WHATSAPP_LIVE_SEND is not '1'", () => {
    process.env.WHATSAPP_PROVIDER = "meta_cloud";
    process.env.NODE_ENV = "production";
    const result = checkWhatsappConfig();
    expect(result.status).toBe("READY");
    expect(result.transport).toBe("dev");
  });

  it("is READY on the dev transport when authorised but NODE_ENV is not production", () => {
    process.env.WHATSAPP_PROVIDER = "meta_cloud";
    process.env.WHATSAPP_LIVE_SEND = "1";
    process.env.NODE_ENV = "development";
    const result = checkWhatsappConfig();
    expect(result.status).toBe("READY");
    expect(result.transport).toBe("dev");
  });
});

describe("checkWhatsappConfig — live meta_cloud deployments", () => {
  function authoriseLive() {
    process.env.WHATSAPP_PROVIDER = "meta_cloud";
    process.env.WHATSAPP_LIVE_SEND = "1";
    process.env.NODE_ENV = "production";
  }

  it("is CONFIGURATION_ERROR, naming every missing setting, when nothing is configured", () => {
    authoriseLive();
    const result = checkWhatsappConfig();
    expect(result.status).toBe("CONFIGURATION_ERROR");
    expect(result.transport).toBe("meta_cloud");
    expect(result.missing).toEqual(
      expect.arrayContaining([
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_TEMPLATE_REPORT",
        "WHATSAPP_WEBHOOK_SECRET",
        "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
      ]),
    );
  });

  it("is CONFIGURATION_ERROR when the sender is configured but the webhook secret is not", () => {
    authoriseLive();
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_TEMPLATE_REPORT = "report_v1";
    const result = checkWhatsappConfig();
    expect(result.status).toBe("CONFIGURATION_ERROR");
    expect(result.missing).toEqual(["WHATSAPP_WEBHOOK_SECRET", "WHATSAPP_WEBHOOK_VERIFY_TOKEN"]);
  });

  it("is READY when the central sender, template and webhook contract are all present", () => {
    authoriseLive();
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_TEMPLATE_REPORT = "report_v1";
    process.env.WHATSAPP_WEBHOOK_SECRET = "secret";
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "verify";
    const result = checkWhatsappConfig();
    expect(result).toEqual({ status: "READY", missing: [], transport: "meta_cloud" });
  });

  it("never returns anything that looks like a credential value — only status, transport and setting NAMES", () => {
    authoriseLive();
    process.env.WHATSAPP_PHONE_NUMBER_ID = "super-secret-phone-id-123";
    process.env.WHATSAPP_ACCESS_TOKEN = "super-secret-token-abc";
    process.env.WHATSAPP_TEMPLATE_REPORT = "report_v1";
    process.env.WHATSAPP_WEBHOOK_SECRET = "super-secret-webhook-key";
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "super-secret-verify-token";
    const serialised = JSON.stringify(checkWhatsappConfig());
    expect(serialised).not.toContain("super-secret");
  });
});
