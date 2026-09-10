import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/doctor/support/[id]
// Load a ticket + full message thread. Marks doctorLastSeenAt so the unread
// count clears after the doctor opens the thread.
export async function GET(_req: Request, { params }: Params) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  try {
    const { id } = await params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Doctors may only see their own tickets.
    if (ticket.doctorId !== doctor.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Mark as seen.
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { doctorLastSeenAt: new Date() },
    });

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error("[DOCTOR SUPPORT GET/:id]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
