import type { Prisma } from "@prisma/client";

// One place that answers "which Doctor row is this Supabase user?".
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Supabase mints a SEPARATE auth user per channel. Signing in with a phone
// produces a user carrying `phone` and no `email`; signing in with an email
// produces the reverse. The same human doctor therefore has two auth uids.
//
// `Doctor.supabaseUserId` can name only one of them, so before this helper the
// doctor could use exactly whichever channel happened to be linked first.
// Dr Divesh Shah at drfact-mumbai was linked to his EMAIL identity, so his
// mobile OTP verified correctly at Supabase and was then refused by
// resolveOrLinkDoctorByPhone as a `supabaseUserId_conflict` — verified, then
// signed straight back out.
//
// Doctor now carries two identity columns and every resolution site matches
// on EITHER, through this helper rather than by repeating the OR:
//
//   supabaseUserId       canonical identity (unchanged meaning; e-mail path,
//                        and the primary link for a phone-first doctor)
//   supabasePhoneUserId  the phone identity, when it differs from the above
//
// Both columns are `@unique`, so an auth identity can never name two Doctor
// rows and clinic isolation is preserved: resolution returns at most one row,
// and callers keep their own clinic checks on top.

/**
 * Match a Doctor by EITHER of its linked Supabase identities.
 *
 * Spread into an existing `where` rather than used alone, so each call site
 * keeps its own liveness predicates:
 *
 *   where: { ...doctorAuthIdentityWhere(sub), isActive: true, deletedAt: null }
 *
 * An empty/missing `sub` must never degrade into "match any doctor", so it
 * yields a clause that cannot match: both columns are NULL-able and a NULL
 * column never equals a value, but an OR over `undefined` would be dropped by
 * Prisma entirely. The explicit impossible clause is the safe form.
 */
export function doctorAuthIdentityWhere(
  supabaseUserId: string | null | undefined,
): Prisma.DoctorWhereInput {
  if (!supabaseUserId) {
    // `id` is a required column, so this matches nothing — as opposed to an
    // empty object, which would match everything.
    return { id: { equals: "__no_such_doctor__" } };
  }
  return {
    OR: [
      { supabaseUserId },
      { supabasePhoneUserId: supabaseUserId },
    ],
  };
}

/**
 * True when this auth identity is already linked to this exact Doctor row,
 * through either column. Used by the phone-login linker to recognise a
 * re-login before it considers writing anything.
 */
export function isLinkedIdentity(
  doctor: { supabaseUserId: string | null; supabasePhoneUserId: string | null },
  supabaseUserId: string,
): boolean {
  return (
    doctor.supabaseUserId === supabaseUserId ||
    doctor.supabasePhoneUserId === supabaseUserId
  );
}
