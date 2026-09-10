import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveWhatsappReportStatus,
  type WhatsappReportUiStatus,
} from "../../apps/patient-portal/src/lib/journey/resolveJourney";
import type { DeliveryRecord } from "../../apps/patient-portal/src/lib/delivery/deliveryStore";

// PHASE 3 of the Meta production readiness gate — the compact, persisted
// delivery status the doctor UI renders. Every one of the six real states
// (plus not_sent / unavailable) is pinned here, derived from the SAME
// DeliveryRecord shape deliveryStore reads off WhatsappDelivery — nothing is
// inferred, nothing is a second source.

function record(overrides: Partial<DeliveryRecord>): DeliveryRecord {
  return {
    id: "delivery-1",
    assessmentId: "asm-1",
    subject: "REPORT",
    status: "SENT",
    templateId: null,
    messageId: "wamid.1",
    providerStatus: "accepted",
    attempts: 1,
    lastError: null,
    sentByDoctorId: "doc-1",
    createdAt: "2026-09-08T00:00:00.000Z",
    sentAt: "2026-09-08T00:00:01.000Z",
    deliveredAt: null,
    readAt: null,
    ...overrides,
  };
}

describe("deriveWhatsappReportStatus — every state a doctor can actually see", () => {
  it("no delivery row at all → not_sent", () => {
    expect(deriveWhatsappReportStatus(null, true).status).toBe("not_sent");
    expect(deriveWhatsappReportStatus(undefined, true).status).toBe("not_sent");
  });

  it("the table could not be read at all → unavailable, distinct from not_sent", () => {
    const result = deriveWhatsappReportStatus(null, false);
    expect(result.status).toBe("unavailable");
    expect(result.status).not.toBe("not_sent");
  });

  it("dev transport, regardless of status, → test_delivery — NEVER 'sent'", () => {
    const sent = deriveWhatsappReportStatus(
      record({ status: "SENT", providerStatus: "dev_accepted", messageId: "dev_abc123" }),
      true,
    );
    expect(sent.status).toBe("test_delivery");

    // Defensive: even if a dev-originated row somehow carried timestamps
    // (it never can in practice — dev never triggers a real webhook), the
    // transport marker still wins over inferring delivered/read.
    const withTimestamps = deriveWhatsappReportStatus(
      record({
        status: "DELIVERED",
        providerStatus: "dev_accepted",
        messageId: "dev_abc123",
        deliveredAt: "2026-09-08T00:05:00.000Z",
        readAt: "2026-09-08T00:06:00.000Z",
      }),
      true,
    );
    expect(withTimestamps.status).toBe("test_delivery");
  });

  it("REGRESSION: dev transport is detected by messageId, NOT the mutable providerStatus column — a webhook overwriting providerStatus with its own raw word must not flip this to a live state", () => {
    // Caught live: markProviderStatus (deliveryStore.ts) rewrites
    // providerStatus to the webhook's raw status ("read"/"delivered") on
    // every callback. If detection used providerStatus, a dev-issued row
    // that somehow received a callback would misreport as read/delivered.
    const result = deriveWhatsappReportStatus(
      record({
        status: "DELIVERED",
        providerStatus: "read", // overwritten by a webhook, no longer "dev*"
        messageId: "dev_abc123", // never overwritten — the stable marker
        deliveredAt: "2026-09-08T00:05:00.000Z",
        readAt: "2026-09-08T00:06:00.000Z",
      }),
      true,
    );
    expect(result.status).toBe("test_delivery");
  });

  it("live SENT, no deliveredAt/readAt yet → sent", () => {
    const result = deriveWhatsappReportStatus(
      record({ status: "SENT", providerStatus: "accepted" }),
      true,
    );
    expect(result.status).toBe("sent");
  });

  it("live, deliveredAt set, no readAt → delivered — never claims 'read'", () => {
    const result = deriveWhatsappReportStatus(
      record({
        status: "DELIVERED",
        providerStatus: "accepted",
        deliveredAt: "2026-09-08T00:05:00.000Z",
      }),
      true,
    );
    expect(result.status).toBe("delivered");
    expect(result.status).not.toBe("read");
  });

  it("live, readAt set → read, the strongest fact, preferred over delivered", () => {
    const result = deriveWhatsappReportStatus(
      record({
        status: "DELIVERED",
        providerStatus: "accepted",
        deliveredAt: "2026-09-08T00:05:00.000Z",
        readAt: "2026-09-08T00:06:00.000Z",
      }),
      true,
    );
    expect(result.status).toBe("read");
  });

  it("FAILED → failed, never 'pending' or 'not_sent'", () => {
    const result = deriveWhatsappReportStatus(
      record({ status: "FAILED", providerStatus: "http_500", lastError: "whatsapp_send_failed_http_500" }),
      true,
    );
    expect(result.status).toBe("failed");
  });

  it("CONFIGURATION_ERROR → configuration_error, distinct from failed", () => {
    const result = deriveWhatsappReportStatus(
      record({ status: "CONFIGURATION_ERROR", providerStatus: null }),
      true,
    );
    expect(result.status).toBe("configuration_error");
    expect(result.status).not.toBe("failed");
  });

  it("BLOCKED_NO_CONSENT → blocked_no_consent, never a success state", () => {
    const result = deriveWhatsappReportStatus(
      record({ status: "BLOCKED_NO_CONSENT", providerStatus: null, messageId: null, sentAt: null }),
      true,
    );
    expect(result.status).toBe("blocked_no_consent");
  });

  it("every terminal status is reachable and mutually exclusive", () => {
    const seen = new Set<WhatsappReportUiStatus>();
    const cases: Array<[Partial<DeliveryRecord>, boolean]> = [
      [{}, true],
      [{ status: "SENT", providerStatus: "dev_accepted", messageId: "dev_abc123" }, true],
      [{ status: "SENT", providerStatus: "accepted" }, true],
      [{ status: "DELIVERED", providerStatus: "accepted", deliveredAt: "2026-09-08T00:05:00.000Z" }, true],
      [
        {
          status: "DELIVERED",
          providerStatus: "accepted",
          deliveredAt: "2026-09-08T00:05:00.000Z",
          readAt: "2026-09-08T00:06:00.000Z",
        },
        true,
      ],
      [{ status: "FAILED" }, true],
      [{ status: "CONFIGURATION_ERROR" }, true],
      [{ status: "BLOCKED_NO_CONSENT" }, true],
    ];
    for (const [overrides, readable] of cases) {
      const d = Object.keys(overrides).length ? record(overrides) : null;
      seen.add(deriveWhatsappReportStatus(d, readable).status);
    }
    seen.add(deriveWhatsappReportStatus(null, false).status);
    expect(seen.size).toBe(9); // not_sent, test_delivery, sent, delivered, read, failed, configuration_error, blocked_no_consent, unavailable
  });
});

describe("WhatsappReportStatusLine — copy for every state, source-verified", () => {
  const source = readFileSync(
    resolve(process.cwd(), "apps/patient-portal/src/components/doctor/PatientJourney.tsx"),
    "utf8",
  );

  it("renders the exact required copy for every persisted state", () => {
    expect(source).toContain("Test delivery recorded — no real WhatsApp message was sent.");
    expect(source).toContain("WhatsApp sent");
    expect(source).toContain("Delivered");
    expect(source).toContain("Read");
    expect(source).toContain("Delivery failed");
    expect(source).toContain("WhatsApp configuration unavailable");
    expect(source).toContain("WhatsApp consent not provided");
  });

  it("never renders 'WhatsApp sent' or 'Delivered'/'Read' for the dev/test-transport branch", () => {
    const testBranch = source.split('status.status === "test_delivery"')[1]?.split("if (status.status ===")[0] ?? "";
    expect(testBranch).not.toContain("WhatsApp sent");
    expect(testBranch).not.toMatch(/>\s*Delivered\s*</);
    expect(testBranch).not.toMatch(/>\s*Read\s*</);
  });
});
