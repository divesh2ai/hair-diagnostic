import type { SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

// First-login identity linking for pre-authorised platform administrators.
//
// ── Why this exists ──────────────────────────────────────────────────────────
// A platform administrator (SUPER_ADMIN / ORG_ADMIN) is provisioned ahead of
// time as an OrganizationMember row keyed on their e-mail, with no Supabase
// identity yet (`supabaseUserId IS NULL`). They sign in for the first time
// through Google OAuth, at which point Supabase mints their auth user. This
// function claims the waiting row for that auth user — writing the uid into
// `supabaseUserId` — so the hardened `custom_access_token_hook` will mint
// `user_role=SUPER_ADMIN` on the NEXT token.
//
// ── The security invariants, and where each one is enforced ──────────────────
// The hook grants the admin role ONLY when `supabaseUserId = uid` AND the auth
// e-mail is confirmed; it no longer falls back to an unverified e-mail match.
// So the row must be claimed BY uid, and only for an account whose e-mail is
// genuinely verified by a trusted provider. This function is the one place that
// writes that uid, so it carries the gates the hook can no longer imply:
//
//   1. Re-validated identity — `getUser()` round-trips to the auth server, so
//      the user is not read from an unverified local JWT.
//   2. Verified e-mail — `email_confirmed_at` (or the provider's
//      `email_verified` claim). An unconfirmed e-mail never claims a row.
//   3. Trusted provider — the identity came through Google, not a channel where
//      the e-mail string is attacker-controlled.
//   4. Atomic, non-hijacking claim — the `supabaseUserId: null` predicate means
//      only an UNLINKED row is ever written, and the single `updateMany` is the
//      atomic compare-and-set: two concurrent first-logins cannot both win, and
//      an already-linked admin can never be re-pointed at a different uid.
//
// It NEVER creates a row and NEVER changes a role: an attacker whose e-mail is
// not already a pending admin matches nothing. Authorisation remains entirely
// server-side (the Postgres hook); this only attaches an identity to a row an
// operator already authorised.
export async function linkPendingAdminIdentity(
  supabase: SupabaseClient,
): Promise<boolean> {
  // 1. Re-validate the session against the auth server (not the local JWT).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return false;

  // 2. Verified-e-mail gate.
  const emailConfirmed =
    Boolean(user.email_confirmed_at) ||
    user.user_metadata?.email_verified === true;
  if (!emailConfirmed) return false;

  // 3. Trusted-provider gate — the e-mail is only trustworthy because Google
  //    asserted it.
  const provider = user.app_metadata?.provider;
  const providers = user.app_metadata?.providers;
  const viaGoogle =
    provider === "google" ||
    (Array.isArray(providers) && providers.includes("google"));
  if (!viaGoogle) return false;

  // 4. Atomic claim. `supabaseUserId: null` is the compare half of a
  //    compare-and-set: it matches ONLY an unlinked, live, pre-authorised row,
  //    so this can neither hijack an already-linked admin nor create or elevate
  //    anything. `count > 0` means this login won the claim.
  const { count } = await prisma.organizationMember.updateMany({
    where: {
      email: { equals: user.email.toLowerCase(), mode: "insensitive" },
      supabaseUserId: null,
      isActive: true,
      deletedAt: null,
    },
    data: { supabaseUserId: user.id },
  });

  return count > 0;
}
