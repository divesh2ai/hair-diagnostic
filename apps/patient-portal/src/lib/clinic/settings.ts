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

  /**
   * Where this clinic's approved kits go by default: to the patient directly,
   * or supplied to the clinic counter.
   *
   * ── Why the default lives at the CLINIC and not on each order ─────────────
   * Fulfilment destination is a commercial arrangement between the platform
   * and a clinic, not a per-patient clinical judgement. A doctor approving
   * twenty plans a day should not answer the same logistics question twenty
   * times, and a question asked that often is answered by reflex — which is
   * how a silent default gets re-created with extra clicks.
   *
   * So the clinic sets it once, every new order is STAMPED with the resolved
   * value at creation (never left null), and the doctor can still override a
   * single order before it enters fulfilment.
   */
  defaultFulfilmentMode: z.enum(["PATIENT", "CLINIC"]).optional(),
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
  /**
   * CLINIC for Wave 0 — but note what changed. This is now a NAMED default
   * that gets written onto every new order row, not a null column silently
   * reinterpreted at read time. The difference is auditable: an order says
   * where its kits were meant to go, and a clinic that changes this setting
   * does not retroactively rewrite the destination of orders already placed.
   */
  defaultFulfilmentMode: "CLINIC",
};

export function mergeClinicSettings(
  stored: unknown,
): ClinicSettings {
  const parsed = clinicSettingsSchema.safeParse(stored);
  return { ...DEFAULT_CLINIC_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}
