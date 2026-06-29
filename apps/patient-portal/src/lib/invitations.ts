import {
  Prisma,
  SystemRole,
  InvitationStatus,
  NotificationChannel as DBNotificationChannel,
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
      | "revoked"
      | "identity_mismatch",
    message: string,
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
  // Keep "+" and digits only. Real E.164 validation belongs in Phase 8 once
  // we settle on a phone library; for now this is a safe normalization.
  const t = v.trim().replace(/[^\d+]/g, "");
  return t ? t : null;
}

// Create a pending invitation, then attempt delivery on the preferred
// channel (WhatsApp default, addendum §6) with fallback through the chain.
// Returns the raw token exactly once.
export async function createInvitation(input: CreateInvitationInput) {
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

  // Duplicate pending check — matches on either email or phone.
  const dup = await prisma.clinicInvitation.findFirst({
    where: {
      status: InvitationStatus.PENDING,
      clinicId: input.clinicId ?? null,
      organizationId: input.organizationId ?? null,
      OR: [
        email ? { email } : { id: "__never__" },
        phone ? { phone } : { id: "__never__" },
      ],
    },
    select: { id: true },
  });
  if (dup) {
    throw new InvitationError(
      "duplicate_pending",
      "a pending invitation for this contact already exists",
    );
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

  // Deliver. Each provider returns ok=false on missing-config or missing-
  // contact; we step down the channel priority. Recorded outcome lets the
  // admin see whether the raw token still needs to be shared manually.
  const inviteLink = buildInviteLink(raw);
  const delivery = await deliverInvitation({
    primaryChannel: channel,
    recipient: { name: name ?? undefined, email: email ?? undefined, phone: phone ?? undefined },
    scopeName: clinicName ?? organizationName ?? "your clinic",
    inviteLink,
    role: input.role,
  });

  await prisma.clinicInvitation.update({
    where: { id: invitation.id },
    data: {
      sentAt: delivery.ok ? new Date() : null,
      sendError: delivery.ok ? null : delivery.error ?? "unknown_send_error",
    },
  });

  return { invitation, rawToken: raw, inviteLink, delivery };
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
        if (!memberEmail || !memberPhone) {
          // ClinicMember requires both; backfill the missing one from the user.
          // (Both columns are NOT NULL in the schema.)
        }
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

export async function revokeInvitation(id: string) {
  return prisma.clinicInvitation.update({
    where: { id },
    data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
  });
}
