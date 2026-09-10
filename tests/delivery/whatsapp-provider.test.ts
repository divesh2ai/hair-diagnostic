import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWhatsappProvider,
  normaliseWhatsappNumber,
} from "@/lib/delivery/whatsappProvider";
import type { WhatsAppSenderResolution } from "@/lib/delivery/whatsappSender";

// The provider selection switches — no false success ever, and
// CONFIGURATION_ERROR is a genuinely distinct outcome from FAILED.

const ENV_KEYS = ["WHATSAPP_PROVIDER", "WHATSAPP_LIVE_SEND", "NODE_ENV"] as const;
const originalEnv: Record<string, string | undefined> = {};

const RESOLVED: WhatsAppSenderResolution = {
  ok: true,
  sender: { key: "CENTRAL", phoneNumberId: "phone-1", accessToken: "token-1", apiVersion: "v21.0" },
};
const UNRESOLVED: WhatsAppSenderResolution = { ok: false, reason: "no_credentials_configured" };

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("selection — the two switches", () => {
  it("defaults to the dev transport when WHATSAPP_PROVIDER is unset", () => {
    delete process.env.WHATSAPP_PROVIDER;
    const provider = getWhatsappProvider(RESOLVED);
    expect(provider.name).toBe("dev");
    expect(provider.live).toBe(false);
  });

  it("stays on dev when meta_cloud is selected but live sending is not authorised", () => {
    process.env.WHATSAPP_PROVIDER = "meta_cloud";
    process.env.WHATSAPP_LIVE_SEND = "0";
    process.env.NODE_ENV = "production";
    const provider = getWhatsappProvider(RESOLVED);
    expect(provider.name).toBe("dev");
  });

  it("stays on dev when authorised but NODE_ENV is not production", () => {
    process.env.WHATSAPP_PROVIDER = "meta_cloud";
    process.env.WHATSAPP_LIVE_SEND = "1";
    process.env.NODE_ENV = "test";
    const provider = getWhatsappProvider(RESOLVED);
    expect(provider.name).toBe("dev");
  });

  it("the dev transport never claims a real send happened", async () => {
    delete process.env.WHATSAPP_PROVIDER;
    const provider = getWhatsappProvider(RESOLVED);
    const result = await provider.send({ to: "919900000000", body: "hi" });
    expect(result.status).toBe("ACCEPTED");
    expect(provider.live).toBe(false); // the caller can always tell dev apart from a genuine send
  });
});

describe("CONFIGURATION_ERROR — distinct from FAILED, never a false success", () => {
  it("reports CONFIGURATION_ERROR, not ACCEPTED, when live and selected but no sender resolved", async () => {
    process.env.WHATSAPP_PROVIDER = "meta_cloud";
    process.env.WHATSAPP_LIVE_SEND = "1";
    process.env.NODE_ENV = "production";
    const provider = getWhatsappProvider(UNRESOLVED);
    expect(provider.live).toBe(true); // it is the "real" provider, honestly reporting it cannot send
    const result = await provider.send({ to: "919900000000", body: "hi" });
    expect(result.status).toBe("CONFIGURATION_ERROR");
    expect(result.providerMessageId).toBeNull();
  });
});

describe("meta_cloud — a real HTTP call, no fabricated success", () => {
  function activateLiveMeta() {
    process.env.WHATSAPP_PROVIDER = "meta_cloud";
    process.env.WHATSAPP_LIVE_SEND = "1";
    process.env.NODE_ENV = "production";
    return getWhatsappProvider(RESOLVED);
  }

  it("returns ACCEPTED with the provider's own message id on HTTP 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.ABC123" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = activateLiveMeta();
    const result = await provider.send({ to: "919900000000", body: "hi" });

    expect(result.status).toBe("ACCEPTED");
    expect(result.providerMessageId).toBe("wamid.ABC123");
    // Called the sender's OWN phone number id, not a hardcoded one.
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/phone-1/messages");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer token-1" });
  });

  it("returns FAILED, never ACCEPTED, on a non-2xx HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );
    const provider = activateLiveMeta();
    const result = await provider.send({ to: "919900000000", body: "hi" });
    expect(result.status).toBe("FAILED");
    expect(result.providerMessageId).toBeNull();
  });

  it("returns FAILED, never ACCEPTED, on a network/transport error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const provider = activateLiveMeta();
    const result = await provider.send({ to: "919900000000", body: "hi" });
    expect(result.status).toBe("FAILED");
  });
});

// ── P0-F: Meta request body — BODY component shape ───────────────────────────
//
// These tests intercept the actual fetch call and assert that the JSON
// payload sent to Meta Cloud contains the correct BODY component when
// templateBodyParameters are supplied. They are the sole source of truth for
// the wire format — not a helper's return value, not a TypeScript type, but
// the bytes that would travel over the network.

describe("meta_cloud — BODY component in template payload (P0-F)", () => {
  const LOCALE_KEYS = ["WHATSAPP_TEMPLATE_LOCALE"] as const;
  beforeEach(() => {
    for (const k of LOCALE_KEYS) originalEnv[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of LOCALE_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  function activateLiveMeta() {
    process.env.WHATSAPP_PROVIDER = "meta_cloud";
    process.env.WHATSAPP_LIVE_SEND = "1";
    process.env.NODE_ENV = "production";
    return getWhatsappProvider(RESOLVED);
  }

  function capturedBody(fetchMock: ReturnType<typeof vi.fn>): unknown {
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    return JSON.parse(init.body as string);
  }

  it("sends type=template with BODY component containing 5 parameters in exact order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.BODY_TEST" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = activateLiveMeta();
    await provider.send({
      to: "919900000000",
      body: "preview text (not sent to Meta)",
      templateId: "drfact_report_ready_v1",
      templateBodyParameters: [
        "Rahul",           // {{1}} patient first name
        "Hair",            // {{2}} assessment type
        "Aseem Sharma",    // {{3}} doctor display name
        "FACT Mumbai",     // {{4}} clinic display name
        "https://app.drfact.com/r/abc123",  // {{5}} secure report URL
      ],
    });

    const body = capturedBody(fetchMock) as {
      type: string;
      template: { name: string; language: { code: string }; components: unknown[] };
    };

    expect(body.type).toBe("template");
    expect(body.template.name).toBe("drfact_report_ready_v1");
    expect(body.template.language.code).toBe("en");

    const components = body.template.components;
    const bodyComp = components.find((c: unknown) => (c as { type: string }).type === "body") as {
      type: string;
      parameters: Array<{ type: string; text: string }>;
    } | undefined;

    expect(bodyComp).toBeDefined();
    expect(bodyComp!.parameters).toHaveLength(5);
    expect(bodyComp!.parameters[0]).toEqual({ type: "text", text: "Rahul" });
    expect(bodyComp!.parameters[1]).toEqual({ type: "text", text: "Hair" });
    expect(bodyComp!.parameters[2]).toEqual({ type: "text", text: "Aseem Sharma" });
    expect(bodyComp!.parameters[3]).toEqual({ type: "text", text: "FACT Mumbai" });
    expect(bodyComp!.parameters[4]).toEqual({ type: "text", text: "https://app.drfact.com/r/abc123" });
  });

  it("HEADER and BODY coexist when an image is attached — both present in components array", async () => {
    // A fetch mock that handles two calls: media upload, then messages.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "media-id-xyz" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: "wamid.HEADER_BODY" }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = activateLiveMeta();
    await provider.send({
      to: "919900000000",
      body: "preview",
      templateId: "drfact_report_ready_v1",
      templateBodyParameters: ["Rahul", "Hair", "Aseem Sharma", "FACT Mumbai", "https://x.com"],
      image: { data: new Uint8Array(10), mimeType: "image/png", filename: "report.png" },
    });

    // Second fetch is the /messages call
    const msgInit = fetchMock.mock.calls[1]![1] as RequestInit;
    const payload = JSON.parse(msgInit.body as string) as {
      template: { components: Array<{ type: string }> };
    };

    const types = payload.template.components.map((c) => c.type);
    expect(types).toContain("header");
    expect(types).toContain("body");
  });

  it("omits the components key entirely for a template with no body parameters and no image", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.NO_BODY" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = activateLiveMeta();
    await provider.send({
      to: "919900000000",
      body: "preview",
      templateId: "drfact_cart_v1",
      // no templateBodyParameters, no image
    });

    const payload = capturedBody(fetchMock) as { template: { components?: unknown } };
    expect(payload.template.components).toBeUndefined();
  });

  it("uses the WHATSAPP_TEMPLATE_LOCALE env var as the template language code", async () => {
    process.env.WHATSAPP_TEMPLATE_LOCALE = "hi";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.HI" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = activateLiveMeta();
    await provider.send({ to: "919900000000", body: "hi", templateId: "drfact_report_ready_v1" });

    const payload = capturedBody(fetchMock) as { template: { language: { code: string } } };
    expect(payload.template.language.code).toBe("hi");
  });
});

// ── P0-G: Negative tests — Meta rejection never becomes SENT ─────────────────

describe("meta_cloud — provider HTTP errors never become SENT (P0-G)", () => {
  function activateLiveMeta() {
    process.env.WHATSAPP_PROVIDER = "meta_cloud";
    process.env.WHATSAPP_LIVE_SEND = "1";
    process.env.NODE_ENV = "production";
    return getWhatsappProvider(RESOLVED);
  }

  it("HTTP 400 (bad template params) → FAILED, never ACCEPTED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) }));
    const result = await activateLiveMeta().send({ to: "919900000000", body: "x", templateId: "drfact_report_ready_v1" });
    expect(result.status).toBe("FAILED");
    expect(result.providerStatus).toBe("http_400");
    expect(result.providerMessageId).toBeNull();
  });

  it("HTTP 401 (bad access token) → FAILED, never ACCEPTED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    const result = await activateLiveMeta().send({ to: "919900000000", body: "x" });
    expect(result.status).toBe("FAILED");
    expect(result.providerStatus).toBe("http_401");
  });

  it("HTTP 403 (permission denied) → FAILED, never ACCEPTED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
    const result = await activateLiveMeta().send({ to: "919900000000", body: "x" });
    expect(result.status).toBe("FAILED");
    expect(result.providerStatus).toBe("http_403");
  });

  it("HTTP 200 with messages[0].id → ACCEPTED with the provider id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.OK" }] }) }));
    const result = await activateLiveMeta().send({ to: "919900000000", body: "x" });
    expect(result.status).toBe("ACCEPTED");
    expect(result.providerMessageId).toBe("wamid.OK");
  });

  it("network transport failure → FAILED, never ACCEPTED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ENETDOWN")));
    const result = await activateLiveMeta().send({ to: "919900000000", body: "x" });
    expect(result.status).toBe("FAILED");
    expect(result.providerMessageId).toBeNull();
  });
});

describe("normaliseWhatsappNumber — never a best guess", () => {
  it("assumes the 10-digit Indian mobile form only when the length is exactly 10", () => {
    expect(normaliseWhatsappNumber("9876543210")).toBe("919876543210");
  });
  it("passes through an already-international number unchanged", () => {
    expect(normaliseWhatsappNumber("919876543210")).toBe("919876543210");
  });
  it("returns null for anything unrecognisable rather than fixing it", () => {
    expect(normaliseWhatsappNumber("123")).toBeNull();
    expect(normaliseWhatsappNumber(null)).toBeNull();
    expect(normaliseWhatsappNumber("")).toBeNull();
  });
});
