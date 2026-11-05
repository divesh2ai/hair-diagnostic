// CEO daily summary + CSV export + follow-up template — pure, client-safe.
//
// Strictly operational: NO patient names, phone numbers or clinical detail ever
// appear here. The summary and CSV are built from the already-computed overview
// payload (clinic-level figures), and the WhatsApp template is a generic nudge
// with no contact data — staff send it manually.

import type { OpsOverview, ClinicOpsRow } from "./types";
import { ADOPTION_STATUS_LABEL } from "./adoption";
import { AUTH_PROVIDER_LABEL } from "./authProvider";

function pct(n: number, d: number): string {
  if (d <= 0) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

/** A copyable plain-text executive summary. Operational figures only. */
export function buildCeoSummary(data: OpsOverview): string {
  const k = data.kpis;
  const dormant = data.clinics.filter(
    (c) => c.adoptionStatus === "DORMANT" || c.adoptionStatus === "NEEDS_ENGAGEMENT",
  );
  const awaitingOnboarding = data.clinics.filter(
    (c) => c.adoptionStatus === "NOT_STARTED" || c.adoptionStatus === "LOGIN_PENDING",
  );
  // Top blockers = follow-up actions by frequency (priority ≤ 3 first).
  const blockerCounts = new Map<string, number>();
  for (const c of data.clinics) {
    if (c.followUp.priority === null) continue;
    blockerCounts.set(c.followUp.action, (blockerCounts.get(c.followUp.action) ?? 0) + 1);
  }
  const topBlockers = [...blockerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([action, n]) => `  - ${action} (${n})`);

  const priorityList = data.clinics
    .filter((c) => c.followUp.priority !== null)
    .sort((a, b) => (a.followUp.priority ?? 99) - (b.followUp.priority ?? 99))
    .slice(0, 5)
    .map((c) => `  P${c.followUp.priority} ${c.name} — ${c.followUp.action}`);

  const refreshed = new Date(data.generatedAt).toISOString().replace("T", " ").slice(0, 16);

  return [
    `HairOS clinic adoption — ${data.window.label} (as of ${refreshed} UTC)`,
    "",
    `Clinics: ${k.clinicsRegistered} registered · ${k.clinicsActive} enabled · ${k.clinicsOperational} using HairOS`,
    `Active last 7 days: ${k.clinicsActive7d} (${pct(k.clinicsActive7d, k.clinicsRegistered)}) · inactive 7d: ${k.clinicsInactive7d} · dormant 14d+: ${k.clinicsInactive14d}`,
    `Login methods: ${k.doctorsGoogle} Google · ${k.doctorsPhone} phone · ${k.doctorsNotLinked} not linked (of ${k.doctorsTotal} doctors; ${k.doctorsSignedIn} signed in)`,
    `Assessments: ${k.assessments.today} in window · ${k.assessments.allTime} all-time · ${k.completedAssessments} completed`,
    `Doctor reviews: ${k.reviewedCases.today} in window · ${k.reviewedCases.allTime} all-time · ${k.pendingReviews} pending`,
    `Becoming dormant / needs engagement: ${dormant.length}`,
    `Awaiting onboarding (no assessments yet): ${awaitingOnboarding.length}`,
    "",
    `Top operational blockers:`,
    ...(topBlockers.length ? topBlockers : ["  - none"]),
    "",
    `Priority follow-ups today:`,
    ...(priorityList.length ? priorityList : ["  - none"]),
  ].join("\n");
}

const CSV_HEADERS = [
  "Clinic",
  "Slug",
  "Status",
  "Branches",
  "Auth method",
  "Doctors",
  "Patients",
  "Assessments (all-time)",
  "Assessments (7d)",
  "Last assessment (ISO)",
  "Days since last assessment",
  "Doctor reviews",
  "Adoption",
  "Follow-up priority",
  "Follow-up action",
];

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  // Quote if it contains a comma, quote or newline; escape embedded quotes.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Clinic-level adoption CSV. No patient-identifying data. */
export function buildAdoptionCsv(data: OpsOverview): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const c of data.clinics) {
    lines.push(
      [
        csvCell(c.name),
        csvCell(c.slug),
        csvCell(c.status),
        csvCell(c.branchCount),
        csvCell(AUTH_PROVIDER_LABEL[c.authProvider]),
        csvCell(c.doctorCount),
        csvCell(c.patientCount),
        csvCell(c.assessments.allTime),
        csvCell(c.assessments7d),
        csvCell(c.lastAssessmentAt),
        csvCell(c.daysSinceLastAssessment),
        csvCell(c.reviewedCases.allTime),
        csvCell(ADOPTION_STATUS_LABEL[c.adoptionStatus]),
        csvCell(c.followUp.priority),
        csvCell(c.followUp.priority === null ? "" : c.followUp.action),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/**
 * A generic, copyable WhatsApp follow-up nudge for staff to send manually. It
 * carries NO phone number and NO patient data — only a neutral message. The
 * clinic name is included for the sender's reference line.
 */
export function whatsappFollowUpTemplate(clinic: ClinicOpsRow): string {
  return [
    `Hello Doctor,`,
    ``,
    `Your HairOS dashboard for ${clinic.name} is ready. We noticed no recent patient assessments.`,
    `Please let us know if you need any help with login, the assessment QR, or reports — we're happy to assist.`,
    ``,
    `Thank you,`,
    `HairOS operations team`,
  ].join("\n");
}
