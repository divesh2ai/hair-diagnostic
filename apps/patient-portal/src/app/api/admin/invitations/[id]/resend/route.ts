import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resendInvitation, InvitationError } from "@/lib/invitations";

// POST /api/admin/invitations/[id]/resend
//
// Rotates the invitation's bearer token, resets its TTL, delivers a new
// message, and audits. Delivery only fires after a compare-and-swap on
// (tokenHash, resendCount, lastResentAt, status) wins — two concurrent
// clicks cannot both deliver. Response never contains the raw token.
//
// Rate limits (in-DB, no Redis):
//   • 60s cool-down per invitation (return 429 resend_cooldown + retryAfter)
//   • 10 successful rotations per invitation (return 429 resend_limit)
//
// State transitions on the target invitation:
//   PENDING   → PENDING  (token rotated, TTL reset)
//   EXPIRED   → PENDING  (token rotated, TTL reset — "resend of expired")
//   ACCEPTED  → 409 already_activated
//   REVOKED   → 409 cancelled  (create a NEW invitation instead)
export async function POST(
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

  // Load the invitation ONLY to authorize scope. All lifecycle decisions
  // (status, cooldown, ceiling, expiry) are made inside resendInvitation
  // where they can be evaluated with the CAS guard.
  const inv = await prisma.clinicInvitation.findUnique({
    where: { id },
    include: { clinic: { select: { organizationId: true } } },
  });
  if (!inv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

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
    const { invitation, delivery } = await resendInvitation({
      invitationId: id,
      actorSupabaseUserId: auth.sub,
      actorEmail: auth.email,
    });
    return NextResponse.json({
      ok: true,
      invitation: {
        id: invitation.id,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        resendCount: invitation.resendCount,
        lastResentAt: invitation.lastResentAt,
      },
      delivery: {
        ok: delivery.ok,
        channel: delivery.channel ?? null,
        error: delivery.ok ? undefined : delivery.error ?? null,
      },
    });
  } catch (err) {
    if (err instanceof InvitationError) {
      switch (err.code) {
        case "not_found":
          return NextResponse.json({ error: err.code }, { status: 404 });
        case "already_activated":
        case "cancelled":
        case "invitation_changed":
          return NextResponse.json(
            { error: err.code, message: err.message },
            { status: 409 },
          );
        case "resend_cooldown":
          return NextResponse.json(
            {
              error: err.code,
              message: err.message,
              retryAfter: err.retryAfterSec ?? null,
            },
            {
              status: 429,
              headers: err.retryAfterSec
                ? { "Retry-After": String(err.retryAfterSec) }
                : {},
            },
          );
        case "resend_limit":
          return NextResponse.json(
            { error: err.code, message: err.message },
            { status: 429 },
          );
      }
    }
    console.error("[invitations.resend]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
