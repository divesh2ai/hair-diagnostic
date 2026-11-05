import type { AuthProvider } from "./authProvider";

export type ClinicOpsRow = {
  clinicId: string;
  name: string;
  slug: string;
  status: string;
  isActive: boolean;
  topDoctor: { name: string } | null;
  doctors: { name: string; authProvider: AuthProvider; lastSignInAt: string | null }[];
  authProvider: AuthProvider;
  assessedPatientCount: number;
  assessmentCount: number;
  assessments7d: number;
  lastAssessmentAt: string | null;
  lastReviewAt: string | null;
  usage: "recent" | "followUp" | "inactive" | "notStarted";
};

export type OpsOverview = {
  clinics: ClinicOpsRow[];
  kpis: { doctorsLoggedIn: number; loginPending: number };
};

export const CLINIC_FILTERS = [
  ["all", "All Clinics"], ["recent", "Recent Use"], ["followUp", "Needs Follow-up"],
  ["inactive", "Inactive"], ["notStarted", "Not Started"], ["loginPending", "Login Pending"],
] as const;
export type ClinicMonitorFilter = (typeof CLINIC_FILTERS)[number][0];

export const USAGE_LABEL = {
  recent: "Recent use", followUp: "Follow up", inactive: "Inactive", notStarted: "Not started",
};

export function clinicUsage(row: ClinicOpsRow) {
  return row.usage;
}

export function monitorRows(rows: ClinicOpsRow[], filter: ClinicMonitorFilter, search: string) {
  const needle = search.trim().toLocaleLowerCase("en-IN");
  return rows.filter((row) => {
    if (needle && ![row.name, row.slug, ...row.doctors.map((doctor) => doctor.name)].some(
      (value) => value.toLocaleLowerCase("en-IN").includes(needle),
    )) return false;
    if (filter === "all") return true;
    if (filter === "loginPending") return row.doctors.some((doctor) => !doctor.lastSignInAt);
    return row.usage === filter;
  }).sort((a, b) =>
    Number(b.usage === "followUp") - Number(a.usage === "followUp") ||
    (b.lastAssessmentAt ?? "").localeCompare(a.lastAssessmentAt ?? "") ||
    a.name.localeCompare(b.name, "en-IN"),
  );
}
