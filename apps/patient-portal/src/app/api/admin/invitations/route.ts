import { NextRequest, NextResponse } from "next/server";
import { NotificationChannel, SystemRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createInvitation,
  InvitationError,
} from "@/lib/invitations";

// POST /api/admin/invitations
// Body: { email, role, clinicId?, organizationId?, ttlHours? }
//   - CLINIC_ADMIN may only invite into their own clinic
//   - ORG_ADMIN may invite into any clinic in their org, or org-level admins
//   - SUPER_ADMIN may invite anywhere
//
// Returns the invitation row plus the raw token exactly once.
export async function POST(req: NextRequest) {
  const auth = await requireRole(
    SystemRole.SUPER_ADMIN,
    SystemRole.ORG_ADMIN,
    SystemRole.CLINIC_ADMIN,
  );
  if (auth instanceof NextResponse) return auth;

  let body: {
    email?: string;
    phone?: string;
    name?: string;
    role?: SystemRole;
    clinicId?: string;
    organizationId?: string;
    ttlHours?: number;
    channel?: NotificationChannel;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.role) {
    return NextResponse.json(
      { error: "missing_required_fields", fields: ["role"] },
      { status: 400 },
    );
  }
  if (!body.email && !body.phone) {
    return NextResponse.json(
      { error: "missing_contact", fields: ["email|phone"] },
      { status: 400 },
    );
  }

  // Authorize scope: CLINIC_ADMIN locked to own clinic; ORG_ADMIN to own org.
  if (auth.user_role === SystemRole.CLINIC_ADMIN) {
    if (!auth.clinic_id || body.clinicId !== auth.clinic_id) {
      return NextResponse.json(
        { error: "forbidden", reason: "out_of_scope_clinic" },
        { status: 403 },
      );
    }
    if (body.organizationId) {
      return NextResponse.json(
        { error: "forbidden", reason: "clinic_admin_cannot_invite_org" },
        { status: 403 },
      );
    }
  } else if (auth.user_role === SystemRole.ORG_ADMIN) {
    if (body.organizationId && body.organizationId !== auth.organization_id) {
      return NextResponse.json(
        { error: "forbidden", reason: "out_of_scope_org" },
        { status: 403 },
      );
    }
    if (body.clinicId) {
      const clinic = await prisma.clinic.findUnique({
        where: { id: body.clinicId },
        select: { organizationId: true },
      });
      if (!clinic || clinic.organizationId !== auth.organization_id) {
        return NextResponse.json(
          { error: "forbidden", reason: "out_of_scope_clinic" },
          { status: 403 },
        );
      }
    }
  }

  try {
    const { invitation, rawToken, inviteLink, delivery } = await createInvitation({
      email: body.email ?? null,
      phone: body.phone ?? null,
      name: body.name ?? null,
      role: body.role,
      clinicId: body.clinicId ?? null,
      organizationId: body.organizationId ?? null,
      ttlHours: body.ttlHours,
      channel: body.channel,
      invitedBySupabaseUserId: auth.sub,
      invitedByEmail: auth.email,
    });

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          phone: invitation.phone,
          name: invitation.name,
          role: invitation.role,
          clinicId: invitation.clinicId,
          organizationId: invitation.organizationId,
          channel: invitation.channel,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
        // Raw token + link — shown once. Falls back to admin-copy if
        // delivery failed (delivery.ok=false).
        rawToken,
        inviteLink,
        delivery,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof InvitationError) {
      const status =
        err.code === "duplicate_pending" ? 409 :
        err.code === "clinic_not_found" || err.code === "organization_not_found" ? 404 :
        400;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    console.error("[invitations.create]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

// GET /api/admin/invitations
// Lists invitations within caller's scope.
export async function GET() {
  const auth = await requireRole(
    SystemRole.SUPER_ADMIN,
    SystemRole.ORG_ADMIN,
    SystemRole.CLINIC_ADMIN,
  );
  if (auth instanceof NextResponse) return auth;

  const where =
    auth.user_role === SystemRole.SUPER_ADMIN
      ? {}
      : auth.user_role === SystemRole.ORG_ADMIN
      ? {
          OR: [
            { organizationId: auth.organization_id ?? "__none__" },
            { clinic: { organizationId: auth.organization_id ?? "__none__" } },
          ],
        }
      : { clinicId: auth.clinic_id ?? "__none__" };

  const invitations = await prisma.clinicInvitation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      role: true,
      clinicId: true,
      organizationId: true,
      channel: true,
      sentAt: true,
      sendError: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
      invitedByEmail: true,
      invitedByPhone: true,
    },
  });

  return NextResponse.json({ invitations });
}
