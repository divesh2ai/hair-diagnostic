import { isSystemRole } from "./roles";

// Pure authorization decision for the proxy (middleware). Kept free of Next and
// Supabase imports so the matcher's access rules can be unit-tested directly.
//
// The Super Admin console is SUPER_ADMIN-only. Every other staff role is turned
// away at the edge rather than being allowed in to be rejected later by the
// layout — a layout rejection used to redirect to "/", which then cascades
// through the root clinic redirect into /q/<DEFAULT_CLINIC_SLUG>. Blocking here
// keeps /admin/* off that path entirely.

// Staff roles permitted into the non-admin gated areas (/doctor, /clinic, ...).
const STAFF_AREA_ROLES: ReadonlySet<string> = new Set([
  "DOCTOR",
  "CLINIC_ADMIN",
  "ORG_ADMIN",
  "SUPER_ADMIN",
  "STAFF",
]);

// True for the Super Admin console and its API, including the bare /admin.
export function isAdminArea(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

export type GuardOutcome =
  // No/invalid session → /login carrying ?next=<from> so the user returns.
  | "login_next"
  // Authenticated but not permitted here → /login?reason=forbidden.
  | "login_forbidden"
  // Permitted → continue.
  | "allow";

// `role` is the verified `user_role` JWT claim. Pass null/undefined ONLY for an
// unauthenticated request (no session) — that yields a plain /login with ?next.
// An authenticated request whose role claim is absent or unknown must be passed
// as a non-null value (e.g. "") so it is treated as forbidden, not anonymous.
// `pathname` is the matched request path.
export function guardOutcome(
  pathname: string,
  role: string | null | undefined,
): GuardOutcome {
  if (role === null || role === undefined) return "login_next";
  if (!isSystemRole(role) || !STAFF_AREA_ROLES.has(role)) {
    return "login_forbidden";
  }
  // Admin console is SUPER_ADMIN-only; any other staff role is forbidden.
  if (isAdminArea(pathname) && role !== "SUPER_ADMIN") {
    return "login_forbidden";
  }
  return "allow";
}
