// Role definitions + permission predicates. Single source of truth for
// "what can this role do" — referenced by tenantGuard, proxy, and UI.
//
// Mirrors the SystemRole enum in prisma/schema.prisma. Keep in sync.

export const SYSTEM_ROLES = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "CLINIC_ADMIN",
  "DOCTOR",
  "STAFF",
  "PATIENT",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export function isSystemRole(v: unknown): v is SystemRole {
  return typeof v === "string" && (SYSTEM_ROLES as readonly string[]).includes(v);
}

// Roles allowed into staff-facing chrome (/doctor, /admin).
export const STAFF_ROLES: ReadonlySet<SystemRole> = new Set([
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "CLINIC_ADMIN",
  "DOCTOR",
  "STAFF",
]);

export const CLINIC_SCOPED_ROLES: ReadonlySet<SystemRole> = new Set([
  "CLINIC_ADMIN",
  "DOCTOR",
  "STAFF",
]);

export const PLATFORM_ROLES: ReadonlySet<SystemRole> = new Set([
  "SUPER_ADMIN",
  "ORG_ADMIN",
]);

export function isSuperAdmin(role: SystemRole | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export function isClinicAdmin(role: SystemRole | null | undefined): boolean {
  return role === "CLINIC_ADMIN";
}

export function isClinicScoped(role: SystemRole | null | undefined): boolean {
  return role != null && CLINIC_SCOPED_ROLES.has(role);
}

export function canManageClinic(role: SystemRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ORG_ADMIN" || role === "CLINIC_ADMIN";
}

export function canManageDoctors(role: SystemRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ORG_ADMIN" || role === "CLINIC_ADMIN";
}

export function canAccessSuperAdminConsole(role: SystemRole | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}
