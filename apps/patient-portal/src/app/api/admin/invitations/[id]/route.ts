import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelInvitation, InvitationError } from "@/lib/invitations";

// DELETE /api/admin/invitations/[id]
//
// Cancel a pending / lazily-expired invitation. Slice-1 semantics:
//   • Only the invitation's scope admin (or SUPER_ADMIN) may cancel.
//   • Cancel is idempotent — repeat calls on a REVOKED / ACCEPTED invitation
//     succeed with `alreadyTerminal: true` and do NOT emit a duplicate
//     audit event.
//   • The invitation row is retained (not physically deleted) for audit.
//   • The bearer token is immediately unusable — subsequent /accept calls
//     get 410 revoked.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(
    SystemRole.SUPER_ADMIN,
    SystemRole.ORG_ADMIN,
    SystemRole.CLINIC_ADMIN,
  );
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const inv = await prisma.clinicInvitation.findUnique({
    where: { id },
    include: { clinic: { select: { organizationId: true } } },
  });
  if (!inv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Scope check — trust source is the invitation row's own clinicId /
  // organizationId. Body-supplied scope values are never trusted here
  // (the route param is just an id lookup).
  if (auth.user_role === SystemRole.CLINIC_ADMIN) {
    if (inv.clinicId !== auth.clinic_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else if (auth.user_role === SystemRole.ORG_ADMIN) {
    const orgScoped =
      inv.organizationId === auth.organization_id ||
      inv.clinic?.organizationId === auth.organization_id;
    if (!orgScoped) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  try {
    const { invitation, alreadyTerminal } = await cancelInvitation({
      invitationId: id,
      actorSupabaseUserId: auth.sub,
      actorEmail: auth.email,
    });
    return NextResponse.json({
      ok: true,
      alreadyTerminal,
      invitation: {
        id: invitation.id,
        status: invitation.status,
        revokedAt: invitation.revokedAt,
      },
    });
  } catch (err) {
    if (err instanceof InvitationError && err.code === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[invitations.cancel]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
