import { NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  getClinicContext,
  type ClinicContext,
} from "./clinicContext";
import {
  canAccessSuperAdminConsole,
  canManageClinic,
  canManageDoctors,
  isSuperAdmin,
  type SystemRole,
} from "./roles";

// Tenant guard helpers. The `assert*` helpers THROW on failure (route handlers
// should catch with handleAuthError). This is intentionally distinct from the
// legacy `requireRole` in ./legacy that returns a NextResponse — pick one per
// route; do not mix.
//
// Pair every server query against tenant-scoped tables with one of these —
// RLS is the safety net, but the app should never *rely* on RLS to return an
// empty set silently. Throw early, log loudly.

export async function getContext(): Promise<ClinicContext> {
  return getClinicContext();
}

export async function assertRole(...allowed: SystemRole[]): Promise<ClinicContext> {
  const ctx = await getClinicContext();
  if (!allowed.includes(ctx.role)) {
    throw new ForbiddenError(`Role ${ctx.role} not in [${allowed.join(", ")}]`);
  }
  return ctx;
}

export async function assertSuperAdmin(): Promise<ClinicContext> {
  const ctx = await getClinicContext();
  if (!canAccessSuperAdminConsole(ctx.role)) {
    throw new ForbiddenError("Super Admin only");
  }
  return ctx;
}

// Caller is asserting they're about to operate on data inside `targetClinicId`.
// SUPER_ADMIN passes regardless. Clinic-scoped roles must have matching
// clinic_id in their JWT. Use this before any clinic-scoped Prisma query.
export async function assertClinicAccess(
  targetClinicId: string,
): Promise<ClinicContext> {
  const ctx = await getClinicContext();
  if (isSuperAdmin(ctx.role)) return ctx;
  if (!ctx.clinicId || ctx.clinicId !== targetClinicId) {
    throw new ForbiddenError("Clinic access denied");
  }
  return ctx;
}

export async function assertClinicAdmin(
  targetClinicId: string,
): Promise<ClinicContext> {
  const ctx = await assertClinicAccess(targetClinicId);
  if (!canManageClinic(ctx.role)) {
    throw new ForbiddenError("Clinic Admin only");
  }
  return ctx;
}

export async function assertCanManageDoctors(
  targetClinicId: string,
): Promise<ClinicContext> {
  const ctx = await assertClinicAccess(targetClinicId);
  if (!canManageDoctors(ctx.role)) {
    throw new ForbiddenError("Cannot manage doctors");
  }
  return ctx;
}

// Returns a Prisma `where` fragment scoped to the caller's clinic. For
// SUPER_ADMIN returns {} (all rows). For clinic-scoped roles returns
// { clinicId: <their clinic> }. Throws if a clinic-scoped role has no
// clinic_id claim (misconfigured account).
export function clinicScope(ctx: ClinicContext): { clinicId?: string } {
  if (isSuperAdmin(ctx.role)) return {};
  if (!ctx.clinicId) {
    throw new ForbiddenError("No clinic context on session");
  }
  return { clinicId: ctx.clinicId };
}

// Convenience: convert thrown auth errors into proper HTTP responses.
// Use in route handlers: `return handleAuthError(err) ?? NextResponse...`
export function handleAuthError(err: unknown): NextResponse | null {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  return null;
}
