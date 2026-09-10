import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

// GET /api/doctor/support
// List the calling doctor's support tickets, most recent first.
// Also returns the total unread count (messages from admin after doctorLastSeenAt)
// so the nav badge stays correct without a separate round-trip.
export async function GET() {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId } = authResult;

  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { doctorId: doctor.id },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, authorRole: true, createdAt: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute unread counts: admin replies the doctor has not seen yet.
    const rows = tickets.map((t) => {
      const adminMessages = t.messages.filter(
        (m) => m.authorRole !== "DOCTOR",
      );
      const unread = t.doctorLastSeenAt
        ? adminMessages.filter(
            (m) => new Date(m.createdAt) > new Date(t.doctorLastSeenAt!),
          ).length
        : adminMessages.length;
      return {
        id: t.id,
        category: t.category,
        priority: t.priority,
        status: t.status,
        subject: t.subject,
        assessmentId: t.assessmentId,
        consultationId: t.consultationId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        resolvedAt: t.resolvedAt,
        lastMessage: t.messages[0] ?? null,
        messageCount: t._count.messages,
        unreadCount: unread,
      };
    });

    const totalUnread = rows.reduce((n, r) => n + r.unreadCount, 0);

    return NextResponse.json({ tickets: rows, totalUnread });
  } catch (err) {
    console.error("[DOCTOR SUPPORT GET]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// POST /api/doctor/support
// Open a new support ticket. The first message is included in the body.
export async function POST(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, authEmail } = authResult;

  let body: {
    category: string;
    subject: string;
    message: string;
    priority?: string;
    assessmentId?: string;
    consultationId?: string;
    reportVersionId?: string;
    raisedFromRoute?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { category, subject, message, priority, assessmentId, consultationId, reportVersionId, raisedFromRoute } = body;

  if (!category || !subject?.trim() || !message?.trim()) {
    return NextResponse.json(
      { error: "category, subject, and message are required" },
      { status: 400 },
    );
  }

  const VALID_CATEGORIES = [
    "PATIENT_ASSESSMENT",
    "REPORT",
    "KIT_PRESCRIPTION",
    "WHATSAPP",
    "LOGIN_ACCESS",
    "TECHNICAL_ISSUE",
    "OTHER",
  ] as const;
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const VALID_PRIORITIES = ["NORMAL", "HIGH", "URGENT"] as const;
  const resolvedPriority =
    priority && VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])
      ? (priority as (typeof VALID_PRIORITIES)[number])
      : "NORMAL";

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        doctorId: doctor.id,
        clinicId: doctor.clinicId,
        category: category as (typeof VALID_CATEGORIES)[number],
        priority: resolvedPriority,
        status: "OPEN",
        subject: subject.trim(),
        assessmentId: assessmentId ?? null,
        consultationId: consultationId ?? null,
        reportVersionId: reportVersionId ?? null,
        raisedFromRoute: raisedFromRoute ?? null,
        // Doctor has seen it from the moment they create it.
        doctorLastSeenAt: new Date(),
        messages: {
          create: {
            authorId: authUserId,
            authorName: doctor.name,
            authorRole: "DOCTOR",
            body: message.trim(),
          },
        },
      },
      include: { messages: true },
    });

    await writeAuditLog({
      action: "SUPPORT_TICKET_CREATED",
      entityType: "SupportTicket",
      entityId: ticket.id,
      actorId: authUserId,
      actorRole: authResult.authRole as never,
      actorType: "doctor",
      clinicId: doctor.clinicId,
      metadata: { category: ticket.category, subject: ticket.subject },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    console.error("[DOCTOR SUPPORT POST]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
