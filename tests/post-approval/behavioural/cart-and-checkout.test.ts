import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signCartToken } from "@/lib/cartToken";
import { signReportShareToken } from "@/lib/reportShareToken";
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
  readPaymentRow,
  type Wave0Case,
} from "./fixture";

// BEHAVIOURAL: the patient cart, and the distinction that matters most on it —
// a DOCTOR previewing a cart is not a PATIENT viewing it.

let up = false;
let docA: Session;
let docB: Session;
let c: Wave0Case;

beforeAll(async () => {
  assertStagingTarget();
  // trySetup skips (returns false) only when the app is unreachable or
  // the auth service is 5xx-ing. A REFUSED login still throws — see harness.
  up = await trySetup(async () => {
    docA = await login(IDENTITIES.doctorA);
    docB = await login(IDENTITIES.doctorB);

    const a = await prisma.doctor.findFirstOrThrow({
      where: { email: IDENTITIES.doctorA },
      select: { id: true, clinicId: true },
    });
    c = await createWave0Case({ clinicId: a.clinicId, doctorId: a.id });
  });
}, 120_000);

afterAll(async () => {
  if (up && c) await deleteWave0Case(c);
}, 120_000);

/**
 * One behavioural test.
 *
 * When setup could not run, the test is marked SKIPPED — not passed. An
 * early `return` would count as a pass, which is precisely the failure this
 * suite exists to prevent: a security check reporting green because it never
 * ran. `ctx.skip()` makes the run report say so.
 */
const t = (name: string, fn: () => Promise<void>, ms = 60_000) =>
  it(name, async (ctx) => {
    if (!up) ctx.skip();
    await fn();
  }, ms);

async function cartViews(assessmentId: string) {
  return prisma.assessmentEvent.count({
    where: { assessmentId, type: "PATIENT_CART_OPENED" },
  });
}

describe("GET /api/cart/[id] — access", () => {
  t("the doctor's own session opens the cart (the preview path)", async () => {
    const res = await api<{ order: { id: string }; lineItems: unknown[] }>(
      `/api/cart/${c.assessmentId}`,
      { session: docA },
    );
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(c.kitOrderIntentId);
  });

  t("a DOCTOR PREVIEW does not count as a patient view", async () => {
    // The defect this prevents: a doctor's own verification click being
    // reported back to that doctor as proof the patient has seen the plan.
    const before = await cartViews(c.assessmentId);
    await api(`/api/cart/${c.assessmentId}`, { session: docA });
    await api(`/api/cart/${c.assessmentId}`, { session: docA });
    expect(await cartViews(c.assessmentId)).toBe(before);
  });

  t("a valid patient token opens the cart AND records the view", async () => {
    const token = signCartToken(c.assessmentId);
    const before = await cartViews(c.assessmentId);
    const res = await api<{ order: { id: string } }>(
      `/api/cart/${c.assessmentId}?t=${encodeURIComponent(token)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(c.kitOrderIntentId);
    expect(await cartViews(c.assessmentId)).toBe(before + 1);
  });

  t("no token and no session is concealed as 404", async () => {
    const res = await api<{ error: string }>(`/api/cart/${c.assessmentId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("no_active_order");
  });

  t("an invalid token is never upgraded to a session check", async () => {
    // Present-but-bad token must NOT fall through to the doctor-session path.
    const res = await api(`/api/cart/${c.assessmentId}?t=garbage`, {
      session: docA,
    });
    expect(res.status).toBe(404);
  });

  t("another clinic's doctor is concealed as 404", async () => {
    const res = await api(`/api/cart/${c.assessmentId}`, { session: docB });
    expect(res.status).toBe(404);
  });

  t("a cart token for another assessment is rejected", async () => {
    const other = signCartToken("some-other-assessment-id");
    const res = await api(
      `/api/cart/${c.assessmentId}?t=${encodeURIComponent(other)}`,
    );
    expect(res.status).toBe(404);
  });

  t("a REPORT token cannot open the cart", async () => {
    const reportToken = signReportShareToken(c.assessmentId);
    const res = await api(
      `/api/cart/${c.assessmentId}?t=${encodeURIComponent(reportToken)}`,
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/cart/[id]/checkout — starting payment", () => {
  // ── CURRENT COMMERCIAL REALITY ──────────────────────────────────────────
  //
  // PRICE_APPROVED is 0/30, so every cart on this system holds at least one
  // line that may not be charged and checkout is refused. These cases assert
  // that refusal against a real server and a real row.
  //
  // The 200 path — a fully chargeable cart starting a PENDING checkout, and
  // staying idempotent when repeated — is proven in
  // tests/commerce/checkout-route-contract.test.ts, which mocks the commerce
  // decision in-process. It cannot be proven here: this suite drives a
  // separate server process, and the only way to make THAT process treat a
  // cart as chargeable would be a switch approving prices from the
  // environment. Such a switch could leak into production and let real
  // patients be charged against unapproved prices, which is the exact hazard
  // this layer exists to remove — so it does not exist.

  t("a valid patient token is refused while the cart is non-chargeable", async () => {
    const token = signCartToken(c.assessmentId);
    const res = await api<{ error: string; reasons: string[] }>(
      `/api/cart/${c.assessmentId}/checkout?t=${encodeURIComponent(token)}`,
      { method: "POST" },
    );
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("ORDER_NOT_CHARGEABLE");
    expect(res.body.reasons.length).toBeGreaterThan(0);

    // Nothing written. A refused commercial attempt must not leave a row that
    // later reads operationally as "this patient started paying".
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });

  t("repeating a blocked checkout stays blocked and writes nothing", async () => {
    const token = signCartToken(c.assessmentId);
    for (const _attempt of [1, 2, 3]) {
      const res = await api(
        `/api/cart/${c.assessmentId}/checkout?t=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      expect(res.status).toBe(409);
    }

    // Still no row — so there is no checkoutStartedAt to reset, and an
    // abandoned-cart report cannot mistake three refusals for three attempts
    // to pay.
    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });

  t("a browser CANNOT reach PAID through this endpoint", async () => {
    // The free-kits test, in its current form. The request is refused before
    // the payment store is reached at all, so the body's claims never get the
    // chance to matter. The same assertion against a CHARGEABLE cart — 200,
    // row stays PENDING, amount and source stay null — lives in
    // tests/commerce/checkout-route-contract.test.ts.
    const token = signCartToken(c.assessmentId);
    const res = await api(
      `/api/cart/${c.assessmentId}/checkout?t=${encodeURIComponent(token)}`,
      {
        method: "POST",
        body: { status: "PAID", paid: true, amountMinor: 1, source: "CLINIC_COUNTER" },
      },
    );
    expect(res.status).toBe(409);

    expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
  });

  t("no token is concealed as 404 and writes nothing", async () => {
    const fresh = await createWave0Case({
      clinicId: c.clinicId,
      doctorId: c.doctorId,
    });
    try {
      const res = await api(`/api/cart/${fresh.assessmentId}/checkout`, {
        method: "POST",
      });
      expect(res.status).toBe(404);
      expect(await readPaymentRow(fresh.assessmentId)).toHaveLength(0);
    } finally {
      await deleteWave0Case(fresh);
    }
  });

  t("a doctor session alone cannot start a patient's checkout", async () => {
    const fresh = await createWave0Case({
      clinicId: c.clinicId,
      doctorId: c.doctorId,
    });
    try {
      const res = await api(`/api/cart/${fresh.assessmentId}/checkout`, {
        method: "POST",
        session: docA,
      });
      expect(isDenied(res)).toBe(true);
      expect(await readPaymentRow(fresh.assessmentId)).toHaveLength(0);
    } finally {
      await deleteWave0Case(fresh);
    }
  });
});
