import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/doctor/support/[id]/messages
// Doctor replies to their own ticket. Only allowed while OPEN or IN_PROGRESS.
export async function POST(req: Request, { params }: Params) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId } = authResult;

  let body: { message: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (ticket.doctorId !== doctor.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      return NextResponse.json(
        { error: "Cannot reply to a resolved or closed ticket" },
        { status: 409 },
      );
    }

    const message = await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: authUserId,
        authorName: doctor.name,
        authorRole: "DOCTOR",
        body: body.message.trim(),
      },
    });

    // Mark doctor as having seen this thread (they just replied).
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { doctorLastSeenAt: new Date() },
    });

    await writeAuditLog({
      action: "SUPPORT_MESSAGE_SENT",
      entityType: "SupportTicket",
      entityId: ticket.id,
      actorId: authUserId,
      actorRole: authResult.authRole as never,
      actorType: "doctor",
      clinicId: doctor.clinicId,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("[DOCTOR SUPPORT REPLY]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
