import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { tokenFingerprint } from "@/lib/journey/events";
import { signCartToken } from "@/lib/cartToken";
import { absoluteCartUrl } from "@/lib/doctor/cartHref";
import {
  absolutePatientReportUrl,
  signReportShareToken,
} from "@/lib/reportShareToken";
import {
  createDelivery,
  findExistingSuccessfulDelivery,
  getDeliveryById,
  markDeliveryFailed,
  markDeliverySent,
  recordDeliveryReportProvenance,
  DeliveryRaceLostError,
  type DeliveryRecord,
  type DeliverySubject,
} from "./deliveryStore";
import {
  getWhatsappProvider,
  normaliseWhatsappNumber,
} from "./whatsappProvider";
import { resolveWhatsAppSender } from "./whatsappSender";
import {
  loadApprovedOnePagerImage,
  type OnePagerUnavailable,
} from "./onePagerImage";
import { getPatientWhatsappConsent } from "@/lib/patient/whatsappConsent";

// Sending a report or cart link to a patient.
//
// ── The authority boundary ──────────────────────────────────────────────────
// This function does NOT decide whether sending is allowed. The caller — the
// share route — resolves the doctor, checks the tenant, and checks that the
// consultation is approved, then calls this with a decision already made. The
// split is deliberate: an authorisation check buried inside a "send message"
// helper is one a future caller can bypass by not going through the helper.
//
// What this file owns is everything AFTER the decision: minting the right
// token, writing the durable delivery record, calling the transport, and
// recording what happened.
//
// ── Nothing is auto-sent ────────────────────────────────────────────────────
// There is no path from pipeline completion, from consultation approval, or
// from any background worker into this function. Every send originates in an
// explicit clinician action on a named button. AI completion never messages a
// patient.

export type SendSubject = DeliverySubject;

/** Which assessment product this send is for — decides "Hair" vs "Skin" in the copy. Defaults to HAIR for every existing caller. */
export type AssessmentProduct = "HAIR" | "SKIN";

export interface SendPatientLinkInput {
  assessmentId: string;
  clinicId: string;
  subject: SendSubject;
  /** As stored on Patient. Normalised and validated here. */
  patientPhone: string | null;
  patientFirstName: string | null;
  doctorName: string | null;
  /** Displayed in the message body — see buildReportWhatsAppMessage. Null omits the clause rather than naming a placeholder clinic. */
  clinicName: string | null;
  product?: AssessmentProduct;
  /** Acting Doctor.id — attribution for the outward action. */
  sentByDoctorId: string;
  /** Audit attribution for the authenticated identity behind the action. */
  actorUserId: string;
  actorType: "doctor" | "admin_view";
  /**
   * Scheme + host the patient's link must point at, taken from the request
   * that triggered the send.
   *
   * Not read from NEXT_PUBLIC_APP_URL: a stale or unset env var would put a
   * host that does not serve this clinic into a message sent to a real
   * patient, and the failure is invisible until someone reports a dead link.
   */
  origin: string;
  /**
   * The consultation version being released. Recorded on the delivery row so
   * a historical send names the exact approved version whose content the
   * patient received, and — for REPORT — used as the idempotency key: a
   * second send for the SAME version, once one has already succeeded, is
   * short-circuited rather than contacting the provider again. Optional only
   * for CART, whose approval is read from the order rather than a
   * consultation version.
   */
  consultationVersionId?: string | null;
  /** The patient this delivery is for. Required to check consent — see the no_consent result below. */
  patientId: string | null;
  /** The clinic's raw `whatsappSettings` JSON, for sender resolution. Passed in rather than re-queried — the caller already has the Clinic row loaded. */
  clinicWhatsappSettings?: unknown;
}

export type SendPatientLinkResult =
  | {
      ok: true;
      delivery: DeliveryRecord;
      live: boolean;
      /** True when an existing successful delivery for this exact consultation version was found and reused — no second provider call was made. */
      alreadySent: boolean;
      /**
       * Whether the one-page report actually travelled with the message.
       *
       * Reported rather than assumed: the render is best-effort, so a doctor
       * who was told "report sent" needs to know whether the patient got the
       * page or only the link. `false` for a CART, which never attaches one.
       */
      onePagerAttached: boolean;
      /**
       * Why no one-pager travelled, when none did. The doctor is told
       * something different for "still being prepared" than for "rendering
       * failed", because those are different facts and only one of them is
       * worth waiting for.
       */
      onePagerUnavailable: OnePagerUnavailable | null;
    }
  | {
      ok: false;
      reason: "no_phone" | "send_failed" | "no_consent" | "configuration_error";
      delivery: DeliveryRecord | null;
    };

/**
 * Wave-0 patient copy.
 *
 * ── What is deliberately absent ─────────────────────────────────────────────
 * No diagnosis, no severity, no kit names, no prices, no clinical finding of
 * any kind. A WhatsApp message body is stored on the patient's phone, on the
 * clinic's phone, in WhatsApp's cloud backup, and in the notification preview
 * that appears on a lock screen anyone standing nearby can read. So the body
 * says that something is ready and where to open it, and every clinical fact
 * lives behind the authenticated link.
 *
 * The forwarding warning is there because the token IS the credential: a
 * patient who forwards the message forwards their own medical record.
 *
 * Exported (not just used internally) so the manual `wa.me` fallback can
 * compose the SAME text the automated path would have sent — one function,
 * not two copies of this message that can drift apart. See
 * apps/patient-portal/src/app/api/consultation/[assessmentId]/share/route.ts
 * `mode: "manual"`.
 */
export function buildReportWhatsAppMessage(input: {
  subject: SendSubject;
  patientFirstName: string | null;
  doctorName: string | null;
  clinicName: string | null;
  product: AssessmentProduct;
  url: string;
}): string {
  const { subject, patientFirstName, doctorName, clinicName, product, url } = input;
  const greeting = patientFirstName ? `Hi ${patientFirstName},` : "Hi,";
  const doctor = doctorName ? `Dr. ${doctorName.replace(/^Dr\.?\s*/i, "")}` : "your doctor";
  const clinicClause = clinicName ? ` at ${clinicName}` : "";
  const assessmentLabel = product === "SKIN" ? "Skin Assessment" : "Hair Assessment";

  if (subject === "REPORT") {
    return (
      `${greeting}\n\n` +
      `Your ${assessmentLabel} Report reviewed by\n${doctor}${clinicClause}\nis ready.\n\n` +
      `View your secure report:\n${url}\n\n` +
      `This report contains private health information. Please do not forward this link.\n\n` +
      `— Dr FACT`
    );
  }

  return (
    `${greeting}\n\n` +
    `${doctor}${clinicClause} has confirmed your recommended care plan.\n\n` +
    `Review and confirm it here:\n${url}\n\n` +
    `This link is personal to you. Please do not forward it.\n\n` +
    `— Dr FACT`
  );
}

/**
 * Template id for a given delivery subject.
 *
 * Kept as a function rather than a module-level constant so that environment
 * variables set after module load (test overrides, runtime injection) are
 * respected. A WhatsApp template must be registered and approved with the
 * provider before it can be used, so the set of valid values is fixed by what
 * has been approved, not by what a clinic types into a settings field.
 */
function templateIdFor(subject: SendSubject): string | null {
  if (subject === "REPORT") return process.env.WHATSAPP_TEMPLATE_REPORT ?? null;
  if (subject === "CART") return process.env.WHATSAPP_TEMPLATE_CART ?? null;
  return null;
}

/**
 * drfact_report_ready_v1 declares exactly 5 BODY variables:
 *   {{1}} patient first name
 *   {{2}} Hair / Skin
 *   {{3}} doctor display name (without "Dr." prefix)
 *   {{4}} clinic display name
 *   {{5}} secure report URL
 *
 * This constant is the single place that encodes the approved slot count.
 * A future template with a different slot count gets its own constant.
 */
const REPORT_TEMPLATE_BODY_PARAM_COUNT = 5;

const TERMINAL_STATUSES = new Set(["SENT", "DELIVERED", "FAILED", "CONFIGURATION_ERROR", "BLOCKED_NO_CONSENT"]);

/**
 * Resolve a lost `createDelivery` race: another request already owns this
 * (assessmentId, subject, consultationVersionId) tuple. Poll briefly for it
 * to reach a terminal state — it may still be PENDING, mid-flight in the
 * winning request — rather than either re-inserting (which the unique index
 * would refuse again) or calling the provider ourselves (which is exactly
 * the double-send this closes). Bounded at ~1.5s: long enough for a dev/live
 * provider call to finish, short enough not to hang a doctor's click.
 */
async function awaitRaceWinner(deliveryId: string): Promise<DeliveryRecord | null> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const row = await getDeliveryById(deliveryId);
    if (!row || TERMINAL_STATUSES.has(row.status)) return row;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return getDeliveryById(deliveryId);
}

export async function sendPatientLink(
  input: SendPatientLinkInput,
): Promise<SendPatientLinkResult> {
  const to = normaliseWhatsappNumber(input.patientPhone);
  if (!to) {
    // No row is written. A delivery record with no recipient records an
    // attempt that was never possible, and would show up in the ops queue as a
    // failure to retry — when the actual fix is to correct the patient's
    // number on their record.
    return { ok: false, reason: "no_phone", delivery: null };
  }

  // ── Consent gate ─────────────────────────────────────────────────────────
  //
  // This is the ONE place an automated (provider-contacting) send checks
  // consent — the manual `wa.me` fallback never reaches this function at all,
  // so it is unaffected. No patientId means consent cannot be verified, which
  // resolves the same as "no" rather than "unknown = allowed" — PROVIDED the
  // consent system itself is provisioned (see below).
  //
  // `provisioned: false` — the 20260908_whatsapp_report_delivery migration has
  // not been applied here — deliberately does NOT block. This function sent
  // reports (with no consent concept at all) before this feature existed, and
  // an unmigrated environment must keep doing exactly that: "the gate is not
  // installed yet" and "the gate is installed and says no" are different
  // facts, and only the second one may refuse a send. The alternative —
  // failing closed on unprovisioned — would silently break every existing
  // deployment's WhatsApp sharing the moment this code ships, before anyone
  // deliberately switched anything on, which is the opposite of this
  // project's own launch-mode discipline (WHATSAPP_AUTOMATION_ENABLED=false
  // by default; a second, invisible feature flag would defeat the point of
  // having an explicit one).
  const consent = input.patientId
    ? await getPatientWhatsappConsent(input.patientId)
    : { consent: false, consentAt: null, consentSource: null, provisioned: true };
  const consentBlocks = consent.provisioned && !consent.consent;

  if (consentBlocks) {
    // Recorded rather than silently refused: a BLOCKED_NO_CONSENT row proves
    // an automated send was attempted and correctly declined, which is what
    // distinguishes "the system respected the patient's choice" from "nobody
    // tried". See docs — the manual fallback remains available regardless.
    const delivery = await createDelivery({
      assessmentId: input.assessmentId,
      clinicId: input.clinicId,
      subject: input.subject,
      patientPhone: to,
      templateId: templateIdFor(input.subject),
      sentByDoctorId: input.sentByDoctorId,
    });
    const blocked = await markDeliveryFailed({
      deliveryId: delivery.id,
      error: "no_whatsapp_consent",
      providerStatus: null,
      status: "BLOCKED_NO_CONSENT",
    });
    await writeAuditLog({
      action: "PATIENT_DELIVERY_FAILED",
      entityType: "WhatsappDelivery",
      entityId: delivery.id,
      assessmentId: input.assessmentId,
      clinicId: input.clinicId,
      actorId: input.actorUserId,
      actorType: input.actorType,
      metadata: { subject: input.subject, reason: "no_whatsapp_consent" },
    });
    return { ok: false, reason: "no_consent", delivery: blocked ?? delivery };
  }

  // ── Idempotency ──────────────────────────────────────────────────────────
  //
  // A double-click, or a browser retrying a request it believes failed, must
  // not put a second message on a patient's phone for content they already
  // received. Scoped to the EXACT approved version: a genuinely new send
  // (retry after failure, or a newer approved version) still goes through.
  if (input.consultationVersionId) {
    const existing = await findExistingSuccessfulDelivery({
      assessmentId: input.assessmentId,
      subject: input.subject,
      consultationVersionId: input.consultationVersionId,
    });
    if (existing) {
      return {
        ok: true,
        delivery: existing,
        live: getWhatsappProvider(resolveWhatsAppSender(input.clinicWhatsappSettings)).live,
        alreadySent: true,
        // Provenance from a prior send is not re-derived here — the caller
        // already has it from the FIRST successful response, and this path
        // exists specifically to avoid doing that work twice.
        onePagerAttached: false,
        onePagerUnavailable: null,
      };
    }
  }

  // Mint the credential for the subject being sent. Each is bound to this one
  // assessment and expires; neither carries patient data. See lib/cartToken
  // and lib/reportShareToken.
  const token =
    input.subject === "REPORT"
      ? signReportShareToken(input.assessmentId)
      : signCartToken(input.assessmentId);

  const url =
    input.subject === "REPORT"
      ? absolutePatientReportUrl(input.origin, token)
      : absoluteCartUrl(input.origin, input.assessmentId, token);

  const body = buildReportWhatsAppMessage({
    subject: input.subject,
    patientFirstName: input.patientFirstName,
    doctorName: input.doctorName,
    clinicName: input.clinicName,
    product: input.product ?? "HAIR",
    url,
  });

  // Durable record first, provider second — see createDelivery. Guarded
  // against a concurrent duplicate: two simultaneous calls for the exact
  // same (assessment, subject, consultationVersionId) can both pass the
  // idempotency SELECT above before either has written a row — that race was
  // reproduced live against staging. WhatsappDelivery_idempotency_key makes
  // the SECOND insert fail instead of silently succeeding; the loser reads
  // back what the winner actually did rather than calling the provider too.
  let delivery: DeliveryRecord;
  try {
    delivery = await createDelivery({
      assessmentId: input.assessmentId,
      clinicId: input.clinicId,
      subject: input.subject,
      patientPhone: to,
      templateId: templateIdFor(input.subject),
      sentByDoctorId: input.sentByDoctorId,
      consultationVersionId: input.consultationVersionId ?? null,
    });
  } catch (err) {
    if (err instanceof DeliveryRaceLostError) {
      const winner = await awaitRaceWinner(err.existingDeliveryId);
      const live = getWhatsappProvider(resolveWhatsAppSender(input.clinicWhatsappSettings)).live;
      if (winner && (winner.status === "SENT" || winner.status === "DELIVERED")) {
        return {
          ok: true,
          delivery: winner,
          live,
          alreadySent: true,
          onePagerAttached: false,
          onePagerUnavailable: null,
        };
      }
      if (winner && (winner.status === "FAILED" || winner.status === "CONFIGURATION_ERROR")) {
        return {
          ok: false,
          reason: winner.status === "CONFIGURATION_ERROR" ? "configuration_error" : "send_failed",
          delivery: winner,
        };
      }
      if (winner && winner.status === "BLOCKED_NO_CONSENT") {
        return { ok: false, reason: "no_consent", delivery: winner };
      }
      // Still PENDING after the poll window (the winner is genuinely slow,
      // not vanished — its row was found moments ago by createDelivery's own
      // conflict lookup): never call the provider a second time for a tuple
      // someone else already claimed. The safe default is "treat as already
      // handled" rather than retrying into the same conflict.
      const pending: DeliveryRecord = winner ?? {
        id: err.existingDeliveryId,
        assessmentId: input.assessmentId,
        subject: input.subject,
        status: "PENDING",
        templateId: templateIdFor(input.subject),
        messageId: null,
        providerStatus: null,
        attempts: 0,
        lastError: null,
        sentByDoctorId: input.sentByDoctorId,
        createdAt: new Date().toISOString(),
        sentAt: null,
        deliveredAt: null,
        readAt: null,
      };
      return {
        ok: true,
        delivery: pending,
        live,
        alreadySent: true,
        onePagerAttached: false,
        onePagerUnavailable: null,
      };
    }
    throw err;
  }

  // ── The one-pager image, for a REPORT ────────────────────────────────────
  //
  // Attached only to REPORT. A CART message asks the patient to confirm an
  // order; there is no clinical page to show and nothing to gain from putting
  // one in a chat thread.
  //
  // ── What this trades ────────────────────────────────────────────────────
  // Everything else in this module keeps clinical facts BEHIND the
  // authenticated link, because a message body lives on the patient's phone,
  // in WhatsApp's cloud backup, and in a lock-screen preview. An attached
  // image is clinical content by definition, and unlike the link it cannot be
  // revoked once forwarded. That is a deliberate product decision, not an
  // oversight — `WHATSAPP_ATTACH_ONE_PAGER=0` turns it off without a deploy.
  //
  // ── No browser runs here ────────────────────────────────────────────────
  // This READS the artefact that was rendered when the doctor approved. It
  // does not render, does not launch Chromium, does not enqueue and does not
  // wait: a doctor's Share must not be able to block on, or fail because of, a
  // browser. When the artefact is not READY the message goes without it and
  // the doctor is told which of "not ready yet" and "could not be made" they
  // are looking at.
  const attachOnePager =
    input.subject === "REPORT" && process.env.WHATSAPP_ATTACH_ONE_PAGER !== "0";
  const lookup = attachOnePager ? await loadApprovedOnePagerImage(input.assessmentId) : null;
  const image = lookup?.ok ? lookup.image : null;
  const onePagerUnavailable = lookup && !lookup.ok ? lookup.reason : null;
  // The asset id is worth recording even when its bytes did not travel: a
  // delivery that went out while the artefact was still rendering should still
  // name the artefact it was waiting for.
  const attemptedAssetId = lookup && !lookup.ok ? lookup.assetId : null;

  const senderResolution = resolveWhatsAppSender(input.clinicWhatsappSettings);
  const provider = getWhatsappProvider(senderResolution);

  // ── Build governed template BODY parameters ──────────────────────────────
  //
  // drfact_report_ready_v1 requires exactly 5 body variables in a fixed order.
  // Built here — not in the provider — because the provider must remain
  // ignorant of Patient/Doctor/Clinic data (P0-B). The inputs are already
  // present from the caller's context, so no additional DB queries are needed.
  //
  // CART and any future template with zero body variables: bodyParameters stays
  // null, the provider sends the template with no BODY component, and the
  // existing behaviour is fully preserved.
  //
  // Patient first name uses the governed application fallback ("there") if
  // absent — "Hi there," is already the free-text path's fallback for the same
  // reason: a missing first name is a data quality issue, not a send blocker,
  // but an empty slot in a WhatsApp template variable is a rejected call.
  let templateBodyParameters: string[] | null = null;

  if (input.subject === "REPORT" && templateIdFor("REPORT")) {
    const productLabel = (input.product ?? "HAIR") === "SKIN" ? "Skin" : "Hair";
    const doctorDisplay = input.doctorName
      ? input.doctorName.replace(/^Dr\.?\s*/i, "").trim()
      : null;

    // ── Pre-flight validation (fail closed) ────────────────────────────────
    //
    // Only patient first name may fall back to a governed default. Every other
    // required variable must resolve to a non-empty string before we touch the
    // provider. An incorrectly parameterised template would be rejected by Meta
    // with an HTTP 400, but we must never let that rejection show up as a
    // WhatsappDelivery row that looks SENT — so we validate here, mark the
    // delivery FAILED, and return an honest result.
    const missingRequired: string[] = [];
    if (!doctorDisplay) missingRequired.push("doctor_name");
    if (!input.clinicName?.trim()) missingRequired.push("clinic_name");
    if (!url) missingRequired.push("secure_report_url");

    if (missingRequired.length > 0) {
      const failed = await markDeliveryFailed({
        deliveryId: delivery.id,
        error: `whatsapp_template_missing_params: ${missingRequired.join(", ")}`,
        providerStatus: null,
        status: "FAILED",
      });
      await writeAuditLog({
        action: "PATIENT_DELIVERY_FAILED",
        entityType: "WhatsappDelivery",
        entityId: delivery.id,
        assessmentId: input.assessmentId,
        clinicId: input.clinicId,
        actorId: input.actorUserId,
        actorType: input.actorType,
        metadata: { subject: input.subject, reason: "template_missing_params", missingRequired },
      });
      return { ok: false, reason: "send_failed", delivery: failed ?? delivery };
    }

    templateBodyParameters = [
      input.patientFirstName?.trim() || "there",  // {{1}} patient first name (governed fallback)
      productLabel,                                // {{2}} Hair / Skin
      doctorDisplay!,                              // {{3}} doctor display name
      input.clinicName!.trim(),                   // {{4}} clinic display name
      url,                                         // {{5}} secure report URL
    ];

    // Guard: the constant and the array length must agree. This should be
    // unreachable after a normal edit — but a future developer who adds a slot
    // and forgets to update the constant (or vice versa) gets an EXPLICIT
    // failure here rather than a silent Meta rejection.
    if (templateBodyParameters.length !== REPORT_TEMPLATE_BODY_PARAM_COUNT) {
      const failed = await markDeliveryFailed({
        deliveryId: delivery.id,
        error: `whatsapp_template_param_count_mismatch: expected ${REPORT_TEMPLATE_BODY_PARAM_COUNT} got ${templateBodyParameters.length}`,
        providerStatus: null,
        status: "FAILED",
      });
      await writeAuditLog({
        action: "PATIENT_DELIVERY_FAILED",
        entityType: "WhatsappDelivery",
        entityId: delivery.id,
        assessmentId: input.assessmentId,
        clinicId: input.clinicId,
        actorId: input.actorUserId,
        actorType: input.actorType,
        metadata: { subject: input.subject, reason: "template_param_count_mismatch", expected: REPORT_TEMPLATE_BODY_PARAM_COUNT, actual: templateBodyParameters.length },
      });
      return { ok: false, reason: "send_failed", delivery: failed ?? delivery };
    }
  }

  const result = await provider.send({
    to,
    body,
    templateId: templateIdFor(input.subject),
    image,
    templateBodyParameters,
  });

  const fingerprint = tokenFingerprint(token);

  if (result.status === "FAILED" || result.status === "CONFIGURATION_ERROR") {
    const failed = await markDeliveryFailed({
      deliveryId: delivery.id,
      error: result.error ?? "send_failed",
      providerStatus: result.providerStatus,
      status: result.status === "CONFIGURATION_ERROR" ? "CONFIGURATION_ERROR" : "FAILED",
    });
    await writeAuditLog({
      action: "PATIENT_DELIVERY_FAILED",
      entityType: "WhatsappDelivery",
      entityId: delivery.id,
      assessmentId: input.assessmentId,
      clinicId: input.clinicId,
      actorId: input.actorUserId,
      actorType: input.actorType,
      // Reason code and subject only. No phone number, no link, no token.
      metadata: {
        subject: input.subject,
        reason: result.error ?? "send_failed",
        provider: provider.name,
        senderKey: senderResolution.ok ? senderResolution.sender.key : null,
      },
    });
    return {
      ok: false,
      reason: result.status === "CONFIGURATION_ERROR" ? "configuration_error" : "send_failed",
      delivery: failed ?? delivery,
    };
  }

  const sent = await markDeliverySent({
    deliveryId: delivery.id,
    messageId: result.providerMessageId,
    providerStatus: result.providerStatus,
  });

  // ── What exactly this patient received (PHASE 16) ───────────────────────
  //
  // Written as its own tolerant statement rather than folded into the INSERT
  // above. These columns arrive with a later migration than the ones the
  // insert depends on, and a deployment that has applied one and not the other
  // must still be able to send a patient their report — losing the provenance
  // is a gap in the record, losing the send is a gap in the care.
  //
  // The asset's hash is COPIED, not referenced. A re-render tomorrow must not
  // be able to change what this row says was delivered today.
  await recordDeliveryReportProvenance({
    deliveryId: delivery.id,
    patientId: input.patientId ?? null,
    channel: "WHATSAPP",
    consultationVersionId: image?.consultationVersionId ?? input.consultationVersionId ?? null,
    reportAssetId: image?.assetId ?? attemptedAssetId,
    onePagerAttached: input.subject === "REPORT" ? image !== null : null,
    assetSha256: image?.sha256 ?? null,
    assetTemplateVersion: image?.templateVersion ?? null,
  });

  await writeAuditLog({
    action: input.subject === "REPORT" ? "PATIENT_REPORT_SHARED" : "PATIENT_CART_SHARED",
    entityType: "Assessment",
    entityId: input.assessmentId,
    assessmentId: input.assessmentId,
    clinicId: input.clinicId,
    actorId: input.actorUserId,
    actorType: input.actorType,
    metadata: {
      subject: input.subject,
      deliveryId: delivery.id,
      actingDoctorId: input.sentByDoctorId,
      provider: provider.name,
      // Whether a human was actually contacted. Without this, a staging audit
      // trail is indistinguishable from a production one.
      live: provider.live,
      senderKey: senderResolution.ok ? senderResolution.sender.key : null,
      // Correlates this audit row with the link that was sent, without storing
      // the link. See tokenFingerprint.
      tokenFingerprint: fingerprint,
      // Whether the patient received the clinical page itself, not just a link
      // to it. The two are materially different disclosures, so the audit
      // trail has to distinguish them.
      onePagerAttached: image !== null,
      // Which artefact, and which bytes. An audit row that says "a report was
      // shared" without naming the version is a row that cannot answer the
      // only question anyone ever asks it afterwards.
      reportAssetId: image?.assetId ?? null,
      consultationVersionId: image?.consultationVersionId ?? null,
      assetSha256: image?.sha256 ?? null,
      onePagerUnavailable,
    },
  });

  return {
    ok: true,
    delivery: sent ?? delivery,
    live: provider.live,
    alreadySent: false,
    onePagerAttached: image !== null,
    onePagerUnavailable,
  };
}

/**
 * The patient's phone, first name, clinic and reviewing doctor for a send.
 *
 * Its own query because the share route must not hand this function a patient
 * phone number that arrived in a request body — that would make the endpoint a
 * way to send arbitrary messages to arbitrary numbers. The recipient is read
 * from the patient's own record, keyed by the assessment, and nowhere else.
 *
 * `concern` is read over a second, raw query rather than folded into the
 * `select` above: it lives inside the `rawResponses` JSON blob
 * (`__meta.concern`), and pulling the whole blob into this typed select to
 * reach one key would be the most expensive way to answer "hair or skin".
 * Same pattern reviewPayload.ts already uses for the same field.
 */
export async function readSendContext(assessmentId: string) {
  const [row, concernRows] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        clinicId: true,
        patientId: true,
        patient: { select: { name: true, phone: true } },
        reviewingDoctor: { select: { name: true } },
        clinic: { select: { name: true, whatsappSettings: true } },
      },
    }),
    prisma.$queryRaw<Array<{ concern: string | null }>>`
      SELECT "rawResponses"->'__meta'->>'concern' AS "concern"
        FROM "Assessment"
       WHERE "id" = ${assessmentId}
       LIMIT 1
    `,
  ]);
  if (!row) return null;
  const concern = concernRows[0]?.concern ?? null;
  return {
    ...row,
    product: (concern?.startsWith("skin_") ? "SKIN" : "HAIR") as AssessmentProduct,
  };
}
