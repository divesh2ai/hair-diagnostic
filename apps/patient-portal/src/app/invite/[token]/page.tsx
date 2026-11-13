import { findInvitationByToken } from "@/lib/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  classifyInviteStatus,
  emailsMatch,
  inviteRoleLabel,
  maskEmail,
  type InviteStatus,
} from "@/lib/auth/inviteOnboarding";
import { InviteClient } from "./InviteClient";

export const dynamic = "force-dynamic";

// Recipient-facing invitation page — the missing half of the onboarding
// journey. The backend (createInvitation → buildInviteLink → /invite/<token>,
// and POST /api/invitations/[token]/accept) already existed, but no page lived
// at /invite/[token], so the link 404'd in production and no doctor could ever
// accept. This page renders the invitation, drives Google sign-in that RETURNS
// here (not through the role gate — the recipient has no role yet), and calls
// accept, which links the verified Supabase UID to the EXISTING Doctor row.
//
// It reads the invitation server-side (never exposing the raw token beyond the
// URL that already carries it) and sends the client only what it needs: the
// masked emails and a server-computed match boolean. The authoritative
// email/identity check still happens inside acceptInvitation.
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Invitation lookup is defensive: a transient DB fault must not render as
  // "invalid invitation" (which would wrongly tell a real invitee to give up).
  let status: InviteStatus;
  let lookupFailed = false;
  let scopeName: string | null = null;
  let roleLabel: string | null = null;
  let intendedEmail: string | null = null;
  let intendedIsEmail = false;

  try {
    const inv = await findInvitationByToken(token);
    status = classifyInviteStatus(inv);
    if (inv) {
      scopeName = inv.clinic?.name ?? inv.organization?.name ?? null;
      roleLabel = inviteRoleLabel(inv.role);
      intendedEmail = inv.email ?? null;
      intendedIsEmail = Boolean(inv.email);
    }
  } catch (err) {
    console.error("[invite.page] lookup failed", err);
    lookupFailed = true;
    status = "not_found";
  }

  // Current session (if any). Only the email is needed, to tell the invitee
  // whether they are signed in as the right Google account.
  let signedInEmail: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    signedInEmail = data.user?.email ?? null;
  } catch {
    /* no session / unreadable — treated as signed out */
  }

  return (
    <InviteClient
      token={token}
      status={status}
      lookupFailed={lookupFailed}
      scopeName={scopeName}
      roleLabel={roleLabel}
      intendedEmailMasked={maskEmail(intendedEmail)}
      intendedIsEmail={intendedIsEmail}
      signedIn={Boolean(signedInEmail)}
      signedInEmailMasked={maskEmail(signedInEmail)}
      emailMatches={emailsMatch(signedInEmail, intendedEmail)}
    />
  );
}
