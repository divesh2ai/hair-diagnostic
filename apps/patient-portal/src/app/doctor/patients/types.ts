// Wire shapes for the patient registry.
//
// Declared once and imported by the page, the calendar, the day panel and the
// booking dialog, so a field renamed in an API route fails the build here
// rather than rendering as `undefined` in a clinician's day view.
//
// These mirror the responses of:
//   GET  /api/doctor/patients
//   GET  /api/doctor/calendar?month=YYYY-MM
//   POST /api/doctor/appointments

import type { DayKey } from "@/lib/format/clinicDay";

export interface NextAppointment {
  id: string;
  /** ISO 8601, UTC. */
  scheduledAt: string;
  reason: string | null;
}

export interface PatientRow {
  id: string;
  name: string;
  phone: string | null;
  assessmentCount: number;
  /** ISO 8601, UTC. Absent when the patient has never submitted. */
  lastAssessment?: string;
  lastAssessmentId: string | null;
  /** Routes the row's action button to the right review surface. */
  lastConcern: string | null;
  /** AssessmentStatus — how far the pipeline got. */
  lastStatus: string | null;
  /** ReviewDecision — whether the doctor signed off. Drives the green mark. */
  lastReviewDecision: string | null;
  nextAppointment: NextAppointment | null;
}

export interface PatientsPayload {
  timeZone: string;
  appointmentsProvisioned: boolean;
  truncated: boolean;
  patients: PatientRow[];
}

export interface CalendarAssessment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  /** ISO 8601, UTC. */
  submittedAt: string;
  status: string;
  reviewDecision: string;
  primaryDiagnosis: string | null;
  severity: string | null;
  /** Routes the deep link to the right review surface. See lib/doctor/reviewHref. */
  concern: string | null;
}

export interface CalendarAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  doctorId: string;
  doctorName: string;
  /** ISO 8601, UTC. */
  scheduledAt: string;
  durationMinutes: number;
  reason: string | null;
  notes: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
}

export interface CalendarDay {
  assessments: CalendarAssessment[];
  appointments: CalendarAppointment[];
}

export interface CalendarPayload {
  month: string;
  /** The clinic's IANA zone. Every day boundary on this page is drawn in it. */
  timeZone: string;
  days: Record<DayKey, CalendarDay>;
  /**
   * False until prisma/migrations/20260821_appointments is applied. The UI
   * says so plainly rather than showing an empty schedule, because "nothing
   * booked" and "booking does not exist yet" are different answers.
   */
  appointmentsProvisioned: boolean;
  truncated: boolean;
}
