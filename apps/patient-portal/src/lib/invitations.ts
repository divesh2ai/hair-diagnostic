import {
  Prisma,
  SystemRole,
  InvitationStatus,
  NotificationChannel as DBNotificationChannel,
  type ClinicInvitation,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/invitation-token";
import {
  getNotificationService,
  type NotificationChannel,
} from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export { generateInvitationToken, hashInvitationToken };

const CLINIC_ROLES: SystemRole[] = [
  SystemRole.CLINIC_ADMIN,
  SystemRole.STAFF,
  SystemRole.DOCTOR,
];
const ORG_ROLES: SystemRole[] = [SystemRole.ORG_ADMIN, SystemRole.SUPER_ADMIN];

// Channel fallback chain when the primary channel returns ok=false. Mirrors
// addendum §6 preference and stops at IN_APP. Skips a channel when the
// recipient has no contact for it.
const CHANNEL_PRIORITY: NotificationChannel[] = [
  "WHATSAPP",
  "SMS",
  "EMAIL",
  "IN_APP",
];

// ── Resend policy (Slice 1) ────────────────────────────────────────────────
// P0 rate-limit constants. In-DB, no Redis / new platform.
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const RESEND_CEILING = 10;

export type CreateInvitationInput = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  role: SystemRole;
  clinicId?: string | null;
  organizationId?: string | null;
  ttlHours?: number;
  channel?: DBNotificationChannel;
  invitedBySupabaseUserId?: string;
  invitedByEmail?: string;
  invitedByPhone?: string;
};

export class InvitationError extends Error {
  constructor(
    public readonly code:
      | "invalid_scope"
      | "invalid_role_for_scope"
      | "missing_contact"
      | "clinic_not_found"
      | "organization_not_found"
      | "duplicate_pending"
      | "not_found"
      | "expired"
      | "already_accepted"
      | "already_activated"
      | "cancelled"
      | "revoked"
      | "identity_mismatch"
      | "resend_cooldown"
      | "resend_limit"
      | "invitation_changed",
    message: string,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
  }
}

function normEmail(v?: string | null): string | null {
  const t = v?.trim().toLowerCase();
  return t ? t : null;
}

function normPhone(v?: string | null): string | null {
  if (!v) return null;
  const t = v.trim().replace(/[^\d+]/g, "");
  return t ? t : null;
}

// ── Lazy-expiry helper ─────────────────────────────────────────────────────
// Canonical "is this invitation expired for authorization purposes" rule.
// Do NOT compare `status === EXPIRED` in call sites — a PENDING row with
// `expiresAt < now()` is functionally expired but not yet transitioned
// (no background sweep runs on P0). This helper is the single source of
// truth so every endpoint agrees.
export function isEffectivelyExpired(
  inv: Pick<ClinicInvitation, "status" | "expiresAt">,
): boolean {
  if (inv.status === InvitationStatus.ACCEPTED) return false;
  if (inv.status === InvitationStatus.REVOKED) return false;
  return inv.expiresAt.getTime() <= Date.now();
}

// Persist EXPIRED status for a lazily-observed expired row and emit the
// audit event. Idempotent — safe to call repeatedly. Kept small so any
// endpoint can call it inline without needing its own audit plumbing.
export async function normalizeExpiry(invitationId: string): Promise<void> {
  const inv = await prisma.clinicInvitation.findUnique({
    where: { id: invitationId },
    select: { status: true, expiresAt: true, clinicId: true, organizationId: true, role: true },
  });
  if (!inv) return;
  if (inv.status !== InvitationStatus.PENDING) return;
  if (!isEffectivelyExpired(inv)) return;
  const updated = await prisma.clinicInvitation.updateMany({
    where: { id: invitationId, status: InvitationStatus.PENDING },
    data: { status: InvitationStatus.EXPIRED },
  });
  if (updated.count > 0) {
    await writeAuditLog({
      action: "DOCTOR_INVITATION_EXPIRED",
      entityType: "ClinicInvitation",
      entityId: invitationId,
      actorType: "system",
      metadata: {
        clinicId: inv.clinicId,
        organizationId: inv.organizationId,
        intendedRole: inv.role,
      },
    }).catch((err) => console.error("[invitations.expired] audit failed", err));
  }
}

// ── Create ─────────────────────────────────────────────────────────────────
export type CreateInvitationResult = {
  invitation: ClinicInvitation;
  delivery: {
    ok: boolean;
    channel?: NotificationChannel;
    error?: string;
  };
};

// Create a pending invitation, then attempt delivery on the preferred
// channel (WhatsApp default, addendum §6) with fallback through the chain.
//
// SECURITY (Slice 1): the raw token is NEVER returned from this function.
// The server holds it only long enough to build the outgoing message. The
// route response also strips it. If code needs to verify a token later,
// it comes IN from the recipient (URL param), never OUT from the server.
export async function createInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const email = normEmail(input.email);
  const phone = normPhone(input.phone);
  const name = input.name?.trim() || null;

  if (!email && !phone) {
    throw new InvitationError(
      "missing_contact",
      "at least one of email or phone is required",
    );
  }

  const hasClinic = Boolean(input.clinicId);
  const hasOrg = Boolean(input.organizationId);
  if (hasClinic === hasOrg) {
    throw new InvitationError(
      "invalid_scope",
      "exactly one of clinicId or organizationId is required",
    );
  }

  if (hasClinic && !CLINIC_ROLES.includes(input.role)) {
    throw new InvitationError(
      "invalid_role_for_scope",
      `role ${input.role} is not valid for a clinic invitation`,
    );
  }
  if (hasOrg && !ORG_ROLES.includes(input.role)) {
    throw new InvitationError(
      "invalid_role_for_scope",
      `role ${input.role} is not valid for an organization invitation`,
    );
  }

  let clinicName: string | null = null;
  let organizationName: string | null = null;

  if (hasClinic) {
    const c = await prisma.clinic.findUnique({
      where: { id: input.clinicId! },
      select: { id: true, name: true },
    });
    if (!c) throw new InvitationError("clinic_not_found", "clinic not found");
    clinicName = c.name;
  } else {
    const o = await prisma.organization.findUnique({
      where: { id: input.organizationId! },
      select: { id: true, name: true },
    });
    if (!o)
      throw new InvitationError("organization_not_found", "organization not found");
    organizationName = o.name;
  }

  // Duplicate-pending check honours lazy expiry: a stale PENDING row past
  // its expiresAt does NOT block a new invitation (transition it to EXPIRED
  // first, then proceed). Without this, admins would be locked out of
  // re-inviting a lapsed recipient until a sweep ran (which never does on P0).
  const dups = await prisma.clinicInvitation.findMany({
    where: {
      status: InvitationStatus.PENDING,
      clinicId: input.clinicId ?? null,
      organizationId: input.organizationId ?? null,
      OR: [
        email ? { email } : { id: "__never__" },
        phone ? { phone } : { id: "__never__" },
      ],
    },
    select: { id: true, expiresAt: true, status: true },
  });
  for (const d of dups) {
    if (isEffectivelyExpired(d)) {
      await normalizeExpiry(d.id);
    } else {
      throw new InvitationError(
        "duplicate_pending",
        "a pending invitation for this contact already exists",
      );
    }
  }

  const ttlHours = Math.max(1, Math.min(input.ttlHours ?? 24 * 7, 24 * 30));
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const { raw, hash } = generateInvitationToken();

  const channel: DBNotificationChannel =
    input.channel ?? DBNotificationChannel.WHATSAPP;

  const invitation = await prisma.clinicInvitation.create({
    data: {
      email,
      phone,
      name,
      role: input.role,
      clinicId: input.clinicId ?? null,
      organizationId: input.organizationId ?? null,
      tokenHash: hash,
      expiresAt,
      channel,
      invitedBySupabaseUserId: input.invitedBySupabaseUserId ?? null,
      invitedByEmail: input.invitedByEmail ?? null,
      invitedByPhone: input.invitedByPhone ?? null,
    },
  });

  const inviteLink = buildInviteLink(raw);
  const delivery = await deliverInvitation({
    primaryChannel: channel,
    recipient: { name: name ?? undefined, email: email ?? undefined, phone: phone ?? undefined },
    scopeName: clinicName ?? organizationName ?? "your clinic",
    inviteLink,
    role: input.role,
  });

  const updated = await prisma.clinicInvitation.update({
    where: { id: invitation.id },
    data: {
      sentAt: delivery.ok ? new Date() : null,
      sendError: delivery.ok ? null : delivery.error ?? "unknown_send_error",
    },
  });

  await writeAuditLog({
    action: "DOCTOR_INVITATION_CREATED",
    entityType: "ClinicInvitation",
    entityId: invitation.id,
    actorId: input.invitedBySupabaseUserId ?? null,
    actorType: "admin",
    metadata: {
      clinicId: invitation.clinicId,
      organizationId: invitation.organizationId,
      intendedRole: invitation.role,
      channel: invitation.channel,
      deliveryChannel: delivery.channel ?? null,
      deliveryOk: delivery.ok,
    },
  }).catch((err) => console.error("[invitations.create] audit failed", err));

  return { invitation: updated, delivery };
}

function buildInviteLink(rawToken: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:4000";
  return `${base.replace(/\/+$/, "")}/invite/${rawToken}`;
}

async function deliverInvitation(args: {
  primaryChannel: DBNotificationChannel;
  recipient: { name?: string; email?: string; phone?: string };
  scopeName: string;
  inviteLink: string;
  role: SystemRole;
}): Promise<{ ok: boolean; channel?: NotificationChannel; error?: string }> {
  const svc = getNotificationService();
  const payload = {
    template: "clinic_invitation",
    variables: {
      name: args.recipient.name ?? "there",
      scope: args.scopeName,
      role: humanRole(args.role),
      link: args.inviteLink,
    },
    fallbackText:
      `Hi ${args.recipient.name ?? "there"}, you've been invited to join ` +
      `${args.scopeName} as ${humanRole(args.role)} on HairOS. ` +
      `Accept here: ${args.inviteLink}`,
  };

  const order = [
    args.primaryChannel as NotificationChannel,
    ...CHANNEL_PRIORITY.filter((c) => c !== args.primaryChannel),
  ];

  let lastErr: string | undefined;
  for (const channel of order) {
    if (channel === "WHATSAPP" || channel === "SMS") {
      if (!args.recipient.phone) continue;
    }
    if (channel === "EMAIL" && !args.recipient.email) continue;
    if (channel === "IN_APP") continue; // not applicable pre-acceptance

    const r = await svc.send(channel, args.recipient, payload);
    if (r.ok) return { ok: true, channel };
    lastErr = `${channel}:${r.error ?? "unknown"}`;
  }
  return { ok: false, error: lastErr ?? "no_channel_available" };
}

function humanRole(r: SystemRole): string {
  switch (r) {
    case SystemRole.DOCTOR:
      return "Doctor";
    case SystemRole.CLINIC_ADMIN:
      return "Clinic Admin";
    case SystemRole.STAFF:
      return "Staff";
    case SystemRole.ORG_ADMIN:
      return "Organization Admin";
    case SystemRole.SUPER_ADMIN:
      return "Super Admin";
    case SystemRole.PATIENT:
      return "Patient";
  }
}

export async function findInvitationByToken(rawToken: string) {
  if (!rawToken) return null;
  const hash = hashInvitationToken(rawToken);
  return prisma.clinicInvitation.findUnique({
    where: { tokenHash: hash },
    include: {
      clinic: { select: { id: true, name: true, slug: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
}

// ── Resend (Slice 1) ───────────────────────────────────────────────────────
export type ResendInvitationInput = {
  invitationId: string;
  scopeName?: string; // pre-resolved clinic/org display name
  actorSupabaseUserId?: string | null;
  actorEmail?: string | null;
};

export type ResendInvitationResult = {
  invitation: ClinicInvitation;
  delivery: {
    ok: boolean;
    channel?: NotificationChannel;
    error?: string;
  };
};

// Rotate an invitation's bearer token, reset its TTL, deliver a new
// message, and audit. Uses a compare-and-swap on (tokenHash, resendCount,
// lastResentAt, status) so two concurrent Resend clicks cannot both
// deliver messages. The loser observes count=0 on updateMany and returns
// `invitation_changed`.
//
// Delivery happens ONLY AFTER the CAS wins — the DB is the sole
// authority on which token is current. If external delivery then fails,
// the new token remains authoritative (recoverable via next Resend).
export async function resendInvitation(
  input: ResendInvitationInput,
): Promise<ResendInvitationResult> {
  const current = await prisma.clinicInvitation.findUnique({
    where: { id: input.invitationId },
  });
  if (!current) throw new InvitationError("not_found", "invitation not found");

  // Lifecycle gates
  if (current.status === InvitationStatus.ACCEPTED) {
    throw new InvitationError(
      "already_activated",
      "invitation has already been accepted",
    );
  }
  if (current.status === InvitationStatus.REVOKED) {
    throw new InvitationError(
      "cancelled",
      "invitation has been cancelled — create a new invitation instead",
    );
  }

  // Rate limits
  if (current.resendCount >= RESEND_CEILING) {
    throw new InvitationError(
      "resend_limit",
      `resend ceiling reached (${RESEND_CEILING}); cancel and create a new invitation`,
    );
  }
  if (current.lastResentAt) {
    const elapsed = Date.now() - current.lastResentAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new InvitationError(
        "resend_cooldown",
        `try again in ${retryAfter}s`,
        retryAfter,
      );
    }
  }

  // Resolve scope name for the delivery message. Kept inside resend so the
  // helper is self-contained.
  let scopeName = input.scopeName ?? "your clinic";
  if (!input.scopeName) {
    if (current.clinicId) {
      const c = await prisma.clinic.findUnique({
        where: { id: current.clinicId },
        select: { name: true },
      });
      scopeName = c?.name ?? scopeName;
    } else if (current.organizationId) {
      const o = await prisma.organization.findUnique({
        where: { id: current.organizationId },
        select: { name: true },
      });
      scopeName = o?.name ?? scopeName;
    }
  }

  const { raw, hash } = generateInvitationToken();
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const newResendCount = current.resendCount + 1;
  const now = new Date();

  // CAS: only the row whose (tokenHash, resendCount, lastResentAt, status)
  // exactly match what we read may be updated. A concurrent caller that
  // rotated the token in between will fail this WHERE clause.
  //
  // Prisma updateMany accepts null equality via `equals: null` — encode
  // both nullable comparisons explicitly.
  const rotation = await prisma.clinicInvitation.updateMany({
    where: {
      id: current.id,
      tokenHash: current.tokenHash,
      resendCount: current.resendCount,
      status: current.status,
      lastResentAt: current.lastResentAt ?? null,
    },
    data: {
      tokenHash: hash,
      expiresAt: newExpiresAt,
      resendCount: newResendCount,
      lastResentAt: now,
      // If we were resending an EXPIRED invitation, transition back to PENDING.
      status: InvitationStatus.PENDING,
      // Delivery outcome is reset — will be written after send() resolves.
      sentAt: null,
      sendError: null,
    },
  });
  if (rotation.count === 0) {
    throw new InvitationError(
      "invitation_changed",
      "invitation was modified concurrently; refresh and try again",
    );
  }

  // ONLY NOW deliver. The new token is authoritative in the DB.
  const inviteLink = buildInviteLink(raw);
  const delivery = await deliverInvitation({
    primaryChannel: current.channel,
    recipient: {
      name: current.name ?? undefined,
      email: current.email ?? undefined,
      phone: current.phone ?? undefined,
    },
    scopeName,
    inviteLink,
    role: current.role,
  });

  const updated = await prisma.clinicInvitation.update({
    where: { id: current.id },
    data: {
      sentAt: delivery.ok ? new Date() : null,
      sendError: delivery.ok ? null : delivery.error ?? "unknown_send_error",
    },
  });

  await writeAuditLog({
    action: "DOCTOR_INVITATION_RESENT",
    entityType: "ClinicInvitation",
    entityId: current.id,
    actorId: input.actorSupabaseUserId ?? null,
    actorType: "admin",
    metadata: {
      clinicId: updated.clinicId,
      organizationId: updated.organizationId,
      intendedRole: updated.role,
      channel: updated.channel,
      deliveryChannel: delivery.channel ?? null,
      deliveryOk: delivery.ok,
      resendCount: newResendCount,
    },
  }).catch((err) => console.error("[invitations.resend] audit failed", err));

  return { invitation: updated, delivery };
}

// ── Cancel (Slice 1) ───────────────────────────────────────────────────────
// Idempotent revoke. If the invitation is already REVOKED / ACCEPTED /
// EXPIRED, we short-circuit rather than throwing. Emits the audit event
// only on the transition, not on repeat calls.
export type CancelInvitationInput = {
  invitationId: string;
  actorSupabaseUserId?: string | null;
  actorEmail?: string | null;
};

export type CancelInvitationResult = {
  invitation: ClinicInvitation;
  alreadyTerminal: boolean;
};

export async function cancelInvitation(
  input: CancelInvitationInput,
): Promise<CancelInvitationResult> {
  const current = await prisma.clinicInvitation.findUnique({
    where: { id: input.invitationId },
  });
  if (!current) throw new InvitationError("not_found", "invitation not found");

  if (current.status !== InvitationStatus.PENDING &&
      current.status !== InvitationStatus.EXPIRED) {
    // Already terminal (REVOKED / ACCEPTED). Idempotent no-op.
    return { invitation: current, alreadyTerminal: true };
  }

  const updated = await prisma.clinicInvitation.update({
    where: { id: current.id },
    data: {
      status: InvitationStatus.REVOKED,
      revokedAt: new Date(),
    },
  });

  await writeAuditLog({
    action: "DOCTOR_INVITATION_CANCELLED",
    entityType: "ClinicInvitation",
    entityId: current.id,
    actorId: input.actorSupabaseUserId ?? null,
    actorType: "admin",
    metadata: {
      clinicId: updated.clinicId,
      organizationId: updated.organizationId,
      intendedRole: updated.role,
      previousStatus: current.status,
    },
  }).catch((err) => console.error("[invitations.cancel] audit failed", err));

  return { invitation: updated, alreadyTerminal: false };
}

// Retained for back-compat with any legacy caller — routes now prefer
// cancelInvitation, which is idempotent and audit-logged.
export async function revokeInvitation(id: string) {
  return prisma.clinicInvitation.update({
    where: { id },
    data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
  });
}

// ── Accept ─────────────────────────────────────────────────────────────────
export type AcceptInput = {
  rawToken: string;
  supabaseUserId: string;
  email?: string | null;
  phone?: string | null;
  name: string;
};

// Accept an invitation. Matches by phone OR email — the signed-in user
// must hold the contact method the invitation was addressed to. Atomic
// w/ membership creation; idempotent on the same supabaseUserId.
//
// (Activation redesign around verified mobile OTP happens in a later
// slice. This function is unchanged behaviourally in Slice 1 apart from
// emitting DOCTOR_INVITATION_EXPIRED when it observes a lazy expiry.)
export async function acceptInvitation(
  input: AcceptInput,
): Promise<{
  invitationId: string;
  membershipType: "doctor" | "clinic_member" | "organization_member";
  membershipId: string;
}> {
  const hash = hashInvitationToken(input.rawToken);
  const userEmail = normEmail(input.email);
  const userPhone = normPhone(input.phone);

  return prisma.$transaction(
    async (tx) => {
      const inv = await tx.clinicInvitation.findUnique({
        where: { tokenHash: hash },
      });
      if (!inv) throw new InvitationError("not_found", "invitation not found");
      if (inv.status === InvitationStatus.REVOKED || inv.revokedAt)
        throw new InvitationError("revoked", "invitation has been revoked");
      if (inv.status === InvitationStatus.ACCEPTED)
        throw new InvitationError(
          "already_accepted",
          "invitation has already been accepted",
        );
      if (inv.expiresAt.getTime() < Date.now()) {
        await tx.clinicInvitation.update({
          where: { id: inv.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        // Best-effort audit — fire-and-forget so a logging failure never
        // blocks the accept itself from returning the correct error.
        writeAuditLog({
          action: "DOCTOR_INVITATION_EXPIRED",
          entityType: "ClinicInvitation",
          entityId: inv.id,
          actorType: "system",
          metadata: {
            clinicId: inv.clinicId,
            organizationId: inv.organizationId,
            intendedRole: inv.role,
            observedDuring: "accept",
          },
        }).catch((err) =>
          console.error("[invitations.expired] audit failed", err),
        );
        throw new InvitationError("expired", "invitation has expired");
      }

      const emailMatch = inv.email && userEmail && inv.email === userEmail;
      const phoneMatch = inv.phone && userPhone && inv.phone === userPhone;
      if (!emailMatch && !phoneMatch) {
        throw new InvitationError(
          "identity_mismatch",
          "invitation contact does not match the signed-in user (email or phone)",
        );
      }

      // Use whatever contact the invitation actually carries for membership rows.
      const memberEmail = inv.email ?? userEmail ?? null;
      const memberPhone = inv.phone ?? userPhone ?? null;

      let membershipType: "doctor" | "clinic_member" | "organization_member";
      let membershipId: string;

      if (inv.clinicId && inv.role === SystemRole.DOCTOR) {
        const existing = memberEmail
          ? await tx.doctor.findFirst({
              where: { clinicId: inv.clinicId, email: memberEmail },
            })
          : null;
        const doctor = existing
          ? await tx.doctor.update({
              where: { id: existing.id },
              data: {
                supabaseUserId: input.supabaseUserId,
                name: existing.name || input.name,
                phone: existing.phone ?? memberPhone,
                isActive: true,
                deletedAt: null,
              },
            })
          : await tx.doctor.create({
              data: {
                clinicId: inv.clinicId,
                email: memberEmail ?? `${input.supabaseUserId}@no-email.invalid`,
                phone: memberPhone,
                name: input.name,
                supabaseUserId: input.supabaseUserId,
              },
            });
        membershipType = "doctor";
        membershipId = doctor.id;
      } else if (inv.clinicId) {
        const member = await tx.clinicMember.upsert({
          where: {
            clinicId_supabaseUserId: {
              clinicId: inv.clinicId,
              supabaseUserId: input.supabaseUserId,
            },
          },
          create: {
            clinicId: inv.clinicId,
            supabaseUserId: input.supabaseUserId,
            role: inv.role,
            email: memberEmail ?? `${input.supabaseUserId}@no-email.invalid`,
            phone: memberPhone ?? "",
            name: input.name,
          },
          update: {
            role: inv.role,
            name: input.name,
            email: memberEmail ?? undefined,
            phone: memberPhone ?? undefined,
            isActive: true,
            deletedAt: null,
          },
        });
        membershipType = "clinic_member";
        membershipId = member.id;
      } else if (inv.organizationId) {
        const member = await tx.organizationMember.upsert({
          where: { supabaseUserId: input.supabaseUserId },
          create: {
            organizationId: inv.organizationId,
            supabaseUserId: input.supabaseUserId,
            role: inv.role,
            email: memberEmail ?? `${input.supabaseUserId}@no-email.invalid`,
            phone: memberPhone ?? "",
            name: input.name,
          },
          update: {
            role: inv.role,
            name: input.name,
            email: memberEmail ?? undefined,
            phone: memberPhone ?? undefined,
            isActive: true,
            deletedAt: null,
          },
        });
        membershipType = "organization_member";
        membershipId = member.id;
      } else {
        throw new InvitationError("invalid_scope", "invitation has no scope");
      }

      await tx.clinicInvitation.update({
        where: { id: inv.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedBySupabaseUserId: input.supabaseUserId,
        },
      });

      return { invitationId: inv.id, membershipType, membershipId };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
