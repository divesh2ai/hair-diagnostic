import type { AuthProvider } from "./authProvider";

export type ClinicDetail = {
  name: string; status: string;
  branches: { name: string; city: string | null; primary: boolean; status: string; assessments: number }[];
  unattributed: number;
  doctors: { name: string; isPrimary: boolean; onboarding: string; linked: boolean; lastAction: string | null;
    reviews: number; authProvider: AuthProvider; lastSignIn: string | null }[];
  metrics: { assessed: number; patients: number; consultations: number; lastAssessment: string | null; lastReview: string | null;
    last7: number; last30: number; completed: number; missing: number; reviewed: number; pending: number; approved: number; ready: number; delivered: number };
  reports: { queued: number; failed: number };
  kits: { intents: number; cancelled: number };
  delivery: { sent: number; confirmed: number; failed: number; latest: string | null };
  recent: { at: string; processing: string; review: string; report: string; branch: string | null }[];
  activity: { label: string; at: string; branch: string | null }[];
};
