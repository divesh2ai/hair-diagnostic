import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOrLinkDoctorByPhone } from "@/lib/auth/phoneDoctorLink";
import { resolvePhoneLogin } from "@/lib/auth/phoneLoginAuthorization";
import { isSystemRole } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

// POST /api/auth/phone-login/link
//
// Called by the client immediately after supabase.auth.verifyOtp({ phone })
// succeeds, while the fresh session cookie from that verification is already
// attached to this request.
//
// Branches on the caller's VERIFIED role (read from the JWKS-verified Supabase
// claims — never the request body, never anything the browser asserts):
//
//   • SUPER_ADMIN — a platform operator holds no Doctor row, so clinical
//     linking is skipped and the login is allowed (and audited). Without this,
//     a super admin verified their OTP and was signed straight back out.
//   • everyone else, including a missing/invalid role claim — resolved through
//     resolveOrLinkDoctorByPhone, which links a provisioned active doctor and
//     fails closed for anyone unregistered, inactive, or conflicting.
//
// The decision + HTTP mapping live in resolvePhoneLogin (pure, unit-tested);
// this handler only wires the real session in and emits the NextResponse.
export async function POST() {
  const supabase = await createSupabaseServerClient();

  const { status, body } = await resolvePhoneLogin({
    // The caller's OWN identity from the session — never a body field, which
    // would let an authenticated-but-unregistered caller claim another number.
    getUser: async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) return null;
      return { id: user.id, phone: user.phone ?? null };
    },
    getVerifiedClaims: async () => {
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims as
        | { user_role?: string; sub?: string }
        | undefined;
      return {
        role: isSystemRole(claims?.user_role) ? claims.user_role : null,
        sub: claims?.sub ?? null,
      };
    },
    resolveDoctor: resolveOrLinkDoctorByPhone,
    auditSuperAdminLogin: (supabaseUserId) =>
      writeAuditLog({
        action: "SUPER_ADMIN_PHONE_LOGIN",
        entityType: "AuthUser",
        entityId: supabaseUserId,
        actorId: supabaseUserId,
        actorRole: "SUPER_ADMIN",
        actorType: "admin",
      }),
  });

  return NextResponse.json(body, { status });
}
