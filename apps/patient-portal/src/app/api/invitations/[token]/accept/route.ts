import { NextResponse } from "next/server";
import { acceptInvitation, InvitationError } from "@/lib/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POST /api/invitations/[token]/accept
// Body (optional): { name?: string }
//
// Requires a signed-in Supabase session. The session's email must match
// the invitation's email. On success the corresponding Doctor /
// ClinicMember / OrganizationMember row is created (or refreshed) and
// the invitation is marked accepted. The caller should sign out + back
// in (or refresh the JWT) to pick up the new role claims.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;


  // Pull email + phone + display name from the live Supabase user. India-
  // first signups commonly use phone (no email), so we require at least
  // one of email/phone — matching the invitation contact contract.
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userErr || !user || (!user.email && !user.phone)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const verifiedGoogleEmail = user.identities?.find(({ provider, identity_data }) =>
    provider === "google" &&
    identity_data?.email_verified === true &&
    typeof identity_data.email === "string" &&
    identity_data.email.trim().toLowerCase() === user.email?.trim().toLowerCase(),
  )?.identity_data?.email;

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }

  const displayName =
    body.name?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    user.phone ||
    "Member";

  try {
    const result = await acceptInvitation({
      rawToken: token,
      supabaseUserId: user.id,
      email: user.email ?? null,
      verifiedGoogleEmail: typeof verifiedGoogleEmail === "string" ? verifiedGoogleEmail : null,
      phone: user.phone ?? null,
      name: displayName,
    });
    await supabase.auth.refreshSession();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof InvitationError) {
      const status =
        err.code === "not_found" ? 404 :
        err.code === "expired" || err.code === "revoked" ? 410 :
        err.code === "already_accepted" ? 409 :
        err.code === "identity_conflict" ? 409 :
        err.code === "inactive_scope" ? 403 :
        err.code === "identity_mismatch" ? 403 :
        400;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    console.error("[invitations.accept]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
