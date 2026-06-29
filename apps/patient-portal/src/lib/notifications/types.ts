// Common contract for all notification providers (addendum §6).
// Channel priority: WHATSAPP → SMS → EMAIL → IN_APP.

export type NotificationChannel = "WHATSAPP" | "SMS" | "EMAIL" | "IN_APP";

export type NotificationRecipient = {
  name?: string;
  phone?: string; // E.164, used by WHATSAPP / SMS
  email?: string;
  supabaseUserId?: string; // used by IN_APP
};

export type NotificationPayload = {
  // Stable template identifier; providers map this to their template names.
  template: string;
  // Template variables. Provider-specific.
  variables: Record<string, string>;
  // Optional short fallback text for channels that don't support templates.
  fallbackText?: string;
};

export type NotificationResult = {
  ok: boolean;
  channel: NotificationChannel;
  providerMessageId?: string;
  error?: string;
};

export interface NotificationService {
  send(
    channel: NotificationChannel,
    recipient: NotificationRecipient,
    payload: NotificationPayload,
  ): Promise<NotificationResult>;
}
