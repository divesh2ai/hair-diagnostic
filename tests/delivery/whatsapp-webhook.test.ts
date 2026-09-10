import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isKnownStatusProvider,
  parseMetaStatusEvents,
  verifyWhatsappWebhookSignature,
} from "@/lib/delivery/whatsappWebhook";

// Provider status callbacks — authenticity and idempotent-safe parsing.
// (deliveryStore.markProviderStatus's own COALESCE-based idempotency is
// unchanged by this feature and is exercised by the wiring in the route
// itself; this suite covers the two pure functions that gate what reaches it.)

const SECRET = "test-webhook-secret";

beforeEach(() => {
  process.env.WHATSAPP_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
});

function sign(body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
}

describe("signature verification — fails closed on every ambiguity", () => {
  it("accepts a genuine signature", () => {
    const body = JSON.stringify({ hello: "world" });
    const headers = new Headers({ "x-hub-signature-256": sign(body) });
    expect(verifyWhatsappWebhookSignature("meta_cloud", body, headers)).toEqual({ ok: true });
  });

  it("rejects an unknown provider before touching the secret", () => {
    const r = verifyWhatsappWebhookSignature("twilio", "{}", new Headers());
    expect(r).toEqual({ ok: false, reason: "unknown_provider" });
  });

  it("rejects when no secret is configured", () => {
    delete process.env.WHATSAPP_WEBHOOK_SECRET;
    const body = "{}";
    const headers = new Headers({ "x-hub-signature-256": sign(body) });
    expect(verifyWhatsappWebhookSignature("meta_cloud", body, headers)).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("rejects a missing signature header", () => {
    expect(verifyWhatsappWebhookSignature("meta_cloud", "{}", new Headers())).toEqual({
      ok: false,
      reason: "missing_signature",
    });
  });

  it("rejects a tampered body", () => {
    const signed = sign(JSON.stringify({ a: 1 }));
    const headers = new Headers({ "x-hub-signature-256": signed });
    const r = verifyWhatsappWebhookSignature("meta_cloud", JSON.stringify({ a: 2 }), headers);
    expect(r).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("tolerates a bare digest without the sha256= prefix", () => {
    const body = "{}";
    const bare = createHmac("sha256", SECRET).update(body).digest("hex");
    const headers = new Headers({ "x-hub-signature-256": bare });
    expect(verifyWhatsappWebhookSignature("meta_cloud", body, headers)).toEqual({ ok: true });
  });

  it("does not throw on a signature of a different length (would crash timingSafeEqual unguarded)", () => {
    const headers = new Headers({ "x-hub-signature-256": "sha256=short" });
    expect(() => verifyWhatsappWebhookSignature("meta_cloud", "{}", headers)).not.toThrow();
    expect(verifyWhatsappWebhookSignature("meta_cloud", "{}", headers).ok).toBe(false);
  });
});

describe("isKnownStatusProvider", () => {
  it("only meta_cloud is known today", () => {
    expect(isKnownStatusProvider("meta_cloud")).toBe(true);
    expect(isKnownStatusProvider("twilio")).toBe(false);
  });
});

describe("parseMetaStatusEvents — total, never throws on an unrecognised shape", () => {
  it("extracts sent/delivered/read/failed events with their message id", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.1", status: "sent" },
                  { id: "wamid.1", status: "delivered" },
                  { id: "wamid.2", status: "read" },
                  { id: "wamid.3", status: "failed" },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseMetaStatusEvents(body);
    expect(events).toEqual([
      { messageId: "wamid.1", status: "sent", raw: "sent" },
      { messageId: "wamid.1", status: "delivered", raw: "delivered" },
      { messageId: "wamid.2", status: "read", raw: "read" },
      { messageId: "wamid.3", status: "failed", raw: "failed" },
    ]);
  });

  it("drops an unrecognised status rather than guessing it means delivered", () => {
    const body = {
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1", status: "deleted" }] } }] }],
    };
    expect(parseMetaStatusEvents(body)).toEqual([]);
  });

  it("returns an empty array for a shape it does not recognise at all, never throws", () => {
    expect(parseMetaStatusEvents({ some: "other webhook payload" })).toEqual([]);
    expect(parseMetaStatusEvents(null)).toEqual([]);
    expect(parseMetaStatusEvents(undefined)).toEqual([]);
    expect(() => parseMetaStatusEvents("not even an object")).not.toThrow();
  });

  it("skips a status entry missing an id or a status string", () => {
    const body = {
      entry: [
        {
          changes: [
            { value: { statuses: [{ status: "sent" }, { id: "wamid.1" }, { id: "wamid.2", status: "read" }] } },
          ],
        },
      ],
    };
    expect(parseMetaStatusEvents(body)).toEqual([{ messageId: "wamid.2", status: "read", raw: "read" }]);
  });
});
