import { z } from "zod";

// Clinic.whatsappSettings shape.
export const whatsappSettingsSchema = z.object({
  businessName: z.string().optional(),
  defaultTemplateId: z.string().optional(),
  welcomeMessage: z.string().max(1500).optional(),
  reportDeliveryMessage: z.string().max(1500).optional(),
  reminderMessage: z.string().max(1500).optional(),
  connectionStatus: z.enum(["UNCONFIGURED", "CONNECTED", "FAILED"]).optional(),
  lastTestedAt: z.string().optional(),
  /**
   * Which WhatsApp sender delivers this clinic's automated messages.
   * "CENTRAL" (or unset) — the default Dr FACT number, shared across every
   * clinic that has not configured its own. A named key — a clinic-specific
   * sender, whose actual credentials are never stored here (see
   * lib/delivery/whatsappSender.ts): this field is a REFERENCE, resolved
   * against server-only environment variables, not a secret itself. Set only
   * by Super Admin (see /admin — a clinic admin may not set another clinic's
   * sender, and cannot reach this field for its own clinic either, since
   * doing so is a cross-clinic-identity decision, not a branding one).
   */
  senderMode: z.enum(["CENTRAL", "CLINIC_SPECIFIC"]).optional(),
  /** The sender key to resolve when senderMode is CLINIC_SPECIFIC. Ignored otherwise. */
  senderKey: z.string().max(64).optional(),
});
export type WhatsappSettings = z.infer<typeof whatsappSettingsSchema>;

export const DEFAULT_WHATSAPP_SETTINGS: WhatsappSettings = {
  connectionStatus: "UNCONFIGURED",
};

export function mergeWhatsappSettings(stored: unknown): WhatsappSettings {
  const parsed = whatsappSettingsSchema.safeParse(stored);
  return { ...DEFAULT_WHATSAPP_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}
