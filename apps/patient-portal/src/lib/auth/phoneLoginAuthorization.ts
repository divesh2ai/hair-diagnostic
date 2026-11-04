import type { SystemRole } from "./roles";
import type { PhoneDoctorLinkResult } from "./phoneDoctorLink";

// Phone-OTP login authorization — the one decision that fixes the SUPER_ADMIN
// login blocker, kept as a pure/injectable seam so every role path is testable
// without a Supabase session or a Next.js request.
//
// ── The blocker this exists to fix ──────────────────────────────────────────
// The login page used to call /api/auth/phone-login/link UNCONDITIONALLY after
// a successful OTP verification. That route resolves a Doctor row — and a
// platform SUPER_ADMIN has none — so a legitimate super admin verified their
// OTP and was then signed straight back out as "unregistered". The role
// precedence in the JWT (custom_access_token_hook) already gives them
// SUPER_ADMIN; what was missing was letting that role SKIP clinical linking.
//
// ── The trust boundary is the server ────────────────────────────────────────
// "Securely verify the JWT role" means read the role from the JWKS-verified
// Supabase claims on the SERVER (getRole below is wired to
// supabase.auth.getClaims()), never from anything the browser asserts. The
// client simply calls the route; this function decides.

export type PhoneLoginDecision =
  | { action: "skip_doctor_link"; role: "SUPER_ADMIN" }
  | { action: "require_doctor_link" };

/**
 * Exactly one role skips Doctor resolution: SUPER_ADMIN. Every other role —
 * DOCTOR, CLINIC_ADMIN, ORG_ADMIN, STAFF, PATIENT — and a missing or
 * unrecognised role claim (null) still goes through resolveOrLinkDoctorByPhone,
 * which fails closed for anyone who isn't a provisioned, active doctor. A
 * roleless account therefore can NEVER bypass authorization here.
 */
export function decidePhoneLogin(
  role: SystemRole | null | undefined,
): PhoneLoginDecision {
  if (role === "SUPER_ADMIN") return { action: "skip_doctor_link", role };
  return { action: "require_doctor_link" };
}

export type PhoneLoginHttp = { status: number; body: Record<string, unknown> };

export type VerifiedClaims = {
  /** The role from the JWKS-verified JWT, or null when absent/unrecognised. */
  role: SystemRole | null;
  /** The JWT subject (`sub`) — the user the verified token was minted for. */
  sub: string | null;
};

export type PhoneLoginDeps = {
  /** The caller's OWN verified identity from the Supabase session, or null. */
  getUser: () => Promise<{ id: string; phone: string | null } | null>;
  /**
   * The role AND subject from the JWKS-verified JWT claims — the only trusted
   * source. `sub` is returned alongside `role` so the caller can confirm the
   * token belongs to the same authenticated user before honouring a
   * privileged role.
   */
  getVerifiedClaims: () => Promise<VerifiedClaims>;
  /** Clinical resolution for the non-admin path (behaviour unchanged). */
  resolveDoctor: (input: {
    supabaseUserId: string;
    verifiedPhone: string;
  }) => Promise<PhoneDoctorLinkResult>;
  /** Best-effort audit of a privileged, Doctor-less admin phone login. */
  auditSuperAdminLogin: (supabaseUserId: string) => Promise<void>;
};

/**
 * Resolve a phone-OTP login into an HTTP status + body, with no dependency on
 * Next.js or Supabase so it can be driven directly from tests. The route
 * handler is a thin adapter that wires the real Supabase session in and turns
 * the returned shape into a NextResponse.
 *
 * The non-admin branch preserves the exact status codes the route returned
 * before this change:
 *   401 unauthorized — no session / no verified phone
 *   403 unregistered | inactive — number matches no live Doctor
 *   409 conflict — number held by a different auth identity
 *   200 ok — linked (or already linked)
 */
export async function resolvePhoneLogin(
  deps: PhoneLoginDeps,
): Promise<PhoneLoginHttp> {
  const user = await deps.getUser();
  if (!user || !user.phone) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  const { role, sub } = await deps.getVerifiedClaims();
  const decision = decidePhoneLogin(role);

  // The privileged branch is honoured ONLY when the verified JWT's subject is
  // the very user we just authenticated. getUser() and the claims come from the
  // same session here, so this is belt-and-suspenders — but a SUPER_ADMIN claim
  // whose `sub` does not match the resolved user never grants the skip; it
  // falls through to Doctor resolution, which fails closed.
  const subjectMatchesUser = sub != null && sub === user.id;

  if (decision.action === "skip_doctor_link" && subjectMatchesUser) {
    // Never let an audit hiccup block a legitimate admin sign-in — /admin
    // re-checks the role server-side, so the audit row is a record, not a gate.
    try {
      await deps.auditSuperAdminLogin(user.id);
    } catch {
      /* non-fatal: audit is best-effort on the login path */
    }
    return {
      status: 200,
      body: { ok: true, role: "SUPER_ADMIN", linked: false },
    };
  }

  const result = await deps.resolveDoctor({
    supabaseUserId: user.id,
    verifiedPhone: user.phone,
  });

  if (!result.ok) {
    const status = result.reason === "conflict" ? 409 : 403;
    return { status, body: { ok: false, reason: result.reason } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      doctorId: result.doctorId,
      clinicId: result.clinicId,
      alreadyLinked: result.alreadyLinked,
    },
  };
}
