import { mergeWhatsappSettings } from "@/lib/clinic/whatsapp";

// WhatsApp sender resolution — the one place that decides WHICH WhatsApp
// Business number a message goes out from.
//
// ── The default architecture ────────────────────────────────────────────────
// One central Dr FACT WhatsApp Business number serves every clinic unless a
// clinic has been explicitly configured onto its own. Nothing about a clinic
// requires its own number, and nothing downstream of this module (the
// provider, the delivery record, the doctor UI) branches on which sender was
// used — it just gets a resolved set of credentials.
//
// ── Where credentials live, and why never in the database ──────────────────
// `Clinic.whatsappSettings.senderKey` is a REFERENCE ("finance-clinic-A"), not
// a secret. The actual phone number id and access token for a named sender
// come from server-only environment variables, keyed by that reference:
//
//   WHATSAPP_SENDER_<KEY>_PHONE_NUMBER_ID
//   WHATSAPP_SENDER_<KEY>_ACCESS_TOKEN
//   WHATSAPP_SENDER_<KEY>_API_VERSION        (optional, falls back to WHATSAPP_API_VERSION)
//
// The central sender is the existing, unnamed WHATSAPP_PHONE_NUMBER_ID /
// WHATSAPP_ACCESS_TOKEN — unchanged, so a deployment that has never touched
// this feature keeps working exactly as it did.
//
// ── Resolution order (spec) ──────────────────────────────────────────────────
//   1. An active, correctly-configured clinic-specific sender, if the clinic
//      opted into one.
//   2. The central Dr FACT sender.
//   3. CONFIGURATION_ERROR.
// A clinic whose OWN sender is misconfigured therefore degrades to sending
// from the shared central number rather than failing outright — the central
// number is the platform's own default identity every clinic already uses
// until it configures otherwise, not a foreign one, so falling back to it is
// not an identity leak. It only reaches CONFIGURATION_ERROR when NEITHER
// resolves, which requires the platform-wide default itself to be unset.

export interface ResolvedWhatsAppSender {
  /** "CENTRAL", or the clinic's configured sender key. Recorded for support triage, never logged with the token. */
  key: string;
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
}

export type WhatsAppSenderResolution =
  | { ok: true; sender: ResolvedWhatsAppSender }
  | { ok: false; reason: "no_credentials_configured" };

const CENTRAL_KEY = "CENTRAL";

function envSender(prefix: string | null): ResolvedWhatsAppSender | null {
  const phoneNumberId = prefix
    ? process.env[`WHATSAPP_SENDER_${prefix}_PHONE_NUMBER_ID`]
    : process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = prefix
    ? process.env[`WHATSAPP_SENDER_${prefix}_ACCESS_TOKEN`]
    : process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;

  const apiVersion =
    (prefix ? process.env[`WHATSAPP_SENDER_${prefix}_API_VERSION`] : undefined) ??
    process.env.WHATSAPP_API_VERSION ??
    "v21.0";

  return { key: prefix ?? CENTRAL_KEY, phoneNumberId, accessToken, apiVersion };
}

/** Uppercase, alphanumeric-and-underscore only — turns a free-form sender key into a safe env-var segment. */
function normaliseSenderKey(key: string): string {
  return key.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * Resolve the sender this clinic's automated WhatsApp messages should use.
 *
 * Takes the clinic's raw `whatsappSettings` JSON directly (not a clinicId) so
 * this stays a pure function — the caller already has the clinic row loaded
 * (see sendPatientLink.ts's readSendContext) and this module never touches
 * the database itself.
 */
export function resolveWhatsAppSender(clinicWhatsappSettings: unknown): WhatsAppSenderResolution {
  const settings = mergeWhatsappSettings(clinicWhatsappSettings);

  if (settings.senderMode === "CLINIC_SPECIFIC" && settings.senderKey) {
    const clinicSender = envSender(normaliseSenderKey(settings.senderKey));
    if (clinicSender) return { ok: true, sender: clinicSender };
    // Falls through to central — see the resolution-order note above.
  }

  const central = envSender(null);
  if (central) return { ok: true, sender: central };

  return { ok: false, reason: "no_credentials_configured" };
}
