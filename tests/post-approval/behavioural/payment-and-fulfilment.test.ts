import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import {
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
  readPaymentRow,
  type Wave0Case,
} from "./fixture";

// BEHAVIOURAL: payment authority, the payment → fulfilment trigger, and the
// ops state machine — proven against real rows rather than read off source.

const WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET ?? "wave0-staging-payment-webhook-secret";

let up = false;
let docA: Session;
let docB: Session;
let admin: Session;
let clinicA: { clinicId: string; doctorId: string };
const created: Wave0Case[] = [];

async function newCase(mode: "CLINIC" | "PATIENT" = "CLINIC") {
  const c = await createWave0Case({ ...clinicA, fulfilmentMode: mode });
  created.push(c);
  return c;
}

/** A signed provider callback, exactly as a gateway would send one. */
function signedWebhook(kitOrderIntentId: string, paymentId: string, amountMinor = 450000) {
  const body = JSON.stringify({
    event: "payment.captured",
    kitOrderIntentId,
    paymentId,
    amountMinor,
  });
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  return { body, signature };
}

async function postWebhook(
  body: string,
  signature: string | null,
  provider = "razorpay",
) {
  const res = await fetch(
    `${process.env.WAVE0_BASE_URL ?? "http://127.0.0.1:4000"}/api/payments/webhook/${provider}`,
    {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-razorpay-signature": signature } : {}),
      },
      body,
    },
  );
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { status: res.status, body: parsed as Record<string, unknown> };
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

describe("payment webhook — authority", () => {
  t("an UNSIGNED event is rejected and writes nothing", async () => {
    const c = await newCase();
    const { body } = signedWebhook(c.kitOrderIntentId, "pay_unsigned");
    const res = await postWebhook(body, null);
    expect(res.status).toBe(401);
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
    expect(await readFulfilmentRow(c.assessmentId)).toHaveLength(0);
  });

  t("an INVALID signature is rejected and writes nothing", async () => {
    const c = await newCase();
    const { body } = signedWebhook(c.kitOrderIntentId, "pay_badsig");
    const forged = createHmac("sha256", "attacker-secret").update(body).digest("hex");
    const res = await postWebhook(body, forged);
    expect(res.status).toBe(401);
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });

  t("a signature REPLAYED over a different body is rejected", async () => {
    const c = await newCase();
    const legit = signedWebhook(c.kitOrderIntentId, "pay_legit");
    const swapped = JSON.stringify({
      event: "payment.captured",
      kitOrderIntentId: c.kitOrderIntentId,
      paymentId: "pay_swapped",
      amountMinor: 1,
    });
    const res = await postWebhook(swapped, legit.signature);
    expect(res.status).toBe(401);
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });

  t("an unknown provider is refused", async () => {
    const c = await newCase();
    const { body, signature } = signedWebhook(c.kitOrderIntentId, "pay_x");
    const res = await postWebhook(body, signature, "not-a-provider");
    expect(res.status).toBe(404);
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });

  t("a non-capture event is acknowledged but changes nothing", async () => {
    const c = await newCase();
    const body = JSON.stringify({
      event: "payment.authorized",
      kitOrderIntentId: c.kitOrderIntentId,
      paymentId: "pay_auth_only",
    });
    const signature = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    const res = await postWebhook(body, signature);
    // 200 stops the retry loop; the order is untouched. Authorised is money
    // held, not taken.
    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe("payment.authorized");
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });
});

describe("payment webhook — idempotency and the fulfilment trigger", () => {
  t("a valid signed capture pays the order and creates ONE fulfilment", async () => {
    const c = await newCase("CLINIC");
    const { body, signature } = signedWebhook(c.kitOrderIntentId, "pay_ok_1");
    const res = await postWebhook(body, signature);
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("paid");
    expect(res.body.fulfilmentCreated).toBe(true);

    const payments = await readPaymentRow(c.assessmentId);
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("PAID");
    expect(payments[0].source).toBe("PROVIDER_WEBHOOK");
    expect(payments[0].paidAt).toBeTruthy();

    const fulfilments = await readFulfilmentRow(c.assessmentId);
    expect(fulfilments).toHaveLength(1);
    expect(fulfilments[0].status).toBe("REQUESTED");
    expect(fulfilments[0].mode).toBe("CLINIC");
  });

  t("the SAME event delivered five times yields one PAID row and one request", async () => {
    // Not a hypothetical: every gateway retries until it gets a 2xx.
    const c = await newCase("CLINIC");
    const { body, signature } = signedWebhook(c.kitOrderIntentId, "pay_dup");

    const results = [];
    for (let i = 0; i < 5; i++) results.push(await postWebhook(body, signature));

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.outcome === "paid")).toHaveLength(1);
    expect(results.filter((r) => r.body.outcome === "already_paid")).toHaveLength(4);
    expect(results.filter((r) => r.body.fulfilmentCreated === true)).toHaveLength(1);

    expect(await readPaymentRow(c.assessmentId)).toHaveLength(1);
    expect(await readFulfilmentRow(c.assessmentId)).toHaveLength(1);
  });

  t("CONCURRENT duplicates still yield exactly one of each", async () => {
    // The read-then-write window a naive implementation would leave open.
    const c = await newCase("CLINIC");
    const { body, signature } = signedWebhook(c.kitOrderIntentId, "pay_race");

    const results = await Promise.all(
      Array.from({ length: 5 }, () => postWebhook(body, signature)),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);

    expect(await readPaymentRow(c.assessmentId)).toHaveLength(1);
    expect(await readFulfilmentRow(c.assessmentId)).toHaveLength(1);
  });

  t("the SAME provider reference on a DIFFERENT order is refused, not 500", async () => {
    // Found by this suite: `(provider, providerRef)` is unique, but the
    // INSERT's ON CONFLICT targets the order key, so a collision on the other
    // index escaped as an unhandled unique violation and surfaced as a 500 —
    // which a gateway would then retry forever.
    const first = await newCase("CLINIC");
    const second = await newCase("CLINIC");
    const sharedRef = `pay_shared_${first.kitOrderIntentId}`;

    const a = signedWebhook(first.kitOrderIntentId, sharedRef);
    const resA = await postWebhook(a.body, a.signature);
    expect(resA.status).toBe(200);
    expect(resA.body.outcome).toBe("paid");

    const b = signedWebhook(second.kitOrderIntentId, sharedRef);
    const resB = await postWebhook(b.body, b.signature);
    // Acknowledged so the gateway stops retrying, but explicitly NOT applied.
    expect(resB.status).toBe(200);
    expect(resB.body.ignored).toBe("reference_conflict");

    // One payment cannot settle two orders.
    expect(await readPaymentRow(second.assessmentId)).toHaveLength(0);
    expect(await readFulfilmentRow(second.assessmentId)).toHaveLength(0);
  });

  t("PATIENT delivery is paid but creates NO clinic fulfilment", async () => {
    const c = await newCase("PATIENT");
    const { body, signature } = signedWebhook(c.kitOrderIntentId, "pay_patient");
    const res = await postWebhook(body, signature);

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("paid");
    expect(res.body.fulfilmentCreated).toBe(false);
    expect(res.body.mode).toBe("PATIENT");

    expect((await readPaymentRow(c.assessmentId))[0].status).toBe("PAID");
    // The mandatory branch check.
    expect(await readFulfilmentRow(c.assessmentId)).toHaveLength(0);
  });
});

describe("clinic-counter payment", () => {
  t("the clinic's own doctor can record a counter payment", async () => {
    const c = await newCase("CLINIC");
    const res = await api<{ outcome: string; payment: { status: string }; fulfilmentCreated: boolean }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/payment`,
      { method: "POST", session: docA, body: { amountMinor: 450000, reference: "WAVE0-TILL-1" } },
    );
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("paid");
    expect(res.body.payment.status).toBe("PAID");
    expect(res.body.fulfilmentCreated).toBe(true);

    const rows = await readPaymentRow(c.assessmentId);
    expect(rows[0].source).toBe("CLINIC_COUNTER");
    expect(rows[0].amountMinor).toBe(450000);
  });

  t("a doctor from ANOTHER clinic cannot", async () => {
    const c = await newCase("CLINIC");
    const res = await api(`/api/doctor/orders/${c.kitOrderIntentId}/payment`, {
      method: "POST",
      session: docB,
      body: { amountMinor: 450000 },
    });
    expect(isDenied(res)).toBe(true);
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });

  t("an unauthenticated caller cannot", async () => {
    const c = await newCase("CLINIC");
    const res = await api(`/api/doctor/orders/${c.kitOrderIntentId}/payment`, {
      method: "POST",
      body: { amountMinor: 450000 },
    });
    expect(isDenied(res)).toBe(true);
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });

  t("a nonsense amount is refused", async () => {
    const c = await newCase("CLINIC");
    const res = await api<{ error: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/payment`,
      { method: "POST", session: docA, body: { amountMinor: -5 } },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_amount");
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });

  t("double submission is idempotent", async () => {
    const c = await newCase("CLINIC");
    const first = await api<{ outcome: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/payment`,
      { method: "POST", session: docA, body: { amountMinor: 450000 } },
    );
    const second = await api<{ outcome: string }>(
      `/api/doctor/orders/${c.kitOrderIntentId}/payment`,
      { method: "POST", session: docA, body: { amountMinor: 999999 } },
    );
    expect(first.body.outcome).toBe("paid");
    expect(second.body.outcome).toBe("already_paid");

    const rows = await readPaymentRow(c.assessmentId);
    expect(rows).toHaveLength(1);
    // The second, different amount did not overwrite the first.
    expect(rows[0].amountMinor).toBe(450000);
    expect(await readFulfilmentRow(c.assessmentId)).toHaveLength(1);
  });
});

describe("fulfilment state machine — over HTTP", () => {
  async function paidClinicCase() {
    const c = await newCase("CLINIC");
    // A UNIQUE provider reference per case. `(provider, providerRef)` is a
    // unique index — reusing one across orders is a real, refused condition,
    // covered by its own test below rather than tripped over here.
    const { body, signature } = signedWebhook(c.kitOrderIntentId, `pay_${c.kitOrderIntentId}`);
    await postWebhook(body, signature);
    const rows = await readFulfilmentRow(c.assessmentId);
    if (!rows[0]) throw new Error("fixture: payment did not create a fulfilment request");
    return { c, fulfilmentId: rows[0].id };
  }

  t("Super Admin walks REQUESTED → CONFIRMED → PACKED → DISPATCHED → DELIVERED", async () => {
    const { c, fulfilmentId } = await paidClinicCase();
    for (const to of ["CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"]) {
      const res = await api<{ ok: boolean; fulfilment: { status: string } }>(
        `/api/admin/fulfilment/${fulfilmentId}/transition`,
        { method: "POST", session: admin, body: { to } },
      );
      expect(res.status).toBe(200);
      expect(res.body.fulfilment.status).toBe(to);
    }
    expect((await readFulfilmentRow(c.assessmentId))[0].status).toBe("DELIVERED");
  });

  t("an illegal jump REQUESTED → DELIVERED is refused", async () => {
    const { c, fulfilmentId } = await paidClinicCase();
    const res = await api<{ error: string; from: string; allowed: string[] }>(
      `/api/admin/fulfilment/${fulfilmentId}/transition`,
      { method: "POST", session: admin, body: { to: "DELIVERED" } },
    );
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("illegal_transition");
    expect(res.body.from).toBe("REQUESTED");
    expect(res.body.allowed).toContain("CONFIRMED");
    // And the row did not move.
    expect((await readFulfilmentRow(c.assessmentId))[0].status).toBe("REQUESTED");
  });

  t("a DOCTOR cannot drive ops transitions", async () => {
    const { c, fulfilmentId } = await paidClinicCase();
    const res = await api(`/api/admin/fulfilment/${fulfilmentId}/transition`, {
      method: "POST",
      session: docA,
      body: { to: "CONFIRMED" },
    });
    expect(isDenied(res)).toBe(true);
    expect((await readFulfilmentRow(c.assessmentId))[0].status).toBe("REQUESTED");
  });

  t("ops CANNOT acknowledge — that is the clinic's word", async () => {
    const { fulfilmentId } = await paidClinicCase();
    const res = await api<{ error: string; reason: string }>(
      `/api/admin/fulfilment/${fulfilmentId}/transition`,
      { method: "POST", session: admin, body: { to: "ACKNOWLEDGED" } },
    );
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("clinic_owned_transition");
  });

  t("an invalid target is refused before it reaches the database", async () => {
    const { fulfilmentId } = await paidClinicCase();
    const res = await api<{ error: string }>(
      `/api/admin/fulfilment/${fulfilmentId}/transition`,
      { method: "POST", session: admin, body: { to: "TELEPORTED" } },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_target");
  });

  t("the clinic acknowledges only from DELIVERED", async () => {
    const { c, fulfilmentId } = await paidClinicCase();

    // Too early.
    const early = await api<{ error: string }>(
      `/api/doctor/fulfilment/${fulfilmentId}/acknowledge`,
      { method: "POST", session: docA, body: {} },
    );
    expect(early.status).toBe(409);
    expect(early.body.error).toBe("illegal_transition");

    for (const to of ["CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"]) {
      await api(`/api/admin/fulfilment/${fulfilmentId}/transition`, {
        method: "POST",
        session: admin,
        body: { to },
      });
    }

    const ok = await api<{ ok: boolean; fulfilment: { status: string } }>(
      `/api/doctor/fulfilment/${fulfilmentId}/acknowledge`,
      { method: "POST", session: docA, body: { notes: "WAVE0 synthetic receipt" } },
    );
    expect(ok.status).toBe(200);
    expect(ok.body.fulfilment.status).toBe("ACKNOWLEDGED");
    expect((await readFulfilmentRow(c.assessmentId))[0].status).toBe("ACKNOWLEDGED");
  });

  t("clinic B cannot acknowledge clinic A's delivery", async () => {
    const { c, fulfilmentId } = await paidClinicCase();
    for (const to of ["CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"]) {
      await api(`/api/admin/fulfilment/${fulfilmentId}/transition`, {
        method: "POST",
        session: admin,
        body: { to },
      });
    }

    const res = await api<{ error: string }>(
      `/api/doctor/fulfilment/${fulfilmentId}/acknowledge`,
      { method: "POST", session: docB, body: {} },
    );
    // 404, not 403 — a 403 would confirm the row exists at another clinic.
    expect(res.status).toBe(404);
    expect((await readFulfilmentRow(c.assessmentId))[0].status).toBe("DELIVERED");
  });

  t("a terminal request accepts nothing further", async () => {
    const { fulfilmentId } = await paidClinicCase();
    for (const to of ["CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"]) {
      await api(`/api/admin/fulfilment/${fulfilmentId}/transition`, {
        method: "POST",
        session: admin,
        body: { to },
      });
    }
    await api(`/api/doctor/fulfilment/${fulfilmentId}/acknowledge`, {
      method: "POST",
      session: docA,
      body: {},
    });

    const res = await api<{ error: string }>(
      `/api/admin/fulfilment/${fulfilmentId}/transition`,
      { method: "POST", session: admin, body: { to: "CANCELLED" } },
    );
    expect(res.status).toBe(409);
  });
});
