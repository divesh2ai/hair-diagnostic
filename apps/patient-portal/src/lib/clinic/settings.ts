// Canonical shape of Clinic.settings + Clinic.whatsappSettings JSON bags.
// Keep this file as the only definition; every reader/writer imports from here.

import { z } from "zod";

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Day = (typeof DAYS)[number];

export const businessHoursSchema = z.object({
  open: z.string().regex(TIME_HHMM),
  close: z.string().regex(TIME_HHMM),
  closed: z.boolean().default(false),
});
export type BusinessHours = z.infer<typeof businessHoursSchema>;

export const clinicSettingsSchema = z.object({
  businessHours: z
    .object({
      MON: businessHoursSchema.optional(),
      TUE: businessHoursSchema.optional(),
      WED: businessHoursSchema.optional(),
      THU: businessHoursSchema.optional(),
      FRI: businessHoursSchema.optional(),
      SAT: businessHoursSchema.optional(),
      SUN: businessHoursSchema.optional(),
    })
    .partial()
    .optional(),
  // minutes
  assessmentDurationMinutes: z.number().int().positive().max(240).optional(),
  autoArchiveDays: z.number().int().positive().max(3650).optional(),
  reportApprovalRequired: z.boolean().optional(),
  patientPortalEnabled: z.boolean().optional(),
  avatarVideoEnabled: z.boolean().optional(),
  notifyOnReportApproval: z.boolean().optional(),
  notifyOnNewAssessment: z.boolean().optional(),
});
export type ClinicSettings = z.infer<typeof clinicSettingsSchema>;

export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  assessmentDurationMinutes: 30,
  autoArchiveDays: 365,
  reportApprovalRequired: true,
  patientPortalEnabled: true,
  avatarVideoEnabled: false,
  notifyOnReportApproval: true,
  notifyOnNewAssessment: true,
};

export function mergeClinicSettings(
  stored: unknown,
): ClinicSettings {
  const parsed = clinicSettingsSchema.safeParse(stored);
  return { ...DEFAULT_CLINIC_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}
