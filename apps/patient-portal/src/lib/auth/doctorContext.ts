import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthClaims, type AuthClaims, type AuthError } from "./legacy";
import type { SystemRole } from "./roles";

// Canonical Doctor authorization context for the current request.
//
//   AUTHENTICATED USER + LIVE DOCTOR IDENTITY + AUTHORIZED OPERATING CONTEXT
//                                 =
//                       DOCTOR ACTION ALLOWED
//
// The layout guard at /doctor/layout is convenience/navigation. This
// context is the actual security boundary — every /api/doctor/* handler
// and every /api/consultation/* mutation must resolve it before touching
// data.
//
// Two distinct identity concepts are kept explicit:
//
//   • Authenticated identity (`authUserId`, `authEmail`, `authRole`):
//     WHO the caller signed in as. Sourced from the verified Supabase JWT.
//     Used for audit "actorUserId / actorRole".
//
//   • Acting Doctor (`doctor`): the live application-side Doctor row this
//     request operates AS. Sourced from Postgres at request time (not the
//     JWT), so a Doctor deactivated or soft-deleted AFTER token issuance
//     fails on the next protected call — no wait for JWT expiry.
//
// `mode` distinguishes an ordinary Doctor session from an admin who has
// their own linked Doctor row and is deliberately operating in the
// Doctor workspace. Audit logs preserve BOTH identities; downstream code
// never rewrites a SUPER_ADMIN caller as if they were the Doctor.
export type DoctorContext = {
  authUserId: string;
  authEmail: string | null;
  authRole: SystemRole;
  doctor: {
    id: string;
    clinicId: string;
    name: string;
    // Null for a doctor provisioned ahead of their login. Such a row cannot
    // reach this context today — no email means no auth account means no
    // `supabaseUserId` to match on — but the type follows the column rather
    // than that reasoning, so the day an account is linked by mobile alone
    // this is a compile error somewhere honest instead of a runtime surprise.
    email: string | null;
    isActive: boolean;
  };
  mode: "doctor" | "admin_view";
};

// Verifies:
//   1. Authenticated Supabase user exists (JWT valid, `sub` present)
//   2. A Doctor row is linked to that Supabase user id
//   3. Doctor.isActive = true, Doctor.deletedAt IS NULL
//
// Returns the resolved context, or a NextResponse 401/403 to short-circuit
// the handler. Idiomatic usage:
//
//   const auth = await requireDoctorContext();
//   if (auth instanceof NextResponse) return auth;
//   const { doctor, authRole, mode } = auth;
export async function requireDoctorContext(): Promise<DoctorContext | AuthError> {
  const claims = await getAuthClaims();
  if (!claims?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const doctor = await prisma.doctor.findFirst({
    where: {
      supabaseUserId: claims.sub,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, clinicId: true, name: true, email: true, isActive: true },
  });
  if (!doctor) {
    // 403 with a stable reason code — clients can distinguish "not signed
    // in" (401) from "no Doctor identity" (403 no_doctor_membership).
    return NextResponse.json(
      { error: "forbidden", reason: "no_doctor_membership" },
      { status: 403 },
    );
  }
  const mode: DoctorContext["mode"] =
    claims.user_role === "DOCTOR" ? "doctor" : "admin_view";
  return {
    authUserId: claims.sub,
    authEmail: claims.email ?? null,
    authRole: (claims.user_role ?? "DOCTOR") as SystemRole,
    doctor,
    mode,
  };
}

// Assert the resolved Doctor context matches the target resource's clinic.
// Returns a 403 NextResponse to short-circuit, or null to proceed. Every
// resource mutation and every clinical read must call this whenever the
// target resource has a clinicId (Assessment, Consultation, Patient,
// KitOrderIntent, etc.).
//
// Cross-clinic access is not permitted on Doctor APIs even for admins
// with a linked Doctor row — cross-clinic reads live on /api/admin/*
// under a super-admin gate. Routing them through /api/doctor/* would let
// a super-admin's doctor identity in clinic A reach into clinic B, which
// is not what "acting as a doctor" means.
export function assertDoctorInClinic(
  doctor: DoctorContext["doctor"],
  targetClinicId: string,
): AuthError | null {
  if (doctor.clinicId !== targetClinicId) {
    return NextResponse.json(
      { error: "forbidden", reason: "cross_clinic" },
      { status: 403 },
    );
  }
  return null;
}

// Standardised audit-attribution shape. Fed into writeAuditLog / any
// mirror on the Assessment row / lifecycle events. Preserves both
// identities — a SUPER_ADMIN acting in admin_view is NOT relabelled as a
// Doctor.
//
// `actorType` intentionally reflects the AUTHENTICATED role, not "doctor"
// by convention, so the audit correctly records who actually approved a
// case. `actingDoctorId` records the Doctor row they operated AS.
export function auditActorFromDoctorContext(ctx: DoctorContext): {
  actorUserId: string;
  actorRole: SystemRole;
  actorType: "doctor" | "admin_view";
  actingDoctorId: string;
  mode: DoctorContext["mode"];
} {
  return {
    actorUserId: ctx.authUserId,
    actorRole: ctx.authRole,
    actorType: ctx.mode,
    actingDoctorId: ctx.doctor.id,
    mode: ctx.mode,
  };
}
