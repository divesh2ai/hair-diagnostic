// WhatsApp production configuration — the definitive env-var contract, and a
// health check that proves a deployment is ready to send without ever
// exposing what the credentials actually are.
//
// ══ WHY THIS EXISTS ═════════════════════════════════════════════════════════
//
// Every variable named below is already read somewhere in the delivery
// pipeline (whatsappProvider.ts, whatsappSender.ts, whatsappWebhook.ts,
// sendPatientLink.ts) — this module does not introduce new configuration, it
// is the single place that states what "configured" means across all of it,
// so a deploy can be checked in one call instead of by reading five files.
//
// ══ WHAT THIS MUST NEVER DO ═════════════════════════════════════════════════
//
// Return a credential value, a prefix of one, its length, or any other string
// that narrows what an attacker would have to guess. The health check answers
// exactly one question — READY or CONFIGURATION_ERROR — and, when it is the
// second, WHICH named settings are missing (a settings key like
// "WHATSAPP_ACCESS_TOKEN", never its value).

export type WhatsappConfigStatus = "READY" | "CONFIGURATION_ERROR";

export interface WhatsappConfigCheck {
  status: WhatsappConfigStatus;
  /** Env var NAMES only — never values. Empty when status is READY. */
  missing: string[];
  /**
   * "dev" when live sending is not authorised for this deployment (the two
   * switches below), "meta_cloud" once it is. A health check on a deployment
   * that is intentionally still in manual-launch mode should read READY dev,
   * not be reported as broken.
   */
  transport: "dev" | "meta_cloud";
}

/**
 * The two switches that gate a REAL send — see whatsappProvider.ts. A
 * deployment that has not turned these on is correctly reported READY (dev
 * transport): "not live yet" is a deliberate launch state, not a
 * configuration error.
 */
function liveSendAuthorised(): boolean {
  return (
    (process.env.WHATSAPP_PROVIDER ?? "dev").toLowerCase() === "meta_cloud" &&
    process.env.WHATSAPP_LIVE_SEND === "1" &&
    process.env.NODE_ENV === "production"
  );
}

/**
 * The CENTRAL sender's credentials — the platform-wide default every clinic
 * uses until it opts into its own (see whatsappSender.ts's resolution order).
 * A clinic-specific `WHATSAPP_SENDER_<KEY>_*` override is validated per-clinic
 * at send time, not here: this call has no clinic to check, and a clinic that
 * has not configured one falls back to the central sender by design, so it is
 * not this check's concern either.
 */
const CENTRAL_SENDER_VARS = ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN"] as const;

/** At least one template is required — REPORT is the one every automated approval can send. */
const TEMPLATE_VARS = ["WHATSAPP_TEMPLATE_REPORT"] as const;

/**
 * Webhook receipt — required for READY because without it a deployment can
 * SEND but can never learn DELIVERED/READ/FAILED, which is the whole point of
 * the automated path over the manual `wa.me` fallback.
 */
const WEBHOOK_VARS = ["WHATSAPP_WEBHOOK_SECRET", "WHATSAPP_WEBHOOK_VERIFY_TOKEN"] as const;

/**
 * Evaluate this deployment's WhatsApp configuration.
 *
 * `provisioned` (the migration flag, from getPatientWhatsappConsent /
 * deliveryStore) is deliberately NOT part of this — those already fail open
 * on their own, independently, and folding a THIRD switch in here would make
 * this function unable to answer "is the provider configured" without also
 * knowing the database's migration state, which is not a fact about
 * environment variables.
 */
export function checkWhatsappConfig(): WhatsappConfigCheck {
  if (!liveSendAuthorised()) {
    return { status: "READY", missing: [], transport: "dev" };
  }

  const missing: string[] = [];
  for (const key of CENTRAL_SENDER_VARS) if (!process.env[key]) missing.push(key);
  for (const key of TEMPLATE_VARS) if (!process.env[key]) missing.push(key);
  for (const key of WEBHOOK_VARS) if (!process.env[key]) missing.push(key);

  return {
    status: missing.length === 0 ? "READY" : "CONFIGURATION_ERROR",
    missing,
    transport: "meta_cloud",
  };
}
