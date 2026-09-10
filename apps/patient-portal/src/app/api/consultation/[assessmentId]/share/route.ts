import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { resolveApprovedOrder } from "@/lib/consultation/approvedOrder";
import {
  DeliveryNotProvisionedError,
  DELIVERY_NOT_PROVISIONED,
} from "@/lib/delivery/deliveryStore";
import { requestOnePagerRenderForAssessment } from "@/lib/reports/assets/jobService";
import {
  buildReportWhatsAppMessage,
  readSendContext,
  sendPatientLink,
  type SendSubject,
} from "@/lib/delivery/sendPatientLink";
import { signReportShareToken, absolutePatientReportUrl } from "@/lib/reportShareToken";
import { signCartToken } from "@/lib/cartToken";
import { absoluteCartUrl } from "@/lib/doctor/cartHref";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

// POST /api/consultation/[assessmentId]/share
//
// The doctor's explicit "send this to the patient" action. Body:
//   { "subject": "REPORT" }   or   { "subject": "CART" }
//
// ── Why this endpoint exists at all ─────────────────────────────────────────
// Sharing was previously a `wa.me` deep link composed in the browser: the
// doctor's phone opened WhatsApp with a pre-filled message and a human pressed
// send. The server never learned that it happened, so nothing downstream could
// answer "was the report sent?", "to whom?", or "did it fail?" — and the
// doctor's only way to find out what happened after approval was to ring Ops.
//
// The deep-link path is NOT removed by this. It remains as the manual fallback
// for a clinic without a provider configured. What this adds is a server-side
// path that produces a record.
//
// ── The authority boundary, stated once ─────────────────────────────────────
// Three things must be true before a single character reaches a patient, and
// all three are checked HERE rather than inside the send helper:
//
//   1. The caller is an active Doctor (requireDoctorContext).
//   2. The assessment belongs to that doctor's clinic (assertDoctorInClinic).
//   3. The consultation's CURRENT version is APPROVED.
//
// (3) is the product principle in code: AI completion must never send clinical
// information to a patient, and a doctor cannot send a draft either. An
// approval that was later withdrawn (REVISION_REQUESTED) fails this check, so
// a re-send during a revision cycle is refused for the same reason the
// original send would have been.
//
// ── The recipient is never taken from the request ───────────────────────────
// There is no `phone` field in the accepted body, and adding one would turn
// this into an endpoint that sends arbitrary text to arbitrary numbers on the
// strength of a doctor session. The number is read from the patient's own
// record, keyed by the assessment the caller was already authorised for.

export const dynamic = "force-dynamic";

const VALID_SUBJECTS: ReadonlySet<string> = new Set(["REPORT", "CART"]);

/**
 * The host the patient's link must point at.
 *
 * Taken from the request the doctor is actually making, not from an
 * environment variable and not from the request BODY. An env var goes stale;
 * a body field would let the caller choose the host a patient is sent to,
 * which is a phishing primitive handed out with a doctor login.
 *
 * `x-forwarded-*` is what the platform proxy sets and is the only correct
 * source behind Vercel. Falling back to `host` covers local development, where
 * the scheme is http.
 */
function resolveOrigin(req: Request): string | null {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  // A patient link must not be sent over plaintext in a deployed environment:
  // the token in the URL is the credential.
  if (proto !== "https" && process.env.NODE_ENV === "production") return null;
  return `${proto}://${host}`;
}

export async function POST(
  req: Request,
  ctxParam: { params: Promise<{ assessmentId: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, mode: actorType } = authResult;

  const { assessmentId } = await ctxParam.params;

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    /**
     * "manual" composes the SAME governed link + message the automated path
     * would send and hands it back for the doctor's own WhatsApp to open —
     * it never calls the provider, never writes a WhatsappDelivery row, and
     * is not subject to the consent gate (a doctor's own deliberate,
     * per-message send is not "automated delivery"). Defaults to "auto".
     */
    mode?: "auto" | "manual";
  };
  const subject = body.subject;
  const mode = body.mode === "manual" ? "manual" : "auto";
  if (!subject || !VALID_SUBJECTS.has(subject)) {
    return NextResponse.json({ error: "invalid_subject" }, { status: 400 });
  }

  const context = await readSendContext(assessmentId);
  if (!context) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const scopeError = assertDoctorInClinic(doctor, context.clinicId);
  if (scopeError) return scopeError;

  // ── Gate 3: doctor approval ───────────────────────────────────────────────
  //
  // `resolveApprovedOrder` already encodes "the assessment's CURRENT
  // consultation version is APPROVED and its kit order is live" — it is what
  // the cart API and the doctor's preview both resolve through, so using it
  // here means the send gate cannot disagree with what the patient will
  // actually be able to open.
  //
  // For CART that is the whole condition: without an approved order the cart
  // endpoint answers "no confirmed plan yet", and sending a link to that is
  // worse than not sending.
  //
  // For REPORT the order is irrelevant — a report is shareable whether or not
  // kits were prescribed — so approval is read from the consultation version
  // directly.
  let consultationVersionId: string | null = null;
  if (subject === "CART") {
    const approved = await resolveApprovedOrder(prisma, assessmentId);
    if (!approved) {
      return NextResponse.json(
        { error: "not_approved", reason: "no_approved_order" },
        { status: 409 },
      );
    }
  } else {
    const consultation = await prisma.consultation.findUnique({
      where: { assessmentId },
      select: { currentVersion: { select: { id: true, approvalStatus: true } } },
    });
    if (String(consultation?.currentVersion?.approvalStatus) !== "APPROVED") {
      return NextResponse.json(
        { error: "not_approved", reason: "consultation_not_approved" },
        { status: 409 },
      );
    }
    consultationVersionId = consultation?.currentVersion?.id ?? null;

    // ── Safety net, not a trigger ─────────────────────────────────────────
    //
    // Approval is what asks for the one-pager, and by the time a doctor
    // reaches Share the artefact should already exist. This covers the case
    // where it does not — an approval that predates this pipeline, or one
    // whose row was lost — by ENSURING a row exists. It is idempotent on the
    // approved version, so pressing Share five times cannot create five jobs,
    // and it never waits for a render: whatever the artefact's state, the
    // message below goes out either way.
    void requestOnePagerRenderForAssessment(assessmentId, authUserId).catch(() => undefined);
  }

  const origin = resolveOrigin(req);
  if (!origin) {
    return NextResponse.json({ error: "origin_unresolved" }, { status: 400 });
  }

  // ── Manual mode ────────────────────────────────────────────────────────
  //
  // Same approval gates as above (already run), same secure token, same
  // message copy — buildReportWhatsAppMessage is the ONE function that
  // decides what a patient is told, so the manual and automated paths cannot
  // drift into two different messages. What differs is everything after:
  // no provider call, no WhatsappDelivery row, no consent check — a doctor
  // opening their own WhatsApp to press Send themselves is not "automated
  // delivery", and remains available exactly when the automated path is not
  // (no consent on file, Meta down, clinic still in manual launch mode).
  if (mode === "manual") {
    const token =
      subject === "REPORT"
        ? signReportShareToken(assessmentId)
        : signCartToken(assessmentId);
    const url =
      subject === "REPORT"
        ? absolutePatientReportUrl(origin, token)
        : absoluteCartUrl(origin, assessmentId, token);
    const text = buildReportWhatsAppMessage({
      subject: subject as SendSubject,
      patientFirstName: context.patient?.name?.split(" ")[0] ?? null,
      doctorName: context.reviewingDoctor?.name ?? doctor.name,
      clinicName: context.clinic?.name ?? null,
      product: context.product,
      url,
    });
    const to = context.patient?.phone?.replace(/[^\d]/g, "") ?? "";

    // Best-effort, never blocking: a doctor opening their own WhatsApp must
    // not be held up by an audit sink outage.
    void writeAuditLog({
      action: "MANUAL_SHARE_OPENED",
      entityType: "Assessment",
      entityId: assessmentId,
      assessmentId,
      clinicId: context.clinicId,
      actorId: authUserId,
      actorType: actorType,
      metadata: { subject },
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      waUrl: `https://wa.me/${to}?text=${encodeURIComponent(text)}`,
      hasPhone: to.length > 0,
    });
  }

  try {
    const result = await sendPatientLink({
      assessmentId,
      clinicId: context.clinicId,
      subject: subject as SendSubject,
      patientPhone: context.patient?.phone ?? null,
      patientFirstName: context.patient?.name?.split(" ")[0] ?? null,
      doctorName: context.reviewingDoctor?.name ?? doctor.name,
      clinicName: context.clinic?.name ?? null,
      product: context.product,
      sentByDoctorId: doctor.id,
      actorUserId: authUserId,
      actorType: actorType,
      origin,
      // Provenance for the delivery record: which patient, and which approved
      // version's content is being released. No session cookie travels with
      // this any more — the one-pager is read from storage as an already
      // rendered artefact, so there is nothing left for a credential to do.
      patientId: context.patientId ?? null,
      consultationVersionId,
      clinicWhatsappSettings: context.clinic?.whatsappSettings ?? null,
    });

    if (!result.ok) {
      // 422 rather than 500: both of these are states of the world the caller
      // can act on — correct the patient's number, or retry a transport that
      // was down — not faults in this request.
      return NextResponse.json(
        { error: result.reason, deliveryId: result.delivery?.id ?? null },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      delivery: {
        id: result.delivery.id,
        subject: result.delivery.subject,
        status: result.delivery.status,
        sentAt: result.delivery.sentAt,
      },
      // Surfaced so the doctor UI can say "recorded (test transport)" instead
      // of implying a patient's phone just buzzed. A UI that cannot tell the
      // difference will eventually tell a clinician something false.
      live: result.live,
      // True when an earlier call already delivered this exact approved
      // version — see the idempotency note in sendPatientLink.ts. The UI
      // reads this to say "already sent" rather than implying a fresh
      // message just went out.
      alreadySent: result.alreadySent,
      // Whether the one-page report travelled with the message. "Sent" alone
      // would not tell the doctor whether the patient received the page or
      // only a link to it.
      onePagerAttached: result.onePagerAttached,
      // And, when it did not, which fact that is: still being prepared, or
      // could not be produced. A doctor who is about to tell a patient
      // something needs the difference.
      onePagerUnavailable: result.onePagerUnavailable,
    });
  } catch (err) {
    if (err instanceof DeliveryNotProvisionedError) {
      return NextResponse.json(
        { error: DELIVERY_NOT_PROVISIONED },
        { status: 503 },
      );
    }
    throw err;
  }
}
