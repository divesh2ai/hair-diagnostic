import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "crypto";
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
import {
  createWave0Case,
  deleteWave0Case,
  readDeliveryRows,
  type Wave0Case,
} from "./fixture";

// BEHAVIOURAL: the provider delivery-status callback.
//
// The first phase could only ever record SENT — `deliveredAt` and `readAt`
// were unreachable and `markProviderStatus` was dead code. These prove the
// full chain with SIGNED SYNTHETIC provider events. No real provider is
// involved and nothing is sent to anybody.

const SECRET =
  process.env.WHATSAPP_WEBHOOK_SECRET ?? "wave0-staging-whatsapp-webhook-secret";
const VERIFY_TOKEN =
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "wave0-staging-verify-token";

let up = false;
let docA: Session;
let docB: Session;
const created: Wave0Case[] = [];

/** A Meta Cloud API status callback, shaped exactly as Meta sends one. */
function metaStatusBody(messageId: string, status: string) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WAVE0",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              statuses: [
                { id: messageId, status, timestamp: `${Math.floor(Date.now() / 1000)}` },
              ],
            },
          },
        ],
      },
    ],
  });
}

async function postStatus(
  body: string,
  opts: { signature?: string | null; provider?: string } = {},
) {
  const { provider = "meta_cloud" } = opts;
  const signature =
    opts.signature === undefined
      ? `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`
      : opts.signature;

  const res = await fetch(`${BASE_URL}/api/webhooks/whatsapp/${provider}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "x-hub-signature-256": signature } : {}),
    },
    body,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { status: res.status, body: parsed as Record<string, unknown> };
}

/** Send a report and return the provider message id it was recorded under. */
async function sendAndGetMessageId(c: Wave0Case, session: Session = docA): Promise<string> {
  const res = await api(`/api/consultation/${c.assessmentId}/share`, {
    method: "POST",
    session,
    body: { subject: "REPORT" },
  });
  expect(res.status).toBe(200);
  const rows = await readDeliveryRows(c.assessmentId);
  const row = rows.find((r) => r.subject === "REPORT");
  expect(row?.messageId).toBeTruthy();
  return row!.messageId!;
}

beforeAll(async () => {
  assertStagingTarget();
  // trySetup skips (returns false) only when the app is unreachable or
  // the auth service is 5xx-ing. A REFUSED login still throws — see harness.
  up = await trySetup(async () => {
    docA = await login(IDENTITIES.doctorA);
    docB = await login(IDENTITIES.doctorB);
  });
}, 120_000);

afterAll(async () => {
  if (!up) return;
  for (const c of created) await deleteWave0Case(c);
}, 120_000);

async function newCase() {
  const a = await prisma.doctor.findFirstOrThrow({
    where: { email: IDENTITIES.doctorA },
    select: { id: true, clinicId: true },
  });
  const c = await createWave0Case({ clinicId: a.clinicId, doctorId: a.id });
  created.push(c);
  return c;
}

/** Same shape, in clinic B — for proving the webhook cannot cross tenants. */
async function newCaseInClinicB() {
  const b = await prisma.doctor.findFirstOrThrow({
    where: { email: IDENTITIES.doctorB },
    select: { id: true, clinicId: true },
  });
  const c = await createWave0Case({ clinicId: b.clinicId, doctorId: b.id });
  created.push(c);
  return c;
}

/**
 * One behavioural test.
 *
 * When setup could not run, the test is marked SKIPPED — not passed. An
 * early `return` would count as a pass, which is precisely the failure this
 * suite exists to prevent: a security check reporting green because it never
 * ran. `ctx.skip()` makes the run report say so.
 */
const t = (name: string, fn: () => Promise<void>, ms = 90_000) =>
  it(name, async (ctx) => {
    if (!up) ctx.skip();
    await fn();
  }, ms);

describe("WhatsApp status webhook — authentication", () => {
  t("an unsigned callback is rejected", async () => {
    const res = await postStatus(metaStatusBody("wamid.unknown", "delivered"), {
      signature: null,
    });
    expect(res.status).toBe(401);
  });

  t("a wrongly-signed callback is rejected", async () => {
    const body = metaStatusBody("wamid.unknown", "delivered");
    const forged = createHmac("sha256", "attacker").update(body).digest("hex");
    const res = await postStatus(body, { signature: `sha256=${forged}` });
    expect(res.status).toBe(401);
  });

  t("a signature replayed over a different body is rejected", async () => {
    const a = metaStatusBody("wamid.a", "delivered");
    const b = metaStatusBody("wamid.b", "read");
    const sigForA = `sha256=${createHmac("sha256", SECRET).update(a).digest("hex")}`;
    const res = await postStatus(b, { signature: sigForA });
    expect(res.status).toBe(401);
  });

  t("an unknown provider is refused", async () => {
    const res = await postStatus(metaStatusBody("wamid.x", "read"), {
      provider: "not-a-provider",
    });
    expect(res.status).toBe(404);
  });

  t("an unknown message id is ignored, not errored", async () => {
    // A 404 would make the provider retry a callback that can never succeed.
    const res = await postStatus(metaStatusBody("wamid.never-sent", "delivered"));
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(0);
    expect(res.body.ignored).toBe(1);
  });
});

describe("WhatsApp status webhook — SENT → DELIVERED → READ", () => {
  t("a delivered callback advances the row", async () => {
    const c = await newCase();
    const messageId = await sendAndGetMessageId(c);

    const before = (await readDeliveryRows(c.assessmentId)).find(
      (r) => r.subject === "REPORT",
    )!;
    expect(before.status).toBe("SENT");
    expect(before.deliveredAt).toBeNull();
    expect(before.readAt).toBeNull();

    const res = await postStatus(metaStatusBody(messageId, "delivered"));
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);

    const after = (await readDeliveryRows(c.assessmentId)).find(
      (r) => r.subject === "REPORT",
    )!;
    expect(after.status).toBe("DELIVERED");
    expect(after.deliveredAt).toBeTruthy();
    // Still not read — the two are independent facts.
    expect(after.readAt).toBeNull();
  });

  t("a read callback records readAt", async () => {
    const c = await newCase();
    const messageId = await sendAndGetMessageId(c);

    await postStatus(metaStatusBody(messageId, "delivered"));
    const res = await postStatus(metaStatusBody(messageId, "read"));
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);

    const row = (await readDeliveryRows(c.assessmentId)).find(
      (r) => r.subject === "REPORT",
    )!;
    expect(row.readAt).toBeTruthy();
    expect(row.deliveredAt).toBeTruthy();
  });

  t("redelivery does NOT move an already-recorded timestamp", async () => {
    // Providers redeliver. The first instant is the one reporting measures.
    const c = await newCase();
    const messageId = await sendAndGetMessageId(c);

    await postStatus(metaStatusBody(messageId, "read"));
    const first = (await readDeliveryRows(c.assessmentId)).find(
      (r) => r.subject === "REPORT",
    )!;

    await new Promise((r) => setTimeout(r, 1100));
    await postStatus(metaStatusBody(messageId, "read"));
    await postStatus(metaStatusBody(messageId, "read"));

    const later = (await readDeliveryRows(c.assessmentId)).find(
      (r) => r.subject === "REPORT",
    )!;
    expect(later.readAt?.toISOString()).toBe(first.readAt?.toISOString());
    expect(later.deliveredAt?.toISOString()).toBe(first.deliveredAt?.toISOString());
  });

  t("a provider FAILURE after acceptance marks the delivery FAILED", async () => {
    // The dangerous case: a message the provider took and then could not
    // deliver. Without this the doctor would keep seeing "sent".
    const c = await newCase();
    const messageId = await sendAndGetMessageId(c);

    const res = await postStatus(metaStatusBody(messageId, "failed"));
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);

    const row = (await readDeliveryRows(c.assessmentId)).find(
      (r) => r.subject === "REPORT",
    )!;
    expect(row.status).toBe("FAILED");
    expect(row.lastError).toBe("provider_reported_failure");
  });

  t("an unrecognised status is dropped rather than guessed at", async () => {
    const c = await newCase();
    const messageId = await sendAndGetMessageId(c);

    const res = await postStatus(metaStatusBody(messageId, "teleported"));
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(0);

    const row = (await readDeliveryRows(c.assessmentId)).find(
      (r) => r.subject === "REPORT",
    )!;
    expect(row.status).toBe("SENT");
    expect(row.deliveredAt).toBeNull();
  });

  t("a status callback for one clinic's message id never mutates another clinic's or patient's delivery row", async () => {
    // The webhook payload carries only a provider message id — no clinicId,
    // no patientId, no assessmentId. This proves that omission cannot bleed
    // across tenants: two deliveries in two DIFFERENT clinics, for two
    // different patients, get two distinct provider message ids, and a
    // callback naming ONE of them updates only that one row.
    const caseA = await newCase();
    const caseB = await newCaseInClinicB();
    const messageIdA = await sendAndGetMessageId(caseA, docA);
    const messageIdB = await sendAndGetMessageId(caseB, docB);
    expect(messageIdA).not.toBe(messageIdB);

    const res = await postStatus(metaStatusBody(messageIdA, "read"));
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);

    const rowA = (await readDeliveryRows(caseA.assessmentId)).find((r) => r.subject === "REPORT")!;
    const rowB = (await readDeliveryRows(caseB.assessmentId)).find((r) => r.subject === "REPORT")!;

    expect(rowA.readAt).toBeTruthy();
    // Clinic B's — different patient, different clinic, different assessment
    // — delivery must be completely untouched by a callback that never named it.
    expect(rowB.status).toBe("SENT");
    expect(rowB.readAt).toBeNull();
    expect(rowB.deliveredAt).toBeNull();
  });

  t("a payload with no statuses is acknowledged and changes nothing", async () => {
    // Meta sends inbound messages and account alerts to the same URL.
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "X", changes: [{ field: "messages", value: { messages: [] } }] }],
    });
    const res = await postStatus(body);
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(0);
  });
});

describe("WhatsApp webhook — Meta subscription handshake", () => {
  t("echoes the challenge for the correct verify token", async () => {
    const res = await fetch(
      `${BASE_URL}/api/webhooks/whatsapp/meta_cloud?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN)}&hub.challenge=wave0challenge`,
      { redirect: "manual" },
    );
    expect(res.status).toBe(200);
    expect((await res.text()).trim()).toBe("wave0challenge");
  });

  t("refuses a wrong verify token rather than echoing anything", async () => {
    const res = await fetch(
      `${BASE_URL}/api/webhooks/whatsapp/meta_cloud?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=wave0challenge`,
      { redirect: "manual" },
    );
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("wave0challenge");
  });
});
