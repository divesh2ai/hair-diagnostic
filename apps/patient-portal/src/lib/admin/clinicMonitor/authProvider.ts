// Authentication-provider classification — pure, no Prisma, no I/O.
//
// The task is explicit and the production data confirms it: a doctor's login
// method MUST be read from auth.identities.provider, never inferred from which
// column holds the uid. In production, 0 doctors have `supabasePhoneUserId`
// set, yet phone logins exist — the phone uids live in `supabaseUserId`. So the
// caller resolves providers from auth.identities for each linked uid and hands
// the list here; this module turns it into an honest label.

export type AuthProvider =
  // An OAuth Google identity is linked.
  | "GOOGLE"
  // A phone-OTP identity is linked.
  | "PHONE_OTP"
  // A linked identity exists but is neither Google nor phone (e.g. email).
  | "OTHER"
  // No authentication identity is linked to this doctor at all.
  | "NOT_LINKED"
  // auth.identities could not be read here, so the method is genuinely unknown
  // — never a confident "not linked".
  | "UNKNOWN";

export interface AuthProviderInput {
  /** Whether auth.identities was readable. False ⇒ UNKNOWN. */
  readable: boolean;
  /** Whether the doctor has at least one linked Supabase uid. */
  hasLinkedUid: boolean;
  /** Distinct provider strings from auth.identities for the doctor's uid(s). */
  providers: string[];
}

/**
 * Classify one doctor's primary authentication method.
 *
 * Precedence: Google wins over phone when both are linked (the Google-migration
 * target). A linked uid with no provider rows, when auth was readable, is
 * reported OTHER (something is linked but not a method we name), not a
 * fabricated "not linked".
 */
export function classifyAuthProvider(input: AuthProviderInput): AuthProvider {
  if (!input.readable) return "UNKNOWN";
  if (!input.hasLinkedUid) return "NOT_LINKED";
  const set = new Set(input.providers.map((p) => p.toLowerCase()));
  if (set.has("google")) return "GOOGLE";
  if (set.has("phone")) return "PHONE_OTP";
  if (set.size > 0) return "OTHER";
  // A uid is linked but no identity row was found for it. Readable but
  // inconclusive — report OTHER rather than claim "not linked".
  return "OTHER";
}

/**
 * Roll a set of doctors' providers up to one clinic-level method, for the
 * register's "Authentication" column. Google if any doctor uses Google, else
 * phone if any uses phone, else any linked ⇒ OTHER, else not-linked; UNKNOWN
 * only when nothing is readable and nothing is linked.
 */
export function rollUpClinicAuthProvider(providers: AuthProvider[]): AuthProvider {
  if (providers.length === 0) return "NOT_LINKED";
  if (providers.includes("GOOGLE")) return "GOOGLE";
  if (providers.includes("PHONE_OTP")) return "PHONE_OTP";
  if (providers.includes("OTHER")) return "OTHER";
  if (providers.includes("NOT_LINKED")) return "NOT_LINKED";
  return "UNKNOWN";
}

export const AUTH_PROVIDER_LABEL: Record<AuthProvider, string> = {
  GOOGLE: "Google",
  PHONE_OTP: "Phone OTP",
  OTHER: "Other",
  NOT_LINKED: "Not linked",
  UNKNOWN: "Unknown",
};
