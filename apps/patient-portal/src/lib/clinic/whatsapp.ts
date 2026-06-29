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
});
export type WhatsappSettings = z.infer<typeof whatsappSettingsSchema>;

export const DEFAULT_WHATSAPP_SETTINGS: WhatsappSettings = {
  connectionStatus: "UNCONFIGURED",
};

export function mergeWhatsappSettings(stored: unknown): WhatsappSettings {
  const parsed = whatsappSettingsSchema.safeParse(stored);
  return { ...DEFAULT_WHATSAPP_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}
