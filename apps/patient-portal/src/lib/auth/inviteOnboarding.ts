// Pure, I/O-free helpers for the recipient-facing invitation page
// (/invite/[token]). Kept apart from lib/invitations.ts (which does Prisma +
// delivery) so the display/decision logic can be unit-tested without a DB and
// imported by BOTH the server page and its CLIENT component — hence no import
// of the Prisma-backed invitations module here (that would drag server-only
// code into the client bundle). The lazy-expiry rule is inlined below; it
// mirrors isEffectivelyExpired in lib/invitations.ts.

/** What the recipient page should render for an invitation. */
export type InviteStatus =
  | "pending" // actionable: may sign in / accept
  | "expired"
  | "revoked"
  | "accepted"
  | "not_found";

/**
 * Collapse an invitation row to the single state the page acts on. Order
 * matters: a REVOKED or ACCEPTED row is terminal regardless of its expiry, and
 * only a live PENDING row is actionable. Uses the canonical lazy-expiry rule so
 * a PENDING row past expiresAt (no sweep runs on P0) reads as expired here too.
 */
export function classifyInviteStatus(
  inv: { status: string; expiresAt: Date } | null | undefined,
): InviteStatus {
  if (!inv) return "not_found";
  if (inv.status === "REVOKED") return "revoked";
  if (inv.status === "ACCEPTED") return "accepted";
  // Lazy expiry: a PENDING row past expiresAt is functionally expired even
  // though no background sweep has transitioned it (none runs on P0).
  if (inv.expiresAt.getTime() <= Date.now()) return "expired";
  return "pending";
}

/**
 * Mask an email for display — enough to recognise your own address, not enough
 * to harvest. `sumitahuja742@gmail.com` → `sum***@gmail.com`. The full address
 * is never sent to the client; the server compares it and sends only a boolean.
 */
export function maskEmail(email: string | null | undefined): string | null {
  const e = email?.trim();
  if (!e) return null;
  const at = e.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const head = local.slice(0, Math.min(3, local.length));
  return `${head}${local.length > head.length ? "***" : "*"}@${domain}`;
}

/**
 * Case-insensitive email equality for "is the signed-in user the invitee?".
 * This is a UI affordance only — the accept endpoint re-checks authoritatively
 * server-side (identity_mismatch → 403), so a client that lies gains nothing.
 */
export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Human label for the invited role (self-contained; no enum import). */
export function inviteRoleLabel(role: string): string {
  switch (role) {
    case "DOCTOR":
      return "Doctor";
    case "CLINIC_ADMIN":
      return "Clinic Admin";
    case "STAFF":
      return "Staff";
    case "ORG_ADMIN":
      return "Organization Admin";
    case "SUPER_ADMIN":
      return "Super Admin";
    default:
      return role;
  }
}

/**
 * The redirect target handed to Supabase OAuth from the invite page. Returning
 * to `/invite/<token>` (NOT via /post-login) is deliberate: the recipient has
 * no role claim yet — their Doctor UID is not linked — so routing through the
 * role gate would bounce them. The invite page needs only an authenticated
 * session to call accept, which performs the link. `/auth/callback` honours
 * `next` through `safeReturnPath`, which permits same-origin `/invite/...`.
 */
export function inviteCallbackNext(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}
