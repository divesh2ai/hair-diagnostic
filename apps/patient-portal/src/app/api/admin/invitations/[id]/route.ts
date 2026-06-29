import { NextResponse } from "next/server";
import { SystemRole, InvitationStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revokeInvitation } from "@/lib/invitations";

// DELETE /api/admin/invitations/[id]
// Revokes a pending invitation. Only the original scope's admin (or
// SUPER_ADMIN) may revoke.
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

  // Scope check
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

  if (inv.status !== InvitationStatus.PENDING) {
    return NextResponse.json(
      { error: "invalid_state", status: inv.status },
      { status: 409 },
    );
  }

  await revokeInvitation(id);
  return NextResponse.json({ ok: true });
}
