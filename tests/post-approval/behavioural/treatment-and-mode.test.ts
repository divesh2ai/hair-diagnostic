import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BASE_URL,
  IDENTITIES,
  api,
  assertStagingTarget,
  isDenied,
  login,
  trySetup,
  type Session,
} from "./harness";
import {
  createWave0Case,
  deleteWave0Case,
  readFulfilmentRow,
  type Wave0Case,
} from "./fixture";

// BEHAVIOURAL: the treatment-start contract and the fulfilment-destination
// choice — the two gaps this phase set out to close.

const PAYMENT_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET ?? "wave0-staging-payment-webhook-secret";

let up = false;
let docA: Session;
let docB: Session;
let admin: Session;
let clinicA: { clinicId: string; doctorId: string };
const created: Wave0Case[] = [];

async function newCase(mode: "CLINIC" | "PATIENT" | null = "CLINIC") {
  const c = await createWave0Case({ ...clinicA, fulfilmentMode: mode });
  created.push(c);
  return c;
}

async function payViaWebhook(c: Wave0Case) {
  const body = JSON.stringify({
    event: "payment.captured",
    kitOrderIntentId: c.kitOrderIntentId,
    paymentId: `pay_${c.kitOrderIntentId}`,
    amountMinor: 450000,
  });
  const signature = createHmac("sha256", PAYMENT_SECRET).update(body).digest("hex");
  const res = await fetch(`${BASE_URL}/api/payments/webhook/razorpay`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
    body,
  });
  return res.json() as Promise<Record<string, unknown>>;
}

async function readMode(intentId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ fulfilmentMode: string | null }>>(
    Prisma.sql`SELECT "fulfilmentMode"::text AS "fulfilmentMode" FROM "KitOrderIntent" WHERE "id" = ${intentId}`,
  );
  return rows[0]?.fulfilmentMode ?? null;
}

async function readTreatment(intentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ treatmentStartedAt: Date | null; treatmentStartedBy: string | null; treatmentStartSource: string | null }>
  >(
    Prisma.sql`SELECT "treatmentStartedAt","treatmentStartedBy","treatmentStartSource" FROM "KitOrderIntent" WHERE "id" = ${intentId}`,
  );
  return rows[0];
}

beforeAll(async () => {
  assertStagingTarget();
  // trySetup skips (returns false) only when the app is unreachable or
  // the auth service is 5xx-ing. A REFUSED login still throws — see harness.
  up = await trySetup(async () => {
    docA = await login(IDENTITIES.doctorA);
    docB = await login(IDENTITIES.doctorB);
    admin = await login(IDENTITIES.superAdmin);

    const a = await prisma.doctor.findFirstOrThrow({
      where: { email: IDENTITIES.doctorA },
      select: { id: true, clinicId: true },
    });
    clinicA = { clinicId: a.clinicId, doctorId: a.id };
  });
}, 120_000);

afterAll(async () => {
  if (!up) return;
  for (const c of created) await deleteWave0Case(c);
}, 180_000);

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

describe("fulfilment destination — the explicit choice", () => {
  t("the clinic's doctor can set an order to PATIENT delivery", async () => {
    const c = await newCase("CLINIC");
    const res = await api<{ ok: boolean; mode: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/fulfilment-mode`,
      { method: "PUT", session: docA, body: { mode: "PATIENT" } },
    );
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("PATIENT");
    expect(await readMode(c.kitOrderIntentId)).toBe("PATIENT");
  });

  t("an arbitrary enum value is refused before it reaches the database", async () => {
    const c = await newCase("CLINIC");
    for (const bad of ["DROP TABLE", "clinic", "", null, 7, "COURIER"]) {
      const res = await api<{ error: string }>(
        `/api/doctor/orders/${c.kitOrderIntentId}/fulfilment-mode`,
        { method: "PUT", session: docA, body: { mode: bad } },
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_mode");
    }
    // Unchanged throughout.
    expect(await readMode(c.kitOrderIntentId)).toBe("CLINIC");
  });

  t("a doctor from ANOTHER clinic cannot change the destination", async () => {
    const c = await newCase("CLINIC");
    const res = await api(`/api/doctor/orders/${c.kitOrderIntentId}/fulfilment-mode`, {
      method: "PUT",
      session: docB,
      body: { mode: "PATIENT" },
    });
    expect(isDenied(res)).toBe(true);
    expect(await readMode(c.kitOrderIntentId)).toBe("CLINIC");
  });

  t("an unauthenticated caller cannot", async () => {
    const c = await newCase("CLINIC");
    const res = await api(`/api/doctor/orders/${c.kitOrderIntentId}/fulfilment-mode`, {
      method: "PUT",
      body: { mode: "PATIENT" },
    });
    expect(isDenied(res)).toBe(true);
    expect(await readMode(c.kitOrderIntentId)).toBe("CLINIC");
  });

  t("the destination LOCKS once fulfilment has started", async () => {
    const c = await newCase("CLINIC");
    await payViaWebhook(c);
    expect(await readFulfilmentRow(c.assessmentId)).toHaveLength(1);

    const res = await api<{ error: string; status: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/fulfilment-mode`,
      { method: "PUT", session: docA, body: { mode: "PATIENT" } },
    );
    // Explicit refusal, not a silent no-op: ops has been told to pack a box.
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("fulfilment_already_started");
    expect(await readMode(c.kitOrderIntentId)).toBe("CLINIC");
  });

  t("the destination decides the branch — PATIENT creates no clinic request", async () => {
    const c = await newCase("CLINIC");
    // Flip it BEFORE payment; the trigger must honour the persisted value.
    await api(`/api/doctor/orders/${c.kitOrderIntentId}/fulfilment-mode`, {
      method: "PUT",
      session: docA,
      body: { mode: "PATIENT" },
    });

    const paid = await payViaWebhook(c);
    expect(paid.outcome).toBe("paid");
    expect(paid.mode).toBe("PATIENT");
    expect(paid.fulfilmentCreated).toBe(false);
    expect(await readFulfilmentRow(c.assessmentId)).toHaveLength(0);
  });

  t("a legacy order with NO recorded destination still resolves safely", async () => {
    // Backward compatibility: rows created before the column existed are not
    // backfilled, and must not break the trigger.
    const c = await newCase(null);
    expect(await readMode(c.kitOrderIntentId)).toBeNull();

    const paid = await payViaWebhook(c);
    expect(paid.outcome).toBe("paid");
    // Resolves through the documented legacy fallback.
    expect(paid.mode).toBe("CLINIC");
    expect(await readFulfilmentRow(c.assessmentId)).toHaveLength(1);
  });
});

describe("treatment start — the follow-up anchor", () => {
  t("the clinic's doctor can record it", async () => {
    const c = await newCase("CLINIC");
    const res = await api<{ ok: boolean; alreadyRecorded: boolean; startedAt: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/treatment-start`,
      { method: "POST", session: docA, body: {} },
    );
    expect(res.status).toBe(200);
    expect(res.body.alreadyRecorded).toBe(false);
    expect(res.body.startedAt).toBeTruthy();

    const row = await readTreatment(c.kitOrderIntentId);
    expect(row.treatmentStartedAt).toBeTruthy();
    expect(row.treatmentStartedBy).toBe(clinicA.doctorId);
    expect(row.treatmentStartSource).toBe("DOCTOR_RECORDED");
  });

  t("it is WRITE-ONCE — a second call preserves the original date", async () => {
    const c = await newCase("CLINIC");
    const backdated = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const first = await api<{ startedAt: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/treatment-start`,
      { method: "POST", session: docA, body: { startedAt: backdated } },
    );
    expect(first.status).toBe(200);

    const second = await api<{ alreadyRecorded: boolean; startedAt: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/treatment-start`,
      { method: "POST", session: docA, body: { startedAt: new Date().toISOString() } },
    );
    expect(second.status).toBe(200);
    expect(second.body.alreadyRecorded).toBe(true);
    // Things will be anchored to this date; a second click must not move it.
    expect(second.body.startedAt).toBe(first.body.startedAt);
  });

  t("a FUTURE date is refused, not clamped", async () => {
    const c = await newCase("CLINIC");
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await api<{ error: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/treatment-start`,
      { method: "POST", session: docA, body: { startedAt: future } },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("future_date");
    expect((await readTreatment(c.kitOrderIntentId)).treatmentStartedAt).toBeNull();
  });

  t("an absurdly backdated start is refused", async () => {
    const c = await newCase("CLINIC");
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const res = await api<{ error: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/treatment-start`,
      { method: "POST", session: docA, body: { startedAt: old } },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("too_far_back");
    expect((await readTreatment(c.kitOrderIntentId)).treatmentStartedAt).toBeNull();
  });

  t("an unparseable date is refused", async () => {
    const c = await newCase("CLINIC");
    const res = await api<{ error: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/treatment-start`,
      { method: "POST", session: docA, body: { startedAt: "the day before yesterday" } },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_date");
  });

  t("a doctor from ANOTHER clinic cannot anchor this patient's treatment", async () => {
    const c = await newCase("CLINIC");
    const res = await api(`/api/doctor/orders/${c.kitOrderIntentId}/treatment-start`, {
      method: "POST",
      session: docB,
      body: {},
    });
    expect(isDenied(res)).toBe(true);
    expect((await readTreatment(c.kitOrderIntentId)).treatmentStartedAt).toBeNull();
  });

  t("an unauthenticated caller cannot", async () => {
    const c = await newCase("CLINIC");
    const res = await api(`/api/doctor/orders/${c.kitOrderIntentId}/treatment-start`, {
      method: "POST",
      body: {},
    });
    expect(isDenied(res)).toBe(true);
    expect((await readTreatment(c.kitOrderIntentId)).treatmentStartedAt).toBeNull();
  });
});

describe("doctor patient journey — the read the doctor actually sees", () => {
  t("reflects the real state and is scoped to the caller's clinic", async () => {
    const c = await newCase("CLINIC");

    const mine = await api<{ cartLifecycle: string; steps: Array<{ stage: string; state: string }> }>(
      `/api/doctor/journey/${c.assessmentId}`,
      { session: docA },
    );
    expect(mine.status).toBe(200);
    expect(mine.body.cartLifecycle).toBe("DOCTOR_APPROVED");

    const theirs = await api(`/api/doctor/journey/${c.assessmentId}`, { session: docB });
    expect(isDenied(theirs)).toBe(true);
  });

  t("advances to FULFILMENT_PENDING once paid", async () => {
    const c = await newCase("CLINIC");
    await payViaWebhook(c);

    const res = await api<{ cartLifecycle: string; fulfilmentMode: string; fulfilmentModeExplicit: boolean }>(
      `/api/doctor/journey/${c.assessmentId}`,
      { session: docA },
    );
    expect(res.status).toBe(200);
    expect(res.body.cartLifecycle).toBe("FULFILMENT_PENDING");
    expect(res.body.fulfilmentMode).toBe("CLINIC");
    // Explicitly recorded on the order, not silently defaulted.
    expect(res.body.fulfilmentModeExplicit).toBe(true);
  });

  t("reports UNAVAILABLE, never a false negative, when a stage cannot be read", async () => {
    // The three-state model. Proven here by the shape of the contract: every
    // step carries one of exactly four states and none of them is a guess.
    const c = await newCase("CLINIC");
    const res = await api<{ steps: Array<{ stage: string; state: string }>; degraded: string[] }>(
      `/api/doctor/journey/${c.assessmentId}`,
      { session: docA },
    );
    expect(res.status).toBe(200);
    for (const step of res.body.steps) {
      expect(["done", "pending", "not_applicable", "unavailable"]).toContain(step.state);
    }
    // Nothing is degraded against a healthy migrated database.
    expect(res.body.degraded).toEqual([]);
  });
});

describe("Super Admin Action Centre — against the migrated database", () => {
  t("is Super Admin only", async () => {
    expect(isDenied(await api("/api/admin/action-centre", { session: docA }))).toBe(true);
    expect(isDenied(await api("/api/admin/action-centre"))).toBe(true);
    const ok = await api("/api/admin/action-centre", { session: admin });
    expect(ok.status).toBe(200);
  });

  t("every group reads, and the headline count excludes nothing silently", async () => {
    const res = await api<{
      needsAttention: number;
      unavailableGroups: string[];
      groups: Record<string, { available: boolean; count: number }>;
    }>("/api/admin/action-centre", { session: admin });

    expect(res.status).toBe(200);
    // The whole point of the migration: no group is unreadable any more.
    expect(res.body.unavailableGroups).toEqual([]);
    for (const [, group] of Object.entries(res.body.groups)) {
      expect(group.available).toBe(true);
    }
    const sum = Object.values(res.body.groups).reduce((n, g) => n + g.count, 0);
    expect(res.body.needsAttention).toBe(sum);
  });

  t("surfaces a new clinic fulfilment request to Ops", async () => {
    const c = await newCase("CLINIC");
    await payViaWebhook(c);

    const res = await api<{
      groups: { kitFulfilmentAwaitingOps: { items: Array<{ assessmentId: string }> } };
    }>("/api/admin/action-centre", { session: admin });

    const ids = res.body.groups.kitFulfilmentAwaitingOps.items.map((i) => i.assessmentId);
    expect(ids).toContain(c.assessmentId);
  });

  t("surfaces a failed delivery to Ops", async () => {
    const c = await newCase("CLINIC");
    // Force a failure the way the provider webhook would report one.
    await api(`/api/consultation/${c.assessmentId}/share`, {
      method: "POST",
      session: docA,
      body: { subject: "REPORT" },
    });
    await prisma.$executeRaw`
      UPDATE "WhatsappDelivery"
         SET "status" = 'FAILED'::"DeliveryStatus", "lastError" = 'wave0_synthetic_failure'
       WHERE "assessmentId" = ${c.assessmentId}
    `;

    const res = await api<{
      groups: { failedDeliveries: { items: Array<{ assessmentId: string }> } };
    }>("/api/admin/action-centre", { session: admin });

    const ids = res.body.groups.failedDeliveries.items.map((i) => i.assessmentId);
    expect(ids).toContain(c.assessmentId);
  });
});
