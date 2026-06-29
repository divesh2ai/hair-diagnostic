import { NextResponse } from "next/server";
import { InvitationStatus } from "@prisma/client";
import { findInvitationByToken } from "@/lib/invitations";

// GET /api/invitations/[token]
// Public preview — given a raw token, returns the inviter context the
// recipient needs to decide whether to accept. Does NOT include the
// invitee email back to the caller in a way that could enable account
// harvesting beyond what the recipient already knows.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const inv = await findInvitationByToken(token);
  if (!inv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let status: InvitationStatus = inv.status;
  if (status === InvitationStatus.PENDING && inv.expiresAt.getTime() < Date.now()) {
    status = InvitationStatus.EXPIRED;
  }

  return NextResponse.json({
    invitation: {
      email: inv.email,
      phone: inv.phone,
      name: inv.name,
      role: inv.role,
      channel: inv.channel,
      status,
      expiresAt: inv.expiresAt,
      clinic: inv.clinic,
      organization: inv.organization,
      invitedByEmail: inv.invitedByEmail,
      invitedByPhone: inv.invitedByPhone,
    },
  });
}
