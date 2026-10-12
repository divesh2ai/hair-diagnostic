// Test-only fixtures for the doctor-dashboard visual harness.
// No Supabase, no auth, no network — deterministic props only. Never shipped:
// the route that consumes these 404s unless VISUAL_HARNESS=1 (see page.tsx).

import type { ClinicBranding } from "@/lib/branding";
import type { DeckQueueRow } from "@/lib/doctor/patientDeck";

export const FIXTURE_BRANDING: ClinicBranding = {
  clinicId: "clinic_mumbai_test",
  clinicName: "DrFACT Mumbai Test Clinic",
  clinicSlug: "drfact-mumbai-test",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  secondaryColor: null,
  tagline: null,
  doctorAvatarUrl: null, // initials "DD" render at the new xl size
  doctorName: "Dr Divesh Shah",
  doctorSpecialization: "Dermatology",
  doctorSignatureUrl: null,
  pdfBranding: null,
  reportBranding: null,
};

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

// Five NEEDS-REVIEW rows exercising: short + long names, a long diagnosis,
// multiple clinical tags, varied timestamps, and kit counts of 1, 2, 3, 4 and
// none. (The deck card is review-only by design — status is always "ready" /
// "Needs review"; APPROVED is a KPI-band concept, not a deck-card state.)
export const FIXTURE_ROWS: DeckQueueRow[] = [
  {
    id: "r1",
    submittedAt: minsAgo(60 * 24 * 5), // 5 days
    status: "CLINICAL_READY",
    patientName: "Jaya",
    patientAge: 34,
    patientGender: "F",
    clinicName: "DrFACT Mumbai — Andheri East",
    primaryDiagnosis: "PCOS associated hormonal hair loss",
    severity: "MILD",
    reviewPathway: null,
    reviewPathwayReasons: [],
    concern: null,
    recommendedKitCount: 3,
  },
  {
    id: "r2",
    submittedAt: minsAgo(120), // 2 hours
    status: "CLINICAL_READY",
    patientName: "Lakshmi Priyadarshini Venkataraman",
    patientAge: 41,
    patientGender: "F",
    clinicName: "DrFACT Mumbai — Andheri East",
    primaryDiagnosis:
      "Androgenetic pattern hair loss with seborrheic dermatitis and chronic diffuse telogen effluvium",
    severity: "MODERATE",
    reviewPathway: null,
    reviewPathwayReasons: [],
    concern: null,
    recommendedKitCount: 4,
  },
  {
    id: "r3",
    submittedAt: minsAgo(30),
    status: "CLINICAL_READY",
    patientName: "Arjun",
    patientAge: 28,
    patientGender: "M",
    clinicName: "DrFACT Mumbai — Bandra",
    primaryDiagnosis: "TELOGEN_EFFLUVIUM",
    severity: "SEVERE",
    reviewPathway: null,
    reviewPathwayReasons: [],
    concern: null,
    recommendedKitCount: 1,
  },
  {
    id: "r4",
    submittedAt: minsAgo(60 * 24), // 1 day
    status: "CLINICAL_READY",
    patientName: "Meenakshi Rajagopalan",
    patientAge: 52,
    patientGender: "F",
    clinicName: "DrFACT Mumbai — Bandra",
    primaryDiagnosis:
      "Iron deficiency anaemia related chronic telogen effluvium with diffuse thinning",
    severity: "MODERATE",
    reviewPathway: null,
    reviewPathwayReasons: [],
    concern: null,
    recommendedKitCount: 2,
  },
  {
    id: "r5",
    submittedAt: minsAgo(60 * 24 * 3), // 3 days
    status: "CLINICAL_READY",
    patientName: "Sam",
    patientAge: 45,
    patientGender: "M",
    clinicName: "DrFACT Mumbai — Andheri East",
    primaryDiagnosis: "AGA_MALE",
    severity: null,
    reviewPathway: null,
    reviewPathwayReasons: [],
    concern: null,
    recommendedKitCount: null, // no kit-count line
  },
];
