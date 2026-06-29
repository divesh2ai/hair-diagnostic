import type {
  NotificationChannel,
  NotificationPayload,
  NotificationRecipient,
  NotificationResult,
  NotificationService,
} from "./types";

export * from "./types";

// Default impl. WhatsApp uses Meta Cloud API when WHATSAPP_PHONE_NUMBER_ID
// + WHATSAPP_ACCESS_TOKEN are set; otherwise it logs and returns ok=false
// with a soft error so the calling flow can decide whether to fail. The
// pattern matches the existing scaffold at packages/whatsapp-engine/index.ts.
class DefaultNotificationService implements NotificationService {
  async send(
    channel: NotificationChannel,
    recipient: NotificationRecipient,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    switch (channel) {
      case "WHATSAPP":
        return this.sendWhatsapp(recipient, payload);
      case "EMAIL":
        return this.sendEmail(recipient, payload);
      case "SMS":
        return this.sendSms(recipient, payload);
      case "IN_APP":
        return this.sendInApp(recipient, payload);
    }
  }

  private async sendWhatsapp(
    recipient: NotificationRecipient,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    if (!recipient.phone) {
      return { ok: false, channel: "WHATSAPP", error: "missing_phone" };
    }
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneNumberId || !accessToken) {
      console.warn(
        `[notifications.WHATSAPP] credentials missing; would send template=${payload.template} to=${recipient.phone}`,
      );
      return { ok: false, channel: "WHATSAPP", error: "provider_not_configured" };
    }
    const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";
    try {
      const res = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: recipient.phone,
            type: "text",
            text: { body: payload.fallbackText ?? renderFallback(payload) },
          }),
        },
      );
      if (!res.ok) {
        const error = await res.text();
        return { ok: false, channel: "WHATSAPP", error: error.slice(0, 500) };
      }
      const data = (await res.json()) as {
        messages?: Array<{ id?: string }>;
      };
      return {
        ok: true,
        channel: "WHATSAPP",
        providerMessageId: data.messages?.[0]?.id,
      };
    } catch (err) {
      return {
        ok: false,
        channel: "WHATSAPP",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async sendEmail(
    recipient: NotificationRecipient,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    if (!recipient.email) {
      return { ok: false, channel: "EMAIL", error: "missing_email" };
    }
    // No email provider wired yet (Phase 8). Log + return soft failure so
    // the caller can still surface the raw token to the admin manually.
    console.warn(
      `[notifications.EMAIL] provider not configured; would send template=${payload.template} to=${recipient.email}`,
    );
    return { ok: false, channel: "EMAIL", error: "provider_not_configured" };
  }

  private async sendSms(
    recipient: NotificationRecipient,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    if (!recipient.phone) {
      return { ok: false, channel: "SMS", error: "missing_phone" };
    }
    console.warn(
      `[notifications.SMS] provider not configured; would send template=${payload.template} to=${recipient.phone}`,
    );
    return { ok: false, channel: "SMS", error: "provider_not_configured" };
  }

  private async sendInApp(
    recipient: NotificationRecipient,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    if (!recipient.supabaseUserId) {
      return { ok: false, channel: "IN_APP", error: "missing_user_id" };
    }
    console.warn(
      `[notifications.IN_APP] persistence not wired; template=${payload.template} for user=${recipient.supabaseUserId}`,
    );
    return { ok: false, channel: "IN_APP", error: "provider_not_configured" };
  }
}

function renderFallback(payload: NotificationPayload): string {
  return Object.entries(payload.variables).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    payload.template,
  );
}

let _service: NotificationService | null = null;
export function getNotificationService(): NotificationService {
  if (!_service) _service = new DefaultNotificationService();
  return _service;
}

// For tests.
export function __setNotificationService(svc: NotificationService) {
  _service = svc;
}
