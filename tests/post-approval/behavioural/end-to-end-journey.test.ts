import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signCartToken } from "@/lib/cartToken";
import { signReportShareToken, patientReportHref } from "@/lib/reportShareToken";
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
  readDeliveryRows,
  readFulfilmentRow,
  readPaymentRow,
  type Wave0Case,
} from "./fixture";

// ONE complete Wave-0 operator journey, in order, end to end.
//
// The other suites prove individual guarantees. This proves the WORKFLOW: that
// the twenty-odd steps compose into a business process a clinic could actually
// run, against the migrated staging database, with nothing sent to anybody.
//
// It logs a status line per step — statuses only. No clinical answers, no
// tokens, no signed URLs, no phone numbers.

const PAYMENT_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET ?? "wave0-staging-payment-webhook-secret";
const WA_SECRET =
  process.env.WHATSAPP_WEBHOOK_SECRET ?? "wave0-staging-whatsapp-webhook-secret";

let up = false;
let docA: Session;
let docB: Session;
let admin: Session;
const created: Wave0Case[] = [];
const log: string[] = [];

function step(n: number, name: string, outcome: string) {
  log.push(`${String(n).padStart(2, "0")}. ${name.padEnd(46)} ${outcome}`);
}

beforeAll(async () => {
  assertStagingTarget();
  // trySetup skips (returns false) only when the app is unreachable or
  // the auth service is 5xx-ing. A REFUSED login still throws — see harness.
  up = await trySetup(async () => {
    docA = await login(IDENTITIES.doctorA);
    docB = await login(IDENTITIES.doctorB);
    admin = await login(IDENTITIES.superAdmin);
  });
}, 120_000);

afterAll(async () => {
  if (!up) return;
  for (const c of created) await deleteWave0Case(c);
  if (log.length) {
    console.log(`\n──── WAVE-0 SYNTHETIC JOURNEY ────\n${log.join("\n")}\n`);
  }
}, 180_000);

describe("Wave-0 end-to-end journey (CLINIC supply)", () => {
  it(
    "walks assessment → approval → share → view → pay → fulfil → acknowledge → treatment",
    async (ctx) => {
      if (!up) ctx.skip();

      const a = await prisma.doctor.findFirstOrThrow({
        where: { email: IDENTITIES.doctorA },
        select: { id: true, clinicId: true },
      });

      // ── 1 · Assessment exists and is complete ────────────────────────────
      const c = await createWave0Case({
        clinicId: a.clinicId,
        doctorId: a.id,
        fulfilmentMode: "CLINIC",
      });
      created.push(c);
      step(1, "Synthetic assessment completed", "COMPLETED");

      // ── 2 · Appears in the doctor's queue ────────────────────────────────
      const queue = await api<{ items?: Array<{ id: string }> }>(
        "/api/doctor/reports?limit=100",
        { session: docA },
      );
      step(2, "Visible to the reviewing clinic", `HTTP ${queue.status}`);
      expect(queue.status).toBe(200);

      // ── 3/4 · Correct doctor in, wrong clinic out ────────────────────────
      const mine = await api(`/api/doctor/journey/${c.assessmentId}`, { session: docA });
      expect(mine.status).toBe(200);
      step(3, "Own doctor opens the case", "ALLOWED");

      const theirs = await api(`/api/doctor/journey/${c.assessmentId}`, { session: docB });
      expect(isDenied(theirs)).toBe(true);
      step(4, "Wrong-clinic doctor", `DENIED (${theirs.status})`);

      // ── 5/6 · Reviewed and approved ──────────────────────────────────────
      const approved = await prisma.consultationVersion.findFirstOrThrow({
        where: { consultationId: c.consultationId },
        select: { approvalStatus: true },
      });
      expect(approved.approvalStatus).toBe("APPROVED");
      step(6, "Clinical report approved", "APPROVED");

      // ── 7 · Doctor previews the patient report ───────────────────────────
      const preview = await api(`/reports/${c.assessmentId}/one-page`, { session: docA });
      step(7, "Doctor previews patient report", `HTTP ${preview.status}`);
      expect([200, 307]).toContain(preview.status);

      // ── 8/9 · Explicit send, recorded, nothing actually sent ─────────────
      const sendReport = await api<{ ok: boolean; live: boolean }>(
        `/api/consultation/${c.assessmentId}/share`,
        { method: "POST", session: docA, body: { subject: "REPORT" } },
      );
      expect(sendReport.status).toBe(200);
      expect(sendReport.body.live).toBe(false);
      const reportRow = (await readDeliveryRows(c.assessmentId)).find(
        (r) => r.subject === "REPORT",
      )!;
      expect(reportRow.status).toBe("SENT");
      step(9, "Report delivery recorded", "SENT (test transport)");

      // ── 10/11 · Patient opens the secure link ────────────────────────────
      const reportToken = signReportShareToken(c.assessmentId);
      const patientReport = await api<string>(patientReportHref(reportToken));
      expect(patientReport.status).toBe(200);
      expect(String(patientReport.body)).toContain(c.patientFirstName);
      step(10, "Patient opens secure report", "RENDERED");

      const opens = await prisma.assessmentEvent.count({
        where: { assessmentId: c.assessmentId, type: "PATIENT_REPORT_OPENED" },
      });
      expect(opens).toBe(1);
      step(11, "Report open recorded", "1 event");

      // ── 12 · Doctor journey reflects it ──────────────────────────────────
      const j1 = await api<{ steps: Array<{ stage: string; state: string }> }>(
        `/api/doctor/journey/${c.assessmentId}`,
        { session: docA },
      );
      const stageState = (s: string) =>
        j1.body.steps.find((x) => x.stage === s)?.state;
      expect(stageState("REPORT_SENT")).toBe("done");
      expect(stageState("REPORT_OPENED")).toBe("done");
      step(12, "Doctor journey updated", "report sent + opened");

      // ── 13 · Doctor previews the cart ────────────────────────────────────
      const cartPreview = await api<{ order: { id: string } }>(
        `/api/cart/${c.assessmentId}`,
        { session: docA },
      );
      expect(cartPreview.status).toBe(200);
      step(13, "Doctor previews patient cart", "OK (not a patient view)");

      // ── 14 · Destination confirmed explicitly ────────────────────────────
      const mode = await api<{ ok: boolean; mode: string }>(
        `/api/doctor/orders/${c.kitOrderIntentId}/fulfilment-mode`,
        { method: "PUT", session: docA, body: { mode: "CLINIC" } },
      );
      expect(mode.status).toBe(200);
      step(14, "Fulfilment destination confirmed", "CLINIC (explicit)");

      // ── 15 · Cart sent ───────────────────────────────────────────────────
      const sendCart = await api<{ ok: boolean; live: boolean }>(
        `/api/consultation/${c.assessmentId}/share`,
        { method: "POST", session: docA, body: { subject: "CART" } },
      );
      expect(sendCart.status).toBe(200);
      expect(sendCart.body.live).toBe(false);
      step(15, "Cart delivery recorded", "SENT (test transport)");

      // ── 16/17 · Patient opens the cart ───────────────────────────────────
      const cartToken = signCartToken(c.assessmentId);
      const patientCart = await api<{ order: { id: string } }>(
        `/api/cart/${c.assessmentId}?t=${encodeURIComponent(cartToken)}`,
      );
      expect(patientCart.status).toBe(200);
      const cartViews = await prisma.assessmentEvent.count({
        where: { assessmentId: c.assessmentId, type: "PATIENT_CART_OPENED" },
      });
      expect(cartViews).toBe(1);
      step(17, "Cart view recorded", "1 event");

      // ── 18 · Checkout refused by the commercial guard ────────────────────
      //
      // JOURNEY A. PRICE_APPROVED is 0/30, so this cart holds lines that may
      // not be charged and patient-initiated payment is refused.
      //
      // The journey continues regardless, and that is the point worth keeping:
      // the authoritative money path is the signed gateway callback in step 19,
      // not the cart. A blocked checkout does not stop a clinic being paid —
      // it stops the PATIENT being quoted a price nobody approved.
      //
      // JOURNEY B — a fully chargeable cart returning 200, recording
      // checkoutStartedAt and staying idempotent — is proven in
      // tests/commerce/checkout-route-contract.test.ts against a mocked
      // commerce decision. Reproducing it here would need this server to treat
      // an unapproved price as approved, and no such switch exists by design.
      const checkout = await api<{ error: string; reasons: string[] }>(
        `/api/cart/${c.assessmentId}/checkout?t=${encodeURIComponent(cartToken)}`,
        { method: "POST" },
      );
      expect(checkout.status).toBe(409);
      expect(checkout.body.error).toBe("ORDER_NOT_CHARGEABLE");
      // A refused attempt writes nothing: it must never later read as a
      // checkout that started.
      expect(await readPaymentRow(c.assessmentId)).toHaveLength(0);
      step(18, "Checkout refused (commercial guard)", "409 ORDER_NOT_CHARGEABLE");

      // ── 19 · Payment confirmed by an authoritative source ────────────────
      const payBody = JSON.stringify({
        event: "payment.captured",
        kitOrderIntentId: c.kitOrderIntentId,
        paymentId: `pay_journey_${c.kitOrderIntentId}`,
        amountMinor: 450000,
      });
      const paySig = createHmac("sha256", PAYMENT_SECRET).update(payBody).digest("hex");
      const payRes = await fetch(`${BASE_URL}/api/payments/webhook/razorpay`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": paySig },
        body: payBody,
      });
      const payJson = (await payRes.json()) as Record<string, unknown>;
      expect(payJson.outcome).toBe("paid");
      expect((await readPaymentRow(c.assessmentId))[0].status).toBe("PAID");
      step(19, "Payment confirmed (signed webhook)", "PAID");

      // ── 20 · Exactly one fulfilment request ──────────────────────────────
      const fulfilments = await readFulfilmentRow(c.assessmentId);
      expect(fulfilments).toHaveLength(1);
      expect(fulfilments[0].status).toBe("REQUESTED");
      step(20, "Clinic fulfilment created", "REQUESTED (exactly 1)");
      const fulfilmentId = fulfilments[0].id;

      // ── 21 · Ops sees it ─────────────────────────────────────────────────
      const centre = await api<{
        groups: { kitFulfilmentAwaitingOps: { items: Array<{ assessmentId: string }> } };
      }>("/api/admin/action-centre", { session: admin });
      expect(
        centre.body.groups.kitFulfilmentAwaitingOps.items.map((i) => i.assessmentId),
      ).toContain(c.assessmentId);
      step(21, "Appears in Super Admin Action Centre", "LISTED");

      // ── 22 · Ops walks the state machine ─────────────────────────────────
      for (const to of ["CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"] as const) {
        const r = await api<{ fulfilment: { status: string } }>(
          `/api/admin/fulfilment/${fulfilmentId}/transition`,
          { method: "POST", session: admin, body: { to } },
        );
        expect(r.status).toBe(200);
        expect(r.body.fulfilment.status).toBe(to);
      }
      step(22, "Ops transitions", "REQUESTED→…→DELIVERED");

      // ── 23 · Clinic acknowledges receipt ─────────────────────────────────
      const ack = await api<{ fulfilment: { status: string } }>(
        `/api/doctor/fulfilment/${fulfilmentId}/acknowledge`,
        { method: "POST", session: docA, body: { notes: "WAVE0 synthetic receipt" } },
      );
      expect(ack.status).toBe(200);
      expect(ack.body.fulfilment.status).toBe("ACKNOWLEDGED");
      step(23, "Clinic acknowledges receipt", "ACKNOWLEDGED");

      // ── 24 · Treatment start recorded ────────────────────────────────────
      const treat = await api<{ startedAt: string }>(
        `/api/doctor/orders/${c.kitOrderIntentId}/treatment-start`,
        { method: "POST", session: docA, body: {} },
      );
      expect(treat.status).toBe(200);
      expect(treat.body.startedAt).toBeTruthy();
      step(24, "Treatment start recorded", "ANCHORED");

      // ── 25 · Journey reaches its terminal shape ──────────────────────────
      const final = await api<{
        cartLifecycle: string;
        steps: Array<{ stage: string; state: string }>;
        degraded: string[];
      }>(`/api/doctor/journey/${c.assessmentId}`, { session: docA });

      const state = (s: string) => final.body.steps.find((x) => x.stage === s)?.state;
      expect(final.body.cartLifecycle).toBe("FULFILLED");
      expect(final.body.degraded).toEqual([]);
      for (const s of [
        "DOCTOR_APPROVED",
        "REPORT_SENT",
        "REPORT_OPENED",
        "CART_SENT",
        "CART_VIEWED",
        "PAID",
        "FULFILMENT_REQUESTED",
        "DISPATCHED",
        "DELIVERED",
        "ACKNOWLEDGED",
        "TREATMENT_STARTED",
      ]) {
        expect(state(s)).toBe("done");
      }

      // CHECKOUT_STARTED is deliberately NOT in that list. The commercial
      // guard refused the patient's checkout at step 18, so no
      // checkoutStartedAt was ever written and the stage is honestly pending —
      // this patient did not start paying; the clinic's gateway callback did.
      //
      // Asserting "pending" rather than dropping the stage keeps the guard
      // visible: if a future change let a non-chargeable cart start a
      // checkout, this line fails.
      expect(state("CHECKOUT_STARTED")).toBe("pending");
      step(25, "Patient journey complete", "FULFILLED (checkout guarded)");

      // ── Provider status callback closes the delivery loop ────────────────
      const waBody = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WAVE0",
            changes: [
              {
                field: "messages",
                value: { statuses: [{ id: reportRow.messageId, status: "read" }] },
              },
            ],
          },
        ],
      });
      const waSig = createHmac("sha256", WA_SECRET).update(waBody).digest("hex");
      const waRes = await fetch(`${BASE_URL}/api/webhooks/whatsapp/meta_cloud`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": `sha256=${waSig}`,
        },
        body: waBody,
      });
      expect(waRes.status).toBe(200);
      const finalReportRow = (await readDeliveryRows(c.assessmentId)).find(
        (r) => r.subject === "REPORT",
      )!;
      expect(finalReportRow.readAt).toBeTruthy();
      step(26, "Provider read receipt applied", "READ");
    },
    600_000,
  );
});

describe("Wave-0 branch check (PATIENT delivery)", () => {
  it(
    "pays without ever creating a clinic fulfilment request",
    async (ctx) => {
      if (!up) ctx.skip();

      const a = await prisma.doctor.findFirstOrThrow({
        where: { email: IDENTITIES.doctorA },
        select: { id: true, clinicId: true },
      });
      const c = await createWave0Case({
        clinicId: a.clinicId,
        doctorId: a.id,
        fulfilmentMode: "PATIENT",
      });
      created.push(c);

      const body = JSON.stringify({
        event: "payment.captured",
        kitOrderIntentId: c.kitOrderIntentId,
        paymentId: `pay_patientbranch_${c.kitOrderIntentId}`,
        amountMinor: 450000,
      });
      const sig = createHmac("sha256", PAYMENT_SECRET).update(body).digest("hex");
      const res = await fetch(`${BASE_URL}/api/payments/webhook/razorpay`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": sig },
        body,
      });
      const json = (await res.json()) as Record<string, unknown>;

      expect(json.outcome).toBe("paid");
      expect(json.mode).toBe("PATIENT");
      expect(json.fulfilmentCreated).toBe(false);
      expect(await readFulfilmentRow(c.assessmentId)).toHaveLength(0);

      // And Ops is not shown a request that does not exist.
      const centre = await api<{
        groups: { kitFulfilmentAwaitingOps: { items: Array<{ assessmentId: string }> } };
      }>("/api/admin/action-centre", { session: admin });
      expect(
        centre.body.groups.kitFulfilmentAwaitingOps.items.map((i) => i.assessmentId),
      ).not.toContain(c.assessmentId);

      // The journey stays coherent rather than showing a permanently pending
      // clinic step for a request that will never be created.
      const j = await api<{
        cartLifecycle: string;
        steps: Array<{ stage: string; state: string; detail: string | null }>;
      }>(`/api/doctor/journey/${c.assessmentId}`, { session: docA });
      expect(j.body.cartLifecycle).toBe("PAID");
      const fulfilStep = j.body.steps.find((s) => s.stage === "FULFILMENT_REQUESTED");
      expect(fulfilStep?.state).toBe("not_applicable");
      expect(fulfilStep?.detail).toBe("Direct to patient");

      step(99, "PATIENT branch — no clinic fulfilment", "CONFIRMED");
    },
    300_000,
  );
});
