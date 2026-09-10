// WhatsApp transport abstraction.
//
// ── What this is for ────────────────────────────────────────────────────────
// Today the only way the platform "sends" a patient anything is a `wa.me`
// deep link: the doctor's browser opens WhatsApp with a pre-filled message and
// a human presses send. That works, but the server learns nothing from it — it
// cannot say whether the message was sent, to whom, or whether it failed, and
// those are the questions the whole post-approval workflow is built to answer.
//
// This module is the seam. Everything above it (the share endpoint, the
// delivery record, the doctor's journey view) is written against the provider
// INTERFACE and is complete. Below it, which transport is in use is a
// deployment decision.
//
// ── Nothing real is sent unless someone deliberately switches it on ─────────
// The default transport is `dev`, which records the message and returns a
// synthetic id without contacting anyone. Live sending requires BOTH a
// configured provider AND `WHATSAPP_LIVE_SEND=1`, and the live adapter refuses
// outside production. Two independent switches, because "we accidentally
// messaged a real patient during testing" is not a recoverable mistake — the
// message is on their phone.
//
// ── Statuses ────────────────────────────────────────────────────────────────
// This interface exposes only what a provider genuinely reports back on the
// send call: accepted, or failed. DELIVERED and READ are asynchronous
// callbacks in every WhatsApp Business API, so they are not invented here —
// `deliveryStore.markProviderStatus` exists for a webhook to write them when
// one is wired up, and until then those columns stay null rather than being
// filled with an optimistic guess.

import type { ResolvedWhatsAppSender, WhatsAppSenderResolution } from "./whatsappSender";

/**
 * CONFIGURATION_ERROR is distinct from FAILED: it means no attempt reached
 * the network at all, because credentials for the resolved sender do not
 * exist. A doctor's "Retry WhatsApp" must never be offered for this state —
 * retrying cannot succeed until an operator fixes the deployment, and an
 * infinite retry loop against a state that can never change is worse than an
 * honest "not configured" message.
 */
export type WhatsappSendStatus = "ACCEPTED" | "FAILED" | "CONFIGURATION_ERROR";

/**
 * An image sent alongside the message.
 *
 * ── The bytes travel, not a URL ─────────────────────────────────────────────
 * Meta accepts either a public `link` or an uploaded media id. This interface
 * only carries BYTES, deliberately: a link would have to be reachable by
 * Meta's fetchers without our authentication, which means publishing a
 * patient's clinical summary at an unauthenticated URL and hoping nobody
 * else finds it. Uploading the bytes keeps the image inside the authenticated
 * channel until WhatsApp itself delivers it.
 *
 * ── What attaching an image costs ───────────────────────────────────────────
 * Unlike the link in `body`, an attached image is the clinical content. It
 * lands in the phone's gallery and WhatsApp's cloud backup, renders in a
 * lock-screen preview, and can be forwarded with no token to revoke. That is a
 * deliberate trade the caller makes; see sendPatientLink.
 */
export interface WhatsappOutboundImage {
  /** Raw image bytes. */
  data: Uint8Array;
  mimeType: "image/png";
  /** Filename shown by the client. Must not contain clinical detail. */
  filename: string;
}

export interface WhatsappOutboundMessage {
  /** E.164 without the leading '+', e.g. "919876543210". */
  to: string;
  /** Plain body. Callers must keep clinical detail out of this — see copy.ts. */
  body: string;
  /**
   * Provider template identifier, when the transport is template-based. Meta's
   * Cloud API refuses free-form text outside a 24-hour customer service
   * window, so a production deployment will almost always be sending a
   * template; `body` is then the rendered preview kept for our own records.
   */
  templateId?: string | null;
  /**
   * BODY component parameters for Meta template messages.
   *
   * When present and non-empty, these are sent as the template's body
   * parameters in order: `[{ type: "text", text: param }]` per slot. The
   * count must exactly match the approved template's declared variable count;
   * the governed layer (sendPatientLink) validates this before calling the
   * provider — the provider sends exactly what it receives.
   *
   * For templates with zero body variables (e.g. a CART template that carries
   * no dynamic text), omit or pass null/[]. The HEADER component for an
   * attached image is built independently — HEADER and BODY can coexist.
   */
  templateBodyParameters?: string[] | null;
  /**
   * Optional image. When present the message is sent as an image with `body`
   * as its caption, rather than as text.
   *
   * A provider that cannot attach media must still send the text — losing the
   * message because the picture failed is strictly worse than sending the
   * link on its own.
   */
  image?: WhatsappOutboundImage | null;
}

export interface WhatsappSendResult {
  status: WhatsappSendStatus;
  /** The provider's message id, when it issued one. */
  providerMessageId: string | null;
  /** The provider's own status string, kept verbatim for support triage. */
  providerStatus: string | null;
  /** Operator-facing failure description. Never contains the message body. */
  error?: string;
}

export interface WhatsappProvider {
  readonly name: string;
  /** True when this transport actually contacts a real person. */
  readonly live: boolean;
  send(message: WhatsappOutboundMessage): Promise<WhatsappSendResult>;
}

/**
 * Development / staging transport. Contacts nobody.
 *
 * It logs the recipient's LAST FOUR DIGITS only. A full phone number in an
 * application log is a patient identifier sitting in a log aggregator that
 * outlives the request, gets shipped to a third party, and is readable by
 * everyone with dashboard access — and it is not needed to debug a send. The
 * body is never logged at all: it contains a live share link.
 */
const devProvider: WhatsappProvider = {
  name: "dev",
  live: false,
  async send(message) {
    const tail = message.to.slice(-4).padStart(4, "•");
    console.info(
      `[whatsapp:dev] would send to ••••${tail}` +
        (message.templateId ? ` template=${message.templateId}` : "") +
        // Byte count only. The image IS the clinical summary, so it is never
        // written to disk or logged here.
        (message.image ? ` image=${message.image.data.byteLength}B` : ""),
    );
    return {
      status: "ACCEPTED",
      // Prefixed so a synthetic id is never mistaken for a provider's in a
      // support conversation or a reconciliation query.
      providerMessageId: `dev_${cryptoRandomId()}`,
      providerStatus: "dev_accepted",
    };
  },
};

/**
 * Meta WhatsApp Cloud API.
 *
 * Written out rather than stubbed so switching on live delivery is a
 * configuration change and not a development task. It is nonetheless inert
 * until three things are true: the provider is selected, credentials exist
 * for the RESOLVED SENDER (central or clinic-specific — see
 * whatsappSender.ts, which has already run by the time this is called), and
 * WHATSAPP_LIVE_SEND is explicitly "1".
 */
function metaCloudProvider(sender: ResolvedWhatsAppSender): WhatsappProvider {
  const { phoneNumberId, accessToken, apiVersion } = sender;

  return {
    name: "meta_cloud",
    live: true,
    async send(message) {
      // ── Upload the image first, if there is one ──────────────────────────
      //
      // Two calls, and the order matters: Meta will not accept image bytes on
      // the /messages endpoint, so they are uploaded to /media in exchange for
      // an id which the message then references. An upload failure must NOT
      // fail the send — we fall back to the text-only message, because a
      // patient who receives the link is served and a patient who receives
      // nothing is not.
      let mediaId: string | null = null;
      if (message.image) {
        mediaId = await uploadMedia(
          apiVersion,
          phoneNumberId,
          accessToken,
          message.image,
        );
        if (!mediaId) {
          console.warn(
            "[whatsapp] image upload failed — sending the link without the attachment",
          );
        }
      }

      // Build the components array for a template payload.
      // HEADER and BODY are independent — both may be present simultaneously.
      // ── HEADER ──────────────────────────────────────────────────────────────
      // Media goes into the HEADER component. Only added when an image was
      // successfully uploaded above. Omitted entirely for text-only templates.
      // ── BODY ────────────────────────────────────────────────────────────────
      // Dynamic text variables are sent as BODY parameters. The approved
      // template declares the variable slots; the count here must match.
      // Validated by sendPatientLink before this point — the provider sends
      // exactly what it receives without second-guessing the count.
      const components: Array<{ type: string; parameters: unknown[] }> = [];
      if (mediaId) {
        components.push({
          type: "header",
          parameters: [{ type: "image", image: { id: mediaId } }],
        });
      }
      if (message.templateBodyParameters?.length) {
        components.push({
          type: "body",
          parameters: message.templateBodyParameters.map((text) => ({ type: "text", text })),
        });
      }

      const payload = message.templateId
        ? {
            messaging_product: "whatsapp",
            to: message.to,
            type: "template",
            template: {
              name: message.templateId,
              language: { code: process.env.WHATSAPP_TEMPLATE_LOCALE ?? "en" },
              ...(components.length > 0 ? { components } : {}),
            },
          }
        : mediaId
          ? {
              messaging_product: "whatsapp",
              to: message.to,
              type: "image",
              // The body becomes the caption, so the patient still gets the
              // link and the forwarding warning under the picture.
              image: { id: mediaId, caption: message.body.slice(0, 1024) },
            }
          : {
              messaging_product: "whatsapp",
              to: message.to,
              type: "text",
              text: { preview_url: false, body: message.body },
            };

      try {
        const res = await fetch(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );

        if (!res.ok) {
          // The provider's error body can echo the message we sent, which
          // contains a live share link, so it is not propagated. The status
          // code is enough to route a support ticket.
          return {
            status: "FAILED",
            providerMessageId: null,
            providerStatus: `http_${res.status}`,
            error: `whatsapp_send_failed_http_${res.status}`,
          };
        }

        const json = (await res.json()) as {
          messages?: Array<{ id?: string }>;
        };
        return {
          status: "ACCEPTED",
          providerMessageId: json.messages?.[0]?.id ?? null,
          providerStatus: "accepted",
        };
      } catch {
        return {
          status: "FAILED",
          providerMessageId: null,
          providerStatus: null,
          error: "whatsapp_transport_error",
        };
      }
    },
  };
}

/**
 * Exchange image bytes for a Meta media id.
 *
 * Returns null on any failure. Every caller treats that as "send the text
 * without the picture" rather than as an error, so this never throws.
 *
 * Meta caps image uploads at 5 MB. The guard is here rather than at the call
 * site because it is a property of the transport, not of the report.
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function uploadMedia(
  apiVersion: string,
  phoneNumberId: string,
  accessToken: string,
  image: WhatsappOutboundImage,
): Promise<string | null> {
  if (image.data.byteLength === 0 || image.data.byteLength > MAX_IMAGE_BYTES) {
    console.warn(
      `[whatsapp] image rejected before upload: ${image.data.byteLength} bytes`,
    );
    return null;
  }

  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", image.mimeType);
    form.append(
      "file",
      new Blob([image.data as BlobPart], { type: image.mimeType }),
      image.filename,
    );

    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
      {
        method: "POST",
        // No Content-Type header: fetch sets the multipart boundary itself.
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      },
    );

    if (!res.ok) {
      // Status only. An error body from Meta can echo request details.
      console.warn(`[whatsapp] media upload failed http_${res.status}`);
      return null;
    }

    const json = (await res.json()) as { id?: string };
    return json.id ?? null;
  } catch {
    console.warn("[whatsapp] media upload transport error");
    return null;
  }
}

/**
 * A provider that never contacts anyone and always reports
 * CONFIGURATION_ERROR — what `getWhatsappProvider` returns when meta_cloud is
 * selected, live sending is authorised, but no credentials could be resolved
 * for any sender (central or clinic-specific). Distinct from `devProvider`:
 * dev reports ACCEPTED, because in dev nothing being sent is expected and
 * correct; this reports the genuine deployment fault it is.
 */
function configurationErrorProvider(): WhatsappProvider {
  return {
    name: "meta_cloud",
    live: true,
    async send() {
      return {
        status: "CONFIGURATION_ERROR",
        providerMessageId: null,
        providerStatus: null,
        error: "whatsapp_provider_not_configured",
      };
    },
  };
}

/**
 * The transport this deployment will use.
 *
 * ── The two switches, and why both ──────────────────────────────────────────
 * `WHATSAPP_PROVIDER` selects an adapter. `WHATSAPP_LIVE_SEND` authorises it
 * to contact a human. Selecting the Meta adapter on a staging box — which
 * someone will do while testing the credentials — must not start messaging
 * patients, so selection alone is not enough.
 *
 * The production check is the third guard: a live send from a non-production
 * NODE_ENV is refused outright. Staging databases are restored from, and seeded
 * with, real-looking phone numbers.
 *
 * `senderResolution` is resolved by the CALLER (see whatsappSender.ts) from
 * the clinic making the send, so this function stays ignorant of clinics —
 * it only ever asks "is there a sender to send from at all".
 */
export function getWhatsappProvider(
  senderResolution: WhatsAppSenderResolution,
): WhatsappProvider {
  const selected = (process.env.WHATSAPP_PROVIDER ?? "dev").toLowerCase();
  if (selected !== "meta_cloud") return devProvider;

  const authorised =
    process.env.WHATSAPP_LIVE_SEND === "1" &&
    process.env.NODE_ENV === "production";

  if (!authorised) {
    console.info(
      "[whatsapp] meta_cloud selected but live sending is not authorised — using dev transport",
    );
    return devProvider;
  }

  if (!senderResolution.ok) {
    console.warn(
      "[whatsapp] meta_cloud selected and live sending authorised, but no sender credentials resolved",
    );
    return configurationErrorProvider();
  }

  return metaCloudProvider(senderResolution.sender);
}

/**
 * E.164 digits, no '+'.
 *
 * Returns null rather than a best guess when the input cannot be made into a
 * plausible number. A malformed number that is "fixed" into a valid one is a
 * message delivered to a stranger, which is a PHI disclosure — so an
 * unrecognisable number fails the send instead.
 *
 * The one assumption made is the 10-digit Indian mobile, which is how numbers
 * are stored throughout this platform; it is applied only when the length is
 * exactly 10, never as a fallback for anything else.
 */
export function normaliseWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

function cryptoRandomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
