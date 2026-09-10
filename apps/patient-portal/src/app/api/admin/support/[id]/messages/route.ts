import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError, getClinicContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/admin/support/[id]/messages
// Super Admin replies to a support ticket.
export async function POST(req: Request, { params }: Params) {
  try {
    await assertSuperAdmin();
    const ctx = await getClinicContext();
    const { id } = await params;

    let body: { message: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (ticket.status === "CLOSED") {
      return NextResponse.json(
        { error: "Cannot reply to a closed ticket" },
        { status: 409 },
      );
    }

    // If ticket is OPEN and admin replies, move it to IN_PROGRESS.
    const statusUpdate =
      ticket.status === "OPEN" ? { status: "IN_PROGRESS" as const } : {};

    // Derive admin display name from auth claims (best effort).
    const authorName = ctx.userId ? "FACT Support" : "FACT Support";

    const [message] = await prisma.$transaction([
      prisma.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: ctx.userId,
          authorName,
          authorRole: "SUPER_ADMIN",
          body: body.message.trim(),
        },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          ...statusUpdate,
          adminLastSeenAt: new Date(),
        },
      }),
    ]);

    await writeAuditLog({
      action: "SUPPORT_MESSAGE_SENT",
      entityType: "SupportTicket",
      entityId: ticket.id,
      actorId: ctx.userId,
      actorRole: ctx.role as never,
      actorType: "admin",
      clinicId: ticket.clinicId,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN SUPPORT REPLY]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
