import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  signReportShareToken,
  patientReportHref,
} from "@/lib/reportShareToken";
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
  readDeliveryRows,
  type Wave0Case,
} from "./fixture";

// BEHAVIOURAL: report sharing + the patient report surface.
//
// Real HTTP, real sessions, real rows. These replace the source-reading guards
// for the two things that actually matter here: who may cause a message to be
// sent to a patient, and what a share token can open.

let up = false;
let docA: Session;
let docB: Session;
let clinicA: { clinicId: string; doctorId: string };
let approvedCase: Wave0Case;
let unapprovedCase: Wave0Case;
let otherCase: Wave0Case;

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
    clinicA = { clinicId: a.clinicId, doctorId: a.id };

    approvedCase = await createWave0Case({ ...clinicA });
    unapprovedCase = await createWave0Case({ ...clinicA, approved: false });
    otherCase = await createWave0Case({ ...clinicA });
  });
}, 120_000);

afterAll(async () => {
  if (!up) return;
  for (const c of [approvedCase, unapprovedCase, otherCase]) {
    if (c) await deleteWave0Case(c);
  }
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

describe("POST /api/consultation/[id]/share — who may message a patient", () => {
  t("the assessment's own doctor CAN send the report", async () => {
    const res = await api<{ ok: boolean; live: boolean; delivery: { status: string } }>(
      `/api/consultation/${approvedCase.assessmentId}/share`,
      { method: "POST", session: docA, body: { subject: "REPORT" } },
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // The transport must not have contacted anybody.
    expect(res.body.live).toBe(false);
    expect(res.body.delivery.status).toBe("SENT");

    const rows = await readDeliveryRows(approvedCase.assessmentId);
    const report = rows.find((r) => r.subject === "REPORT");
    expect(report).toBeTruthy();
    expect(report!.status).toBe("SENT");
    expect(report!.sentAt).toBeTruthy();
    // Marks the row as a test send, so no reader can mistake it for a real one.
    expect(report!.providerStatus).toBe("dev_accepted");
  });

  t("a doctor from ANOTHER clinic cannot", async () => {
    const res = await api(`/api/consultation/${approvedCase.assessmentId}/share`, {
      method: "POST",
      session: docB,
      body: { subject: "REPORT" },
    });
    expect(isDenied(res)).toBe(true);
    // Concealment: the refusal must not distinguish "exists elsewhere" from
    // "does not exist".
    expect([403, 404]).toContain(res.status);
  });

  t("an unauthenticated caller cannot", async () => {
    const res = await api(`/api/consultation/${approvedCase.assessmentId}/share`, {
      method: "POST",
      body: { subject: "REPORT" },
    });
    expect(isDenied(res)).toBe(true);
  });

  t("an UNAPPROVED consultation cannot be sent, even by its own doctor", async () => {
    // The product principle, enforced: approval is the authority boundary.
    const res = await api<{ error: string }>(
      `/api/consultation/${unapprovedCase.assessmentId}/share`,
      { method: "POST", session: docA, body: { subject: "REPORT" } },
    );
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("not_approved");

    const rows = await readDeliveryRows(unapprovedCase.assessmentId);
    expect(rows).toHaveLength(0);
  });

  t("the recipient cannot be supplied by the client", async () => {
    // A phone in the body must be ignored entirely — otherwise this endpoint
    // sends arbitrary text to arbitrary numbers on a doctor session.
    const before = await readDeliveryRows(otherCase.assessmentId);
    const res = await api(`/api/consultation/${otherCase.assessmentId}/share`, {
      method: "POST",
      session: docA,
      body: { subject: "REPORT", phone: "+441234567890", to: "+441234567890" },
    });
    expect(res.status).toBe(200);

    const after = await readDeliveryRows(otherCase.assessmentId);
    expect(after.length).toBe(before.length + 1);

    // The stored recipient is the patient's own number, not the injected one.
    const stored = await prisma.$queryRaw<Array<{ patientPhone: string }>>`
      SELECT "patientPhone" FROM "WhatsappDelivery"
       WHERE "assessmentId" = ${otherCase.assessmentId}
       ORDER BY "createdAt" DESC LIMIT 1
    `;
    expect(stored[0].patientPhone).not.toContain("441234567890");
    expect(stored[0].patientPhone).toContain("9999000001");
  });

  t("an unknown subject is rejected", async () => {
    const res = await api<{ error: string }>(
      `/api/consultation/${approvedCase.assessmentId}/share`,
      { method: "POST", session: docA, body: { subject: "PRESCRIPTION" } },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_subject");
  });
});

describe("GET /patient/report/[token] — what a share token opens", () => {
  t("a valid token renders THAT patient's report", async () => {
    const token = signReportShareToken(approvedCase.assessmentId);
    const res = await api<string>(patientReportHref(token));
    expect(res.status).toBe(200);
    const html = String(res.body);
    // The UNIQUE first name proves this token resolved to this record and no
    // other. The report renders a first name only, by design.
    expect(html).toContain(approvedCase.patientFirstName);
    expect(html).not.toContain("This link is no longer valid");
  });

  t("the open is recorded — once per visit window", async () => {
    const token = signReportShareToken(approvedCase.assessmentId);
    await api(patientReportHref(token));
    await api(patientReportHref(token));

    const events = await prisma.assessmentEvent.findMany({
      where: { assessmentId: approvedCase.assessmentId, type: "PATIENT_REPORT_OPENED" },
    });
    // De-duplicated inside the 30-minute window: a refresh is not a new read.
    expect(events).toHaveLength(1);
  });

  t("assessment A's token CANNOT open assessment B", async () => {
    const tokenForOther = signReportShareToken(otherCase.assessmentId);
    const res = await api<string>(patientReportHref(tokenForOther));
    expect(res.status).toBe(200);
    const html = String(res.body);
    // It opens its OWN record and cannot reach the other one: there is no
    // field in the request in which to name a different assessment.
    expect(html).toContain(otherCase.patientFirstName);
    expect(html).not.toContain(approvedCase.patientFirstName);
    expect(html).not.toContain(approvedCase.assessmentId);
  });

  t("a tampered token fails safely", async () => {
    const token = signReportShareToken(approvedCase.assessmentId);
    const [body, sig] = token.split(".");
    const tampered = `${body}.${sig.slice(0, -1)}${sig.at(-1) === "a" ? "b" : "a"}`;
    const res = await api<string>(patientReportHref(tampered));
    expect(res.status).toBe(200);
    expect(String(res.body)).toContain("This link is no longer valid");
  });

  t("an expired token says so, and shows nothing", async () => {
    const expired = signReportShareToken(approvedCase.assessmentId, -1000);
    const res = await api<string>(patientReportHref(expired));
    expect(res.status).toBe(200);
    const html = String(res.body);
    expect(html).toContain("This link has expired");
    expect(html).not.toContain(approvedCase.patientFirstName);
  });

  t("garbage fails safely and leaks no existence information", async () => {
    const res = await api<string>(patientReportHref("not-a-real-token"));
    expect(res.status).toBe(200);
    expect(String(res.body)).toContain("This link is no longer valid");
  });

  t("an UNAPPROVED consultation is not shown to a token holder", async () => {
    // The revocation lever: a doctor moving a case back to revision closes
    // every outstanding link.
    const token = signReportShareToken(unapprovedCase.assessmentId);
    const res = await api<string>(patientReportHref(token));
    expect(res.status).toBe(200);
    const html = String(res.body);
    expect(html).toContain("being reviewed");
    expect(html).not.toContain(unapprovedCase.patientFirstName);
  });

  t("a report token is refused by the CART endpoint", async () => {
    const reportToken = signReportShareToken(approvedCase.assessmentId);
    const res = await api(
      `/api/cart/${approvedCase.assessmentId}?t=${encodeURIComponent(reportToken)}`,
    );
    expect(res.status).toBe(404);
  });
});
