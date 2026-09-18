// What a Doctor row means, operationally: can this person sign in, is the
// account live, and is there anything to send an invitation to.
//
// ── Why this is derivation and not four more columns ────────────────────────
// Three of the four answers are already implied by columns that exist, and a
// stored copy of an implied fact is a copy that drifts. `dashboardAccess` is
// exactly "an auth account is linked AND the row is live"; `accountStatus` is
// exactly `isActive` + `deletedAt`; `contactStatus` is exactly which of
// email/phone are present. Only `provisioningStatus` carries something the
// other columns cannot express — whether a HUMAN confirmed that the contact on
// file belongs to the doctor personally — so only that one is persisted.
//
// ── The rule this file exists to enforce ────────────────────────────────────
// Nothing here reports READY on the strength of an assertion. `dashboardReady`
// is true only when an auth identity is actually linked to a live row, which
// is the same condition `requireDoctorContext` enforces on every request. A
// screen that says "ready" and an API that says 403 cannot disagree, because
// they are reading the same predicate.

import type { DoctorProvisioningStatus } from "@prisma/client";

/** The subset of Doctor any caller must supply to be classified. */
export interface DoctorProvisioningInput {
  email: string | null;
  phone: string | null;
  supabaseUserId: string | null;
  /**
   * The phone auth identity, when Supabase minted a separate user for it.
   * Required rather than optional: a caller that forgets it would silently
   * report a mobile-linked doctor as having no dashboard access, which is the
   * exact drift the comment on `hasDashboardAccess` forbids.
   */
  supabasePhoneUserId: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  provisioningStatus: DoctorProvisioningStatus;
}

export type AccountStatus = "ACTIVE" | "DEACTIVATED" | "REMOVED";

export type ContactStatus =
  /** Nothing on file. No invitation can be sent. */
  | "CONTACT_REQUIRED"
  /** A personal contact is on file but nobody has confirmed it is theirs. */
  | "UNCONFIRMED"
  /** Confirmed personal contact; an invitation may be sent. */
  | "CONFIRMED";

export interface DoctorProvisioningView {
  accountStatus: AccountStatus;
  /** True when this Doctor can actually reach /doctor right now. */
  dashboardAccess: boolean;
  contactStatus: ContactStatus;
  /** Which channels exist, so an operator knows what to chase. */
  hasLoginEmail: boolean;
  hasLoginMobile: boolean;
  provisioningStatus: DoctorProvisioningStatus;
  /**
   * One line an operator can act on. Deliberately says what is missing rather
   * than a status word that reads as progress.
   */
  blockedReason: string | null;
}

export function accountStatusOf(d: DoctorProvisioningInput): AccountStatus {
  if (d.deletedAt) return "REMOVED";
  return d.isActive ? "ACTIVE" : "DEACTIVATED";
}

// The single definition of "this doctor can open the dashboard". Mirrors the
// WHERE clause in requireDoctorContext: linked auth identity, active, not
// soft-deleted. Any change here must be made there too, or the console will
// promise access the API refuses.
export function hasDashboardAccess(d: DoctorProvisioningInput): boolean {
  // EITHER identity counts as linked, because requireDoctorContext now matches
  // either (see lib/auth/doctorIdentity). A doctor linked by mobile alone has
  // a null `supabaseUserId`, and reading only that column made this console
  // report "no access" for someone the API lets straight in.
  const linked = d.supabaseUserId !== null || d.supabasePhoneUserId !== null;
  return linked && d.isActive && d.deletedAt === null;
}

export function contactStatusOf(d: DoctorProvisioningInput): ContactStatus {
  const hasContact = Boolean(d.email) || Boolean(d.phone);
  if (!hasContact) return "CONTACT_REQUIRED";
  // CONTACT_REQUIRED with a contact present is a real state: an address was
  // recorded from somewhere unverified and has not been confirmed as personal.
  // It must not be reported as ready to invite.
  return d.provisioningStatus === "CONTACT_REQUIRED" ? "UNCONFIRMED" : "CONFIRMED";
}

export function describeDoctorProvisioning(
  d: DoctorProvisioningInput,
): DoctorProvisioningView {
  const accountStatus = accountStatusOf(d);
  const dashboardAccess = hasDashboardAccess(d);
  const contactStatus = contactStatusOf(d);

  let blockedReason: string | null = null;
  if (accountStatus === "REMOVED") {
    blockedReason = "Doctor record removed";
  } else if (accountStatus === "DEACTIVATED") {
    blockedReason = "Account deactivated";
  } else if (!dashboardAccess) {
    blockedReason =
      contactStatus === "CONTACT_REQUIRED"
        ? "No personal login contact on file - cannot invite"
        : contactStatus === "UNCONFIRMED"
          ? "Contact on file is unconfirmed - verify before inviting"
          : d.provisioningStatus === "INVITED"
            ? "Invitation sent, not yet accepted"
            : "Confirmed contact, invitation not sent";
  }

  return {
    accountStatus,
    dashboardAccess,
    contactStatus,
    hasLoginEmail: Boolean(d.email),
    hasLoginMobile: Boolean(d.phone),
    provisioningStatus: d.provisioningStatus,
    blockedReason,
  };
}

// Guard for the invitation path. An invitation is a message to a human, so the
// bar is the strict one: a confirmed personal contact, on a live account, that
// is not already linked.
export function canSendInvitation(d: DoctorProvisioningInput): boolean {
  return (
    accountStatusOf(d) === "ACTIVE" &&
    !hasDashboardAccess(d) &&
    contactStatusOf(d) === "CONFIRMED"
  );
}
