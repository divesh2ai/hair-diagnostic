// Pure identity-resolution for doctor login history — no Prisma, no I/O — so
// the rule that a doctor's sign-in is read across ALL of their supported
// Supabase identity mappings can be unit tested without a database.
//
// Supabase mints a SEPARATE auth user for the e-mail/Google channel and the
// phone-OTP channel, so one doctor can own two auth uids (`supabaseUserId` +
// `supabasePhoneUserId`). Reading only the canonical column would report a
// doctor who signs in by phone as "never signed in" — the exact failure the
// operations dashboard must avoid. The honest answer is the LATEST sign-in
// recorded against EITHER identity.

export interface DoctorIdentities {
  /** The canonical (e-mail/Google) Supabase user id, if linked. */
  emailUserId: string | null;
  /** The phone-OTP Supabase user id, if linked. */
  phoneUserId: string | null;
}

export interface ResolvedSignIn {
  /** Latest sign-in across either identity; null = none recorded (or no account). */
  lastSignInAt: Date | null;
  /** True when at least one Supabase identity is linked (an account exists). */
  hasAccount: boolean;
}

/**
 * Resolve one doctor's last sign-in across every linked identity.
 *
 * `lastSignInByAuthId` is the narrowed auth.users read keyed by uid. A uid that
 * is linked but ABSENT from the map (or mapped to null) means "account exists,
 * never used", which is deliberately distinct from "no account at all"
 * (`hasAccount === false`). The caller decides how to render each.
 */
export function resolveDoctorSignIn(
  identities: DoctorIdentities,
  lastSignInByAuthId: Map<string, Date | null>,
): ResolvedSignIn {
  const ids = [identities.emailUserId, identities.phoneUserId].filter(
    (v): v is string => Boolean(v),
  );
  let last: Date | null = null;
  for (const id of ids) {
    const t = lastSignInByAuthId.get(id) ?? null;
    if (t && (!last || t.getTime() > last.getTime())) last = t;
  }
  return { lastSignInAt: last, hasAccount: ids.length > 0 };
}
