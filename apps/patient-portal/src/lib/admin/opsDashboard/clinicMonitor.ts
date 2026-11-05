import type { ClinicOpsRow } from "./types";

export const CLINIC_FILTERS = [
  ["all", "All Clinics"],
  ["recent", "Recently Active"],
  ["followUp", "Needs Follow-up"],
  ["inactive", "Inactive"],
  ["notStarted", "Not Started"],
  ["loginPending", "Login Pending"],
] as const;

export type ClinicMonitorFilter = (typeof CLINIC_FILTERS)[number][0];
type Usage = "recent" | "followUp" | "inactive" | "notStarted" | "unknown";

export const USAGE_LABEL: Record<Usage, string> = {
  recent: "Recently Active",
  followUp: "Needs Follow-up",
  inactive: "Inactive",
  notStarted: "Not Started",
  unknown: "Unknown",
};

export function requiresFollowUp(row: ClinicOpsRow): boolean {
  return row.status !== "ARCHIVED" &&
    (row.followUp.priority !== null || row.flags.needsAttention);
}

export function clinicUsage(row: ClinicOpsRow): Usage {
  if (row.status === "ARCHIVED" || row.status === "SUSPENDED") return "inactive";
  switch (row.adoptionStatus) {
    case "DORMANT": return "inactive";
    case "NOT_STARTED":
    case "LOGIN_PENDING": return "notStarted";
    case "NEEDS_ENGAGEMENT": return "followUp";
    case "USING": return requiresFollowUp(row) ? "followUp" : "recent";
    default: return "unknown";
  }
}

export function monitorRows(rows: ClinicOpsRow[], filter: ClinicMonitorFilter, search: string) {
  const needle = search.trim().toLocaleLowerCase("en-IN");
  const recent = (r: ClinicOpsRow) =>
    Math.max(...[r.lastActivityAt, r.lastSignInAt, r.lastAssessmentAt, r.lastDoctorActivityAt]
      .map((iso) => (iso ? Date.parse(iso) || 0 : 0)));
  return rows.filter((row) => {
    if (needle && ![row.name, row.slug, row.topDoctor?.name].some(
      (value) => value?.toLocaleLowerCase("en-IN").includes(needle),
    )) return false;
    if (filter === "all") return true;
    if (filter === "followUp") return requiresFollowUp(row);
    if (filter === "loginPending") return row.status !== "ARCHIVED" &&
      (row.authProvider === "NOT_LINKED" || row.flags.neverLoggedIn);
    return clinicUsage(row) === filter;
  }).sort((a, b) =>
    Number(requiresFollowUp(b)) - Number(requiresFollowUp(a)) ||
    recent(b) - recent(a) || a.name.localeCompare(b.name, "en-IN"),
  );
}
