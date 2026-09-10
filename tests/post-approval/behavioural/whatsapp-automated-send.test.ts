import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BASE_URL,
  IDENTITIES,
  api,
  assertStagingTarget,
  login,
  trySetup,
  type Session,
} from "./harness";
import { createWave0Case, deleteWave0Case, type Wave0Case } from "./fixture";

const WEBHOOK_SECRET =
  process.env.WHATSAPP_WEBHOOK_SECRET ?? "wave0-staging-whatsapp-webhook-secret";

/** A signed Meta Cloud API status callback — same shape as whatsapp-status.test.ts. */
async function postWhatsappStatus(messageId: string, status: string) {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WAVE0",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              statuses: [{ id: messageId, status, timestamp: `${Math.floor(Date.now() / 1000)}` }],
            },
          },
        ],
      },
    ],
  });
  const signature = `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")}`;
  return fetch(`${BASE_URL}/api/webhooks/whatsapp/meta_cloud`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
    body,
  });
}

// STAGING FUNCTIONAL PROOF — the automated Share flow, on the dev transport,
// against the now-migrated database. WHATSAPP_LIVE_SEND is never set here —
// every "send" below is `providerStatus: "dev_accepted"`, contacting nobody.
//
// This is the live counterpart to the mocked unit suite
// (tests/delivery/send-patient-link.test.ts): real HTTP, a real session, real
// Postgres rows, against the exact schema `prisma migrate deploy` just
// produced on staging.

let up = false;
let docA: Session;
let clinicA: { clinicId: string; doctorId: string };
let consentedCase: Wave0Case;
let noConsentCase: Wave0Case;
let noPhoneCase: Wave0Case;
let concurrencyCase: Wave0Case;
let rapidCase: Wave0Case;
let manualCase: Wave0Case;
let statusFlowCase: Wave0Case;

async function readFullDeliveryRows(assessmentId: string) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      subject: string | null;
      status: string;
      messageId: string | null;
      providerStatus: string | null;
      patientPhone: string | null;
      patientId: string | null;
      clinicId: string | null;
      sentByDoctorId: string | null;
      consultationVersionId: string | null;
      reportAssetId: string | null;
      onePagerAttached: boolean | null;
      assetSha256: string | null;
      assetTemplateVersion: string | null;
      attempts: number;
      sentAt: Date | null;
      createdAt: Date;
    }>
  >(Prisma.sql`
    SELECT "id", "subject", "status"::text AS "status", "messageId", "providerStatus",
           "patientPhone", "patientId", "clinicId", "sentByDoctorId",
           "consultationVersionId", "reportAssetId", "onePagerAttached",
           "assetSha256", "assetTemplateVersion", "attempts", "sentAt", "createdAt"
      FROM "WhatsappDelivery" WHERE "assessmentId" = ${assessmentId}
     ORDER BY "createdAt" ASC
  `);
}

beforeAll(async () => {
  assertStagingTarget();
  up = await trySetup(async () => {
    docA = await login(IDENTITIES.doctorA);
    const a = await prisma.doctor.findFirstOrThrow({
      where: { email: IDENTITIES.doctorA },
      select: { id: true, clinicId: true },
    });
    clinicA = { clinicId: a.clinicId, doctorId: a.id };

    // createWave0Case defaults whatsappConsent to true (see fixture.ts) —
    // explicit here anyway so this suite's intent reads without cross-
    // referencing the fixture's default.
    consentedCase = await createWave0Case({ ...clinicA, whatsappConsent: true });

    noConsentCase = await createWave0Case({ ...clinicA, whatsappConsent: false });

    noPhoneCase = await createWave0Case({ ...clinicA, whatsappConsent: true });
    await prisma.patient.update({ where: { id: noPhoneCase.patientId }, data: { phone: null } });

    concurrencyCase = await createWave0Case({ ...clinicA, whatsappConsent: true });

    rapidCase = await createWave0Case({ ...clinicA, whatsappConsent: true });

    // No consent granted at all — proves manual sharing is NOT subject to
    // the consent gate, exactly as sendPatientLink.ts's own comment says.
    manualCase = await createWave0Case({ ...clinicA, whatsappConsent: false });

    // Dedicated case for the DELIVERED/READ journey proof — never sent
    // through the real /share flow, so it carries no delivery row the PHASE 8
    // idempotency tests could trip over.
    statusFlowCase = await createWave0Case({ ...clinicA, whatsappConsent: true });
  });
}, 120_000);

afterAll(async () => {
  if (!up) return;
  for (const c of [consentedCase, noConsentCase, noPhoneCase, concurrencyCase, rapidCase, manualCase, statusFlowCase]) {
    if (c) await deleteWave0Case(c);
  }
}, 120_000);

const t = (name: string, fn: () => Promise<void>, ms = 60_000) =>
  it(name, async (ctx) => {
    if (!up) ctx.skip();
    await fn();
  }, ms);

describe("PHASE 5 — staging functional proof (dev transport, real rows)", () => {
  t("an approved, consented patient's report is sent, and every provenance field is populated", async () => {
    const res = await api<{ ok: boolean; live: boolean; delivery: { status: string } }>(
      `/api/consultation/${consentedCase.assessmentId}/share`,
      { method: "POST", session: docA, body: { subject: "REPORT" } },
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Dev transport only — this proves nothing real was contacted.
    expect(res.body.live).toBe(false);

    const rows = await readFullDeliveryRows(consentedCase.assessmentId);
    const row = rows.find((r) => r.subject === "REPORT");
    expect(row).toBeTruthy();
    expect(row!.status).toBe("SENT");
    expect(row!.providerStatus).toBe("dev_accepted");
    expect(row!.sentAt).toBeTruthy();

    expect(row!.patientId).toBe(consentedCase.patientId);
    expect(row!.clinicId).toBe(consentedCase.clinicId);
    expect(row!.sentByDoctorId).toBe(clinicA.doctorId);
    expect(row!.consultationVersionId).toBe(consentedCase.consultationVersionId);
    expect(row!.subject).toBe("REPORT");
    expect(row!.attempts).toBeGreaterThanOrEqual(1);

    // The one-pager may or may not have been rendered by the time this ran —
    // see PHASE 7's text-only-fallback proof. Either way the provenance
    // columns must AGREE with each other rather than being independently
    // wrong: attached implies an asset id and a hash, not attached implies
    // neither.
    if (row!.onePagerAttached) {
      expect(row!.reportAssetId).toBeTruthy();
      expect(row!.assetSha256).toBeTruthy();
      expect(row!.assetTemplateVersion).toBeTruthy();
    } else {
      expect(row!.assetSha256).toBeNull();
    }
  });

  t("PHASE 3 — the doctor journey endpoint reports the persisted status as test_delivery for a dev-transport send", async () => {
    // consentedCase already has a SENT/dev_accepted REPORT delivery from the
    // test above. This proves the actual HTTP surface the doctor UI reads —
    // not just the derivation function in isolation.
    const res = await api<{
      whatsappReport?: { status: string; sentAt: string | null; deliveredAt: string | null; readAt: string | null };
    }>(`/api/doctor/journey/${consentedCase.assessmentId}`, { method: "GET", session: docA });
    expect(res.status).toBe(200);
    expect(res.body.whatsappReport).toBeTruthy();
    expect(res.body.whatsappReport!.status).toBe("test_delivery");
    expect(res.body.whatsappReport!.sentAt).toBeTruthy();
    expect(res.body.whatsappReport!.deliveredAt).toBeNull();
    expect(res.body.whatsappReport!.readAt).toBeNull();
  });

  t("PHASE 3 — a dev-transport row stays test_delivery even if (synthetically) marked delivered/read — the transport marker wins", async () => {
    const before = await readFullDeliveryRows(consentedCase.assessmentId);
    const row = before.find((r) => r.subject === "REPORT")!;
    // A real Meta webhook could never name a dev_-prefixed id — this proves
    // the DEFENSIVE branch: even if it somehow did, the UI must not read it
    // as a real delivery.
    await postWhatsappStatus(row.messageId!, "delivered");
    await postWhatsappStatus(row.messageId!, "read");

    const res = await api<{ whatsappReport?: { status: string } }>(
      `/api/doctor/journey/${consentedCase.assessmentId}`,
      { method: "GET", session: docA },
    );
    expect(res.body.whatsappReport!.status).toBe("test_delivery");
  });

  t("PHASE 3 — DELIVERED then READ callbacks flow through to the doctor journey endpoint", async () => {
    // Seed a LIVE-shaped delivery directly (no real Meta credentials exist in
    // this environment) so the DELIVERED/READ transition can be proven
    // end-to-end without touching WHATSAPP_LIVE_SEND. providerStatus does
    // NOT start with "dev", exactly as a genuine meta_cloud accept would look.
    const liveMessageId = `wamid.phase3-${Date.now()}`;
    await prisma.$executeRaw`
      INSERT INTO "WhatsappDelivery" (
        "id", "assessmentId", "clinicId", "subject", "patientPhone",
        "templateId", "status", "attempts", "sentByDoctorId",
        "consultationVersionId", "messageId", "providerStatus", "sentAt",
        "createdAt", "updatedAt"
      ) VALUES (
        ${`phase3-live-${Date.now()}`}, ${statusFlowCase.assessmentId}, ${clinicA.clinicId}, 'REPORT',
        '919999000001', NULL, 'SENT'::"DeliveryStatus", 1, ${clinicA.doctorId},
        ${statusFlowCase.consultationVersionId}, ${liveMessageId}, 'accepted', NOW(),
        NOW(), NOW()
      )
    `;

    const afterSent = await api<{ whatsappReport?: { status: string } }>(
      `/api/doctor/journey/${statusFlowCase.assessmentId}`,
      { method: "GET", session: docA },
    );
    expect(afterSent.body.whatsappReport!.status).toBe("sent");

    await postWhatsappStatus(liveMessageId, "delivered");
    const afterDelivered = await api<{ whatsappReport?: { status: string; deliveredAt: string | null } }>(
      `/api/doctor/journey/${statusFlowCase.assessmentId}`,
      { method: "GET", session: docA },
    );
    expect(afterDelivered.body.whatsappReport!.status).toBe("delivered");
    expect(afterDelivered.body.whatsappReport!.deliveredAt).toBeTruthy();

    await postWhatsappStatus(liveMessageId, "read");
    const afterRead = await api<{ whatsappReport?: { status: string; readAt: string | null } }>(
      `/api/doctor/journey/${statusFlowCase.assessmentId}`,
      { method: "GET", session: docA },
    );
    expect(afterRead.body.whatsappReport!.status).toBe("read");
    expect(afterRead.body.whatsappReport!.readAt).toBeTruthy();
  });

  t("Consultation stays APPROVED after an automated send — approval and delivery are independent", async () => {
    const version = await prisma.consultationVersion.findUniqueOrThrow({
      where: { id: consentedCase.consultationVersionId },
      select: { approvalStatus: true },
    });
    expect(String(version.approvalStatus)).toBe("APPROVED");
  });
});

describe("PHASE 6 — consent blocking proof", () => {
  t("approved + valid phone + consent=false: approval intact, provider never invoked, BLOCKED_NO_CONSENT persisted, no green success", async () => {
    const res = await api<{ ok: boolean; error?: string; deliveryId?: string | null }>(
      `/api/consultation/${noConsentCase.assessmentId}/share`,
      { method: "POST", session: docA, body: { subject: "REPORT" } },
    );
    // 422: a state of the world the caller can act on, not a server fault.
    expect(res.status).toBe(422);
    expect(res.body.ok).toBeUndefined();
    expect((res.body as { error?: string }).error).toBe("no_consent");

    const rows = await readFullDeliveryRows(noConsentCase.assessmentId);
    const row = rows.find((r) => r.subject === "REPORT");
    expect(row).toBeTruthy();
    // BLOCKED_NO_CONSENT, never SENT — this is the "no green success state"
    // proof: the row itself cannot be mistaken for a delivery.
    expect(row!.status).toBe("BLOCKED_NO_CONSENT");
    expect(row!.messageId).toBeNull();
    expect(row!.providerStatus).toBeNull();
    expect(row!.sentAt).toBeNull();

    // Doctor approval is untouched by the blocked send.
    const version = await prisma.consultationVersion.findUniqueOrThrow({
      where: { id: noConsentCase.consultationVersionId },
      select: { approvalStatus: true },
    });
    expect(String(version.approvalStatus)).toBe("APPROVED");
  });
});

describe("PHASE 7 — error-state proof", () => {
  t("invalid/missing phone: provider not invoked, clear no_phone result, no delivery row at all", async () => {
    const res = await api<{ error?: string }>(
      `/api/consultation/${noPhoneCase.assessmentId}/share`,
      { method: "POST", session: docA, body: { subject: "REPORT" } },
    );
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("no_phone");

    // sendPatientLink refuses BEFORE createDelivery for no_phone — no row at
    // all, not a row recording a failed attempt against a number that was
    // never real.
    const rows = await readFullDeliveryRows(noPhoneCase.assessmentId);
    expect(rows.find((r) => r.subject === "REPORT")).toBeUndefined();
  });
});

describe("PHASE 8 — idempotency (mandatory)", () => {
  t("sequential duplicate: exactly one successful delivery, the second call reuses it", async () => {
    const first = await api<{ ok: boolean; alreadySent: boolean; delivery: { id: string; status: string } }>(
      `/api/consultation/${concurrencyCase.assessmentId}/share`,
      { method: "POST", session: docA, body: { subject: "REPORT" } },
    );
    expect(first.status).toBe(200);
    expect(first.body.alreadySent).toBe(false);

    const second = await api<{ ok: boolean; alreadySent: boolean; delivery: { id: string; status: string } }>(
      `/api/consultation/${concurrencyCase.assessmentId}/share`,
      { method: "POST", session: docA, body: { subject: "REPORT" } },
    );
    expect(second.status).toBe(200);
    expect(second.body.alreadySent).toBe(true);
    expect(second.body.delivery.id).toBe(first.body.delivery.id);

    const rows = await readFullDeliveryRows(concurrencyCase.assessmentId);
    const sentRows = rows.filter((r) => r.subject === "REPORT" && r.status === "SENT");
    expect(sentRows).toHaveLength(1);
  });

  t("rapid/concurrent duplicate: two simultaneous requests still leave exactly one successful delivery", async () => {
    const [a, b] = await Promise.all([
      api<{ ok: boolean; alreadySent: boolean; delivery: { id: string; status: string } }>(
        `/api/consultation/${rapidCase.assessmentId}/share`,
        { method: "POST", session: docA, body: { subject: "REPORT" } },
      ),
      api<{ ok: boolean; alreadySent: boolean; delivery: { id: string; status: string } }>(
        `/api/consultation/${rapidCase.assessmentId}/share`,
        { method: "POST", session: docA, body: { subject: "REPORT" } },
      ),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const rows = await readFullDeliveryRows(rapidCase.assessmentId);
    const reportRows = rows.filter((r) => r.subject === "REPORT");
    const sentRows = reportRows.filter((r) => r.status === "SENT");

    // Exact DB evidence, printed unconditionally so a future failure names
    // its own counter-evidence rather than only a boolean.
    console.log("[PHASE 8 concurrency evidence]", {
      totalReportRows: reportRows.length,
      sentRows: sentRows.length,
      statuses: reportRows.map((r) => r.status),
      messageIds: reportRows.map((r) => r.messageId),
      attempts: reportRows.map((r) => r.attempts),
      responseAlreadySent: [a.body.alreadySent, b.body.alreadySent],
    });

    expect(sentRows).toHaveLength(1);
    // At least one of the two concurrent callers must have observed the
    // reuse — both racing ahead of the other's write is exactly the failure
    // this proves did not happen.
    expect([a.body.alreadySent, b.body.alreadySent]).toContain(true);
  });
});

describe("MANUAL REGRESSION — the wa.me fallback stays operational and is not consent-gated", () => {
  t("mode:manual composes a wa.me link, writes no delivery row, and is not blocked by missing consent", async () => {
    const res = await api<{ ok: boolean; waUrl: string; hasPhone: boolean }>(
      `/api/consultation/${manualCase.assessmentId}/share`,
      { method: "POST", session: docA, body: { subject: "REPORT", mode: "manual" } },
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.hasPhone).toBe(true);
    expect(res.body.waUrl).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);

    // Manual mode never calls sendPatientLink — no WhatsappDelivery row at
    // all, regardless of the patient having zero consent on file.
    const rows = await readFullDeliveryRows(manualCase.assessmentId);
    expect(rows.find((r) => r.subject === "REPORT")).toBeUndefined();
  });
});
